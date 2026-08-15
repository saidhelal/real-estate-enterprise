import { pgTable, uuid, text, integer, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

/**
 * Canonical record of a significant ERP operation.
 *
 * Answers, for one execution: who asked, under what authority, against what,
 * what technically happened, and what it means to the business.
 *
 * Relationship to the tables it deliberately does NOT replace:
 *
 *   change_requests  — an approval lifecycle for a mutation that must be
 *                      authorised *before* it runs. It already carries actor,
 *                      target, payload and executedAt. It stays the owner of
 *                      "may this happen?"; `operations` records "this happened".
 *                      A governed mutation can produce both: a change request
 *                      when parked, and an operation when the approval
 *                      re-dispatch actually executes it.
 *   audit_logs       — the immutable who-did-what trail. Operations reference
 *                      it, never replace it; every operation emits an audit row
 *                      through the existing engine.
 *   scheduler_task_state — the current state of a recurring *task*. One task
 *                      run may execute many operations.
 *
 * Not every mutation belongs here. Routine CRUD is adequately covered by
 * audit_logs; this table is for operations whose result and business outcome
 * are worth reporting, retrying idempotently, or following up on.
 */
export const operationsTable = pgTable(
  "operations",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Registered definition key, `<domain>.<action>`. */
    operationKey: text("operation_key").notNull(),
    /** Owning module, for filtering without parsing the key. */
    sourceModule: text("source_module").notNull(),

    /** requested | running | succeeded | partial | failed */
    status: text("status").notNull().default("requested"),

    /**
     * `user` or `system`. Scheduled work is never attributed to a person —
     * actorId stays null and actorName carries the reserved system name, which
     * is the convention the audit engine already uses.
     */
    actorType: text("actor_type").notNull(),
    actorId: uuid("actor_id"),
    actorName: text("actor_name").notNull(),
    /** Scheduler task key when the operation originated from a sweep. */
    actorTaskKey: text("actor_task_key"),

    /**
     * Tenant scope. Null only for operations that are genuinely cross-company
     * by definition (a sweep's parent record); the per-company work it performs
     * is recorded with its own companyId.
     */
    companyId: uuid("company_id").references(() => companiesTable.id, { onDelete: "restrict" }),

    targetType: text("target_type"),
    targetId: text("target_id"),

    /**
     * Caller-supplied de-duplication token. Unique when present, so a retried
     * request resolves to the original operation instead of executing twice.
     */
    idempotencyKey: text("idempotency_key"),
    /** Groups operations that belong to one logical request or sweep. */
    correlationId: text("correlation_id"),

    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),

    /** Technical result — counts, ids, what the handler produced. */
    result: jsonb("result"),

    /**
     * Business outcome, kept separate from the technical result on purpose: a
     * transaction can commit successfully (result) while the business answer is
     * a refusal (outcome), e.g. "collection not recorded — cheque returned".
     */
    outcomeCode: text("outcome_code"),
    outcomeMessage: text("outcome_message"),

    /** Stable code plus the message that is safe to show a client. */
    errorCode: text("error_code"),
    errorMessage: text("error_message"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // Partial-unique semantics: many rows may have no key, but a present key
    // must identify exactly one operation. This is what makes retry safe.
    uniqueIndex("operations_idempotency_key_uq").on(t.idempotencyKey),
    index("operations_key_status_idx").on(t.operationKey, t.status),
    index("operations_company_idx").on(t.companyId, t.requestedAt),
    index("operations_correlation_idx").on(t.correlationId),
  ],
);

export type OperationRow = typeof operationsTable.$inferSelect;
