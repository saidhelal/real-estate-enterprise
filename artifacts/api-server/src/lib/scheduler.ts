import { eq } from "drizzle-orm";
import { db, schedulerTaskStateTable } from "@workspace/db";
import { logger } from "./logger";
import { recordSystemAudit } from "./audit";

/**
 * The ERP's single scheduler.
 *
 * Before this, nothing in the system ran on a clock: overdue installments and
 * document expiry were only ever evaluated when a user happened to open the
 * relevant screen, so a condition nobody looked at was a condition nobody was
 * told about. This engine supplies the missing time dimension — and only that.
 *
 * The division of responsibility is strict, because it is what stops a
 * scheduler from slowly absorbing the business:
 *
 *   scheduler  owns WHEN        — cadence, overlap, timeout, replay, isolation
 *   task       owns WHICH       — the descriptor binding a key to a handler
 *   service    owns WHAT        — the business rule, unchanged and still
 *                                 callable from a request
 *
 * No business logic may live in this file or in a task handler. A handler
 * resolves scope and calls an existing service.
 *
 * One process-wide timer drives everything. Registering fifty tasks does not
 * create fifty timers: the tick evaluates which descriptors are due and runs
 * those. There is no queue, no broker and no worker process — the deployment is
 * a single Node process and adding one would buy nothing.
 */

export type TaskStatus = "success" | "failed" | "timeout";

export interface TaskRunResult {
  /** Compact, JSON-serialisable summary — counts, per-company totals. */
  [key: string]: unknown;
}

export interface TaskDescriptor {
  /**
   * Stable identity, `<domain>.<action>`. Persisted as the primary key of the
   * state table, so renaming one loses its history and re-triggers boot replay.
   */
  key: string;
  description: string;
  /** How often the task should run, in milliseconds. */
  intervalMs: number;
  /** Registered but skipped while false. */
  enabled: boolean;
  /**
   * Hard ceiling on a single run. On expiry the run is recorded as `timeout`
   * and the overlap guard is released, so a wedged handler cannot silently
   * retire its own task.
   */
  timeoutMs: number;
  /**
   * Whether a run missed while the process was down should be made up at boot.
   * False for tasks where a late run is worse than a skipped one.
   */
  replayOnBoot: boolean;
  /** The work. Must be idempotent — it will run again. */
  handler: () => Promise<TaskRunResult>;
}

interface RegisteredTask extends TaskDescriptor {
  /** Overlap guard. Never mutated outside `runTask`. */
  running: boolean;
  /** In-memory next-due, seeded from persisted state at start. */
  nextDueAt: number;
}

/** How often the loop wakes to look for due work. */
const TICK_INTERVAL_MS = 60_000;

/**
 * Boot replay is capped at one catch-up run per task regardless of downtime.
 * These sweeps are convergent — they act on whatever is currently overdue or
 * expiring, not on a per-interval delta — so replaying an eight-hour outage
 * eight times would do the same work eight times and notify nobody extra. One
 * run restores correctness; more would only be noise.
 */
const MAX_REPLAY_RUNS_PER_TASK = 1;

const tasks = new Map<string, RegisteredTask>();

let tickTimer: NodeJS.Timeout | undefined;
let started = false;
let startedAt: Date | undefined;
let registryLoaded = false;

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

export function registerTask(descriptor: TaskDescriptor): void {
  if (started) {
    throw new Error(
      `Cannot register "${descriptor.key}" after the scheduler has started — ` +
        `the registry must be complete before the first tick so boot replay ` +
        `sees every task.`,
    );
  }
  if (!descriptor.key || !/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(descriptor.key)) {
    throw new Error(
      `Invalid task key "${descriptor.key}" — expected "<domain>.<action>" in kebab-case.`,
    );
  }
  if (tasks.has(descriptor.key)) {
    throw new Error(`Duplicate task key "${descriptor.key}".`);
  }
  if (descriptor.intervalMs <= 0) {
    throw new Error(`Task "${descriptor.key}" needs a positive intervalMs.`);
  }
  if (descriptor.timeoutMs <= 0) {
    throw new Error(`Task "${descriptor.key}" needs a positive timeoutMs.`);
  }
  if (descriptor.timeoutMs >= descriptor.intervalMs) {
    // Otherwise a slow run is still going when the next is due, and the task
    // permanently skips itself via the overlap guard.
    throw new Error(
      `Task "${descriptor.key}": timeoutMs (${descriptor.timeoutMs}) must be ` +
        `below intervalMs (${descriptor.intervalMs}).`,
    );
  }
  tasks.set(descriptor.key, { ...descriptor, running: false, nextDueAt: 0 });
}

/** Test seam. Not used by the application. */
export function _clearRegistry(): void {
  tasks.clear();
  started = false;
  startedAt = undefined;
  registryLoaded = false;
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = undefined;
  }
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

async function loadState(key: string) {
  const [row] = await db
    .select()
    .from(schedulerTaskStateTable)
    .where(eq(schedulerTaskStateTable.taskKey, key));
  return row;
}

async function persistRun(
  key: string,
  startedAtMs: number,
  status: TaskStatus,
  durationMs: number,
  result: TaskRunResult | null,
  error: string | null,
): Promise<void> {
  const now = new Date();
  const start = new Date(startedAtMs);
  const existing = await loadState(key);

  const values = {
    lastStartedAt: start,
    lastFinishedAt: now,
    lastStatus: status,
    lastDurationMs: durationMs,
    lastError: error,
    lastResult: result ? JSON.stringify(result).slice(0, 4000) : null,
    // Only a clean run advances the success marker — that is the clock boot
    // replay measures against, so a failing task keeps being retried.
    ...(status === "success" ? { lastSuccessAt: now } : {}),
  };

  if (existing) {
    await db
      .update(schedulerTaskStateTable)
      .set({
        ...values,
        runCount: existing.runCount + 1,
        failureCount: existing.failureCount + (status === "success" ? 0 : 1),
      })
      .where(eq(schedulerTaskStateTable.taskKey, key));
  } else {
    await db.insert(schedulerTaskStateTable).values({
      taskKey: key,
      ...values,
      runCount: 1,
      failureCount: status === "success" ? 0 : 1,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Execution                                                           */
/* ------------------------------------------------------------------ */

/**
 * Run one task under the full set of guarantees: it cannot overlap itself, it
 * cannot exceed its timeout, and it cannot take the scheduler down.
 *
 * Returns the status rather than throwing — the caller is a loop that must
 * carry on to the next task no matter what happened here.
 */
export async function runTask(key: string, trigger: "scheduled" | "replay" | "manual"): Promise<TaskStatus | "skipped"> {
  const task = tasks.get(key);
  if (!task) return "skipped";
  if (!task.enabled) return "skipped";

  // Overlap guard. A run already in flight means the previous one is slower
  // than its cadence; skipping is correct and self-correcting.
  if (task.running) {
    logger.warn({ taskKey: key, trigger }, "Scheduled task still running; skipping this occurrence");
    return "skipped";
  }

  task.running = true;
  const startedAtMs = Date.now();
  let status: TaskStatus = "success";
  let result: TaskRunResult | null = null;
  let errorMessage: string | null = null;

  try {
    // Timeout is a race, not a kill: JavaScript cannot abort a running promise,
    // so the handler may still be executing after this resolves. The overlap
    // guard is what keeps that from compounding — the task stays marked running
    // until its promise settles, so a wedged handler blocks only itself.
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Task exceeded its ${task.timeoutMs}ms timeout`)),
        task.timeoutMs,
      );
      timer.unref();
    });

    try {
      result = await Promise.race([task.handler(), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    status = errorMessage.includes("exceeded its") ? "timeout" : "failed";
    logger.error({ err, taskKey: key, trigger }, "Scheduled task failed");
  } finally {
    // MANDATORY: released here so a throwing or timing-out task can never
    // permanently disable itself.
    task.running = false;
    task.nextDueAt = Date.now() + task.intervalMs;
  }

  const durationMs = Date.now() - startedAtMs;

  // Bookkeeping is best-effort and outside the guard: a database blip while
  // recording must not be reported as a task failure or block the next run.
  try {
    await persistRun(key, startedAtMs, status, durationMs, result, errorMessage);
  } catch (err) {
    logger.error({ err, taskKey: key }, "Failed to persist scheduler task state");
  }

  await recordSystemAudit({
    action: status === "success" ? "scheduled_task_run" : "scheduled_task_failed",
    entity: "scheduler_task",
    entityId: key,
    newValue: { trigger, status, durationMs, result, error: errorMessage },
  });

  logger[status === "success" ? "info" : "warn"](
    { taskKey: key, trigger, status, durationMs, result },
    "Scheduled task finished",
  );

  return status;
}

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

async function tick(): Promise<void> {
  const now = Date.now();
  for (const task of tasks.values()) {
    if (!task.enabled || task.running) continue;
    if (task.nextDueAt > now) continue;
    // Sequential: these are convergent sweeps against one database, and running
    // them serially keeps the connection pool available for real traffic.
    await runTask(task.key, "scheduled");
  }
}

/**
 * Decide what to make up for, then schedule everything forward.
 *
 * A restart must not open a blind window — without this, redeploying every
 * half hour would mean an hourly sweep never runs at all.
 */
async function bootReplay(): Promise<void> {
  const now = Date.now();

  for (const task of tasks.values()) {
    if (!task.enabled) {
      task.nextDueAt = Number.POSITIVE_INFINITY;
      continue;
    }

    let state;
    try {
      state = await loadState(task.key);
    } catch (err) {
      // Never let a bookkeeping read stop the scheduler from starting.
      logger.error({ err, taskKey: task.key }, "Could not read scheduler state; scheduling forward");
      task.nextDueAt = now + task.intervalMs;
      continue;
    }

    const lastSuccess = state?.lastSuccessAt?.getTime();

    if (lastSuccess === undefined) {
      // Never run: treat as due now if it replays, otherwise start the clock.
      task.nextDueAt = task.replayOnBoot ? now : now + task.intervalMs;
      continue;
    }

    const elapsed = now - lastSuccess;
    if (task.replayOnBoot && elapsed >= task.intervalMs) {
      const missed = Math.floor(elapsed / task.intervalMs);
      const replays = Math.min(missed, MAX_REPLAY_RUNS_PER_TASK);
      logger.info(
        { taskKey: task.key, missedIntervals: missed, replaying: replays },
        "Scheduled task became due while the process was down; replaying (bounded)",
      );
      for (let i = 0; i < replays; i++) {
        await runTask(task.key, "replay");
      }
      // runTask already set nextDueAt.
    } else {
      task.nextDueAt = lastSuccess + task.intervalMs;
    }
  }
}

/**
 * Start the single scheduler for this process. Idempotent: a second call is a
 * no-op, so an accidental double-start cannot double every task.
 *
 * Boot replay is intentionally not awaited by the caller — see `index.ts`. It
 * runs detached so a slow sweep cannot delay the HTTP port opening, which would
 * look like a failed startup to a supervisor.
 */
export function startScheduler(): boolean {
  if (started) {
    logger.warn("Scheduler already started; ignoring duplicate start");
    return false;
  }
  started = true;
  startedAt = new Date();
  registryLoaded = true;

  const enabled = [...tasks.values()].filter((t) => t.enabled).length;
  logger.info({ tasks: tasks.size, enabled, tickIntervalMs: TICK_INTERVAL_MS }, "Scheduler starting");

  void bootReplay()
    .catch((err) => logger.error({ err }, "Scheduler boot replay failed"))
    .finally(() => {
      tickTimer = setInterval(() => {
        void tick().catch((err) => logger.error({ err }, "Scheduler tick failed"));
      }, TICK_INTERVAL_MS);
      // Unref'd so a pending tick never holds the process open during shutdown.
      tickTimer.unref();
    });

  return true;
}

/** Stop the loop. In-flight handlers are not aborted; the process exit path drains them. */
export function stopScheduler(): void {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = undefined;
  }
  started = false;
  startedAt = undefined;
  logger.info("Scheduler stopped");
}

/* ------------------------------------------------------------------ */
/* Introspection                                                       */
/* ------------------------------------------------------------------ */

export interface SchedulerTaskStatus {
  key: string;
  description: string;
  enabled: boolean;
  intervalMs: number;
  timeoutMs: number;
  replayOnBoot: boolean;
  running: boolean;
  nextRunAt: string | null;
}

export interface SchedulerStatus {
  started: boolean;
  registryLoaded: boolean;
  startedAt: string | null;
  taskCount: number;
  enabledCount: number;
  runningCount: number;
  tasks: SchedulerTaskStatus[];
}

/** In-memory view. Cheap enough for a readiness probe — no database access. */
export function getSchedulerStatus(): SchedulerStatus {
  const list = [...tasks.values()];
  return {
    started,
    registryLoaded,
    startedAt: startedAt?.toISOString() ?? null,
    taskCount: list.length,
    enabledCount: list.filter((t) => t.enabled).length,
    runningCount: list.filter((t) => t.running).length,
    tasks: list.map((t) => ({
      key: t.key,
      description: t.description,
      enabled: t.enabled,
      intervalMs: t.intervalMs,
      timeoutMs: t.timeoutMs,
      replayOnBoot: t.replayOnBoot,
      running: t.running,
      nextRunAt: Number.isFinite(t.nextDueAt) && t.nextDueAt > 0
        ? new Date(t.nextDueAt).toISOString()
        : null,
    })),
  };
}

/** Persisted last-run detail, for the operations screen. */
export async function getSchedulerTaskRuns(): Promise<Record<string, unknown>[]> {
  const rows = await db.select().from(schedulerTaskStateTable);
  const byKey = new Map(rows.map((r) => [r.taskKey, r]));
  return [...tasks.values()].map((t) => {
    const row = byKey.get(t.key);
    return {
      key: t.key,
      description: t.description,
      enabled: t.enabled,
      running: t.running,
      intervalMs: t.intervalMs,
      nextRunAt: Number.isFinite(t.nextDueAt) && t.nextDueAt > 0
        ? new Date(t.nextDueAt).toISOString()
        : null,
      lastStartedAt: row?.lastStartedAt?.toISOString() ?? null,
      lastFinishedAt: row?.lastFinishedAt?.toISOString() ?? null,
      lastSuccessAt: row?.lastSuccessAt?.toISOString() ?? null,
      lastStatus: row?.lastStatus ?? null,
      lastDurationMs: row?.lastDurationMs ?? null,
      lastError: row?.lastError ?? null,
      lastResult: row?.lastResult ? safeParse(row.lastResult) : null,
      runCount: row?.runCount ?? 0,
      failureCount: row?.failureCount ?? 0,
    };
  });
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
