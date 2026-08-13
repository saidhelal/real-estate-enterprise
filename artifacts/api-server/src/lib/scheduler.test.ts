import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Engine tests. The database, audit and logger are stubbed so these assert the
 * scheduler's own guarantees — cadence, overlap, timeout, isolation, replay —
 * without writing rows or depending on business state.
 *
 * The persisted last-success time is the one piece of external state that
 * changes behaviour, so it is controllable per test via `setStoredState`.
 */

let stored: Record<string, { lastSuccessAt: Date | null; runCount: number; failureCount: number }> = {};
const persisted: Array<Record<string, unknown>> = [];

function setStoredState(key: string, lastSuccessAt: Date | null) {
  stored[key] = { lastSuccessAt, runCount: 1, failureCount: 0 };
}

vi.mock("@workspace/db", () => {
  const rowsFor = (key: string) => {
    const s = stored[key];
    return s ? [{ taskKey: key, ...s }] : [];
  };
  let pendingKey = "";
  const db = {
    select: () => ({
      from: () => ({
        where: (pred: unknown) => {
          // The predicate is opaque here; tests drive lookups one key at a time.
          void pred;
          return Promise.resolve(rowsFor(pendingKey));
        },
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          persisted.push(values);
          return Promise.resolve();
        },
      }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        persisted.push(values);
        return Promise.resolve();
      },
    }),
    __setPendingKey: (k: string) => {
      pendingKey = k;
    },
  };
  return { db, schedulerTaskStateTable: { taskKey: "task_key" } };
});

vi.mock("./logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("./audit", () => ({
  recordSystemAudit: vi.fn(async () => undefined),
  SYSTEM_ACTOR: "system",
}));

const { registerTask, runTask, startScheduler, stopScheduler, getSchedulerStatus, _clearRegistry } =
  await import("./scheduler");
const { recordSystemAudit } = await import("./audit");
const dbModule = await import("@workspace/db");

const base = {
  description: "test task",
  intervalMs: 60_000,
  timeoutMs: 5_000,
  enabled: true,
  replayOnBoot: false,
};

function pointLookupsAt(key: string) {
  (dbModule.db as unknown as { __setPendingKey: (k: string) => void }).__setPendingKey(key);
}

beforeEach(() => {
  _clearRegistry();
  stored = {};
  persisted.length = 0;
  vi.mocked(recordSystemAudit).mockClear();
});

describe("registry", () => {
  it("registers a valid descriptor", () => {
    registerTask({ ...base, key: "docs.expiry-sweep", handler: async () => ({}) });
    expect(getSchedulerStatus().taskCount).toBe(1);
  });

  it("rejects a malformed key", () => {
    expect(() => registerTask({ ...base, key: "NoDomain", handler: async () => ({}) })).toThrow(/Invalid task key/);
    expect(() => registerTask({ ...base, key: "a.b.c", handler: async () => ({}) })).toThrow(/Invalid task key/);
  });

  it("rejects a duplicate key", () => {
    registerTask({ ...base, key: "docs.sweep", handler: async () => ({}) });
    expect(() => registerTask({ ...base, key: "docs.sweep", handler: async () => ({}) })).toThrow(/Duplicate/);
  });

  it("rejects a timeout that is not shorter than the interval", () => {
    // Otherwise a slow run overlaps the next due time and the task silently
    // skips itself forever.
    expect(() =>
      registerTask({ ...base, key: "docs.bad", intervalMs: 1000, timeoutMs: 1000, handler: async () => ({}) }),
    ).toThrow(/must be\s+below intervalMs|below intervalMs/);
  });

  it("refuses registration after start", () => {
    startScheduler();
    expect(() => registerTask({ ...base, key: "docs.late", handler: async () => ({}) })).toThrow(/after the scheduler has started/);
    stopScheduler();
  });
});

describe("lifecycle", () => {
  it("starts once and ignores a duplicate start", () => {
    expect(startScheduler()).toBe(true);
    expect(startScheduler()).toBe(false);
    expect(getSchedulerStatus().started).toBe(true);
    stopScheduler();
  });

  it("stops cleanly", () => {
    startScheduler();
    stopScheduler();
    const s = getSchedulerStatus();
    expect(s.started).toBe(false);
    expect(s.startedAt).toBeNull();
  });

  it("reports registry and task counts for readiness", () => {
    registerTask({ ...base, key: "docs.a", handler: async () => ({}) });
    registerTask({ ...base, key: "docs.b", enabled: false, handler: async () => ({}) });
    startScheduler();
    const s = getSchedulerStatus();
    expect(s.registryLoaded).toBe(true);
    expect(s.taskCount).toBe(2);
    expect(s.enabledCount).toBe(1);
    expect(s.runningCount).toBe(0);
    stopScheduler();
  });
});

describe("execution", () => {
  it("runs a task and records success", async () => {
    let ran = 0;
    registerTask({ ...base, key: "docs.ok", handler: async () => { ran++; return { scanned: 3 }; } });
    pointLookupsAt("docs.ok");

    expect(await runTask("docs.ok", "manual")).toBe("success");
    expect(ran).toBe(1);
    expect(persisted.at(-1)).toMatchObject({ lastStatus: "success" });
    expect(recordSystemAudit).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "scheduler_task", entityId: "docs.ok" }),
    );
  });

  it("skips a disabled task", async () => {
    registerTask({ ...base, key: "docs.off", enabled: false, handler: async () => ({}) });
    expect(await runTask("docs.off", "manual")).toBe("skipped");
  });

  it("skips an unknown task", async () => {
    expect(await runTask("docs.missing", "manual")).toBe("skipped");
  });
});

describe("overlap protection", () => {
  it("refuses to run a task concurrently with itself", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => { release = r; });
    let entries = 0;

    registerTask({
      ...base,
      key: "docs.slow",
      handler: async () => { entries++; await gate; return {}; },
    });
    pointLookupsAt("docs.slow");

    const first = runTask("docs.slow", "manual");
    // Second call while the first is in flight must be rejected, not queued.
    expect(await runTask("docs.slow", "manual")).toBe("skipped");
    expect(getSchedulerStatus().tasks[0].running).toBe(true);

    release();
    expect(await first).toBe("success");
    expect(entries).toBe(1);
  });

  it("releases the guard after a throwing task so it can run again", async () => {
    let calls = 0;
    registerTask({
      ...base,
      key: "docs.throws",
      handler: async () => { calls++; throw new Error("boom"); },
    });
    pointLookupsAt("docs.throws");

    expect(await runTask("docs.throws", "manual")).toBe("failed");
    expect(getSchedulerStatus().tasks[0].running).toBe(false);
    // A failed task must never permanently disable itself.
    expect(await runTask("docs.throws", "manual")).toBe("failed");
    expect(calls).toBe(2);
  });
});

describe("failure isolation", () => {
  it("a failing task does not prevent other tasks from running", async () => {
    const ran: string[] = [];
    registerTask({ ...base, key: "docs.bad", handler: async () => { throw new Error("x"); } });
    registerTask({ ...base, key: "docs.good", handler: async () => { ran.push("good"); return {}; } });

    pointLookupsAt("docs.bad");
    expect(await runTask("docs.bad", "scheduled")).toBe("failed");
    pointLookupsAt("docs.good");
    expect(await runTask("docs.good", "scheduled")).toBe("success");
    expect(ran).toEqual(["good"]);
  });

  it("records the error message on failure", async () => {
    registerTask({ ...base, key: "docs.err", handler: async () => { throw new Error("specific failure"); } });
    pointLookupsAt("docs.err");
    await runTask("docs.err", "manual");
    expect(persisted.at(-1)).toMatchObject({ lastStatus: "failed", lastError: "specific failure" });
  });
});

describe("timeout", () => {
  it("records a timeout and releases the guard", async () => {
    registerTask({
      ...base,
      key: "docs.hang",
      intervalMs: 10_000,
      timeoutMs: 40,
      handler: () => new Promise(() => {}), // never settles
    });
    pointLookupsAt("docs.hang");

    expect(await runTask("docs.hang", "manual")).toBe("timeout");
    expect(persisted.at(-1)).toMatchObject({ lastStatus: "timeout" });
    expect(getSchedulerStatus().tasks[0].running).toBe(false);
  });

  it("a timed-out run does not advance the success marker", async () => {
    registerTask({
      ...base,
      key: "docs.hang2",
      intervalMs: 10_000,
      timeoutMs: 30,
      handler: () => new Promise(() => {}),
    });
    pointLookupsAt("docs.hang2");
    await runTask("docs.hang2", "manual");
    // lastSuccessAt is what boot replay measures from; a timeout must not set it.
    expect(persisted.at(-1)).not.toHaveProperty("lastSuccessAt");
  });
});

describe("boot replay", () => {
  it("replays a task that came due while the process was down", async () => {
    let ran = 0;
    registerTask({
      ...base,
      key: "docs.replay",
      intervalMs: 1000,
      timeoutMs: 500,
      replayOnBoot: true,
      handler: async () => { ran++; return {}; },
    });
    // Last success long enough ago that many intervals elapsed.
    setStoredState("docs.replay", new Date(Date.now() - 60 * 60 * 1000));
    pointLookupsAt("docs.replay");

    startScheduler();
    await vi.waitFor(() => expect(ran).toBeGreaterThan(0), { timeout: 2000 });
    stopScheduler();

    // Bounded: one catch-up run, not one per missed interval (3600 here).
    expect(ran).toBe(1);
  });

  it("does not replay a task whose descriptor opts out", async () => {
    let ran = 0;
    registerTask({
      ...base,
      key: "docs.noreplay",
      intervalMs: 1000,
      timeoutMs: 500,
      replayOnBoot: false,
      handler: async () => { ran++; return {}; },
    });
    setStoredState("docs.noreplay", new Date(Date.now() - 60 * 60 * 1000));
    pointLookupsAt("docs.noreplay");

    startScheduler();
    await new Promise((r) => setTimeout(r, 150));
    stopScheduler();
    expect(ran).toBe(0);
  });

  it("does not replay a task that ran recently", async () => {
    let ran = 0;
    registerTask({
      ...base,
      key: "docs.recent",
      intervalMs: 60_000,
      timeoutMs: 5_000,
      replayOnBoot: true,
      handler: async () => { ran++; return {}; },
    });
    setStoredState("docs.recent", new Date(Date.now() - 1000));
    pointLookupsAt("docs.recent");

    startScheduler();
    await new Promise((r) => setTimeout(r, 150));
    stopScheduler();
    expect(ran).toBe(0);
  });
});
