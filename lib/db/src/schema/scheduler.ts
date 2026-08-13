import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";

/**
 * Current execution state of each registered scheduled task.
 *
 * Platform infrastructure, not business data — deliberately carries no
 * `companyId`. A task's *effects* are company-scoped (each sweep iterates
 * companies), but the task itself is a property of the process, in the same way
 * the migration journal is.
 *
 * This is persisted rather than held in memory for one reason: boot replay. On
 * restart the scheduler has to answer "did this task become due while the
 * process was down?", and an in-memory table always answers "never run", which
 * would either replay everything on every deploy or silently skip missed work.
 * It also gives readiness and the operations screen a last-run to report.
 *
 * One row per task key, upserted — it never grows with time. Per-run history
 * lives in `audit_logs` through the existing audit engine, so there is no second
 * history store.
 */
export const schedulerTaskStateTable = pgTable("scheduler_task_state", {
  /** Stable descriptor key, e.g. `documents.expiry-sweep`. */
  taskKey: text("task_key").primaryKey(),

  lastStartedAt: timestamp("last_started_at", { withTimezone: true }),
  lastFinishedAt: timestamp("last_finished_at", { withTimezone: true }),
  /** Last run that completed without error — what boot replay measures from. */
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),

  /** `success` | `failed` | `timeout`. */
  lastStatus: text("last_status"),
  lastDurationMs: integer("last_duration_ms"),
  lastError: text("last_error"),
  /** Compact JSON summary returned by the handler (counts, per-company totals). */
  lastResult: text("last_result"),

  runCount: integer("run_count").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type SchedulerTaskStateRow = typeof schedulerTaskStateTable.$inferSelect;
