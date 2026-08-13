import { and, eq } from "drizzle-orm";
import { db, companiesTable } from "@workspace/db";
import { registerTask, type TaskRunResult } from "./scheduler";
import { scanDocumentExpiry } from "./edms";
import { executeOperation, systemActor } from "./operations";
import "./operation-definitions";

/**
 * Every scheduled task in the ERP.
 *
 * This is the only place tasks are registered — there is one registry, and a
 * module gains scheduled behaviour by adding a descriptor here, never by
 * starting its own timer.
 *
 * Each handler does exactly two things: resolve the scope it should operate
 * over, and call an existing service. The business rules stay in the domains
 * that own them (`edms.ts` decides what "expired" means;
 * `installments-overdue.ts` decides what "overdue" means and who hears about
 * it). If a handler here ever starts computing a business answer, the
 * responsibility has leaked into the wrong layer.
 *
 * Only real, already-implemented time-dependent behaviour is registered. No
 * task exists to demonstrate the scheduler.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Companies the sweeps iterate. Resolved per run rather than cached, so a
 * company added after boot is picked up without a restart.
 *
 * Every business sweep is company-scoped: the tasks operate across tenants by
 * looping this list and passing the id down, never by issuing one unscoped
 * query. That keeps the tenant boundary an explicit argument instead of an
 * omission waiting to happen.
 */
async function activeCompanyIds(): Promise<string[]> {
  const rows = await db
    .select({ id: companiesTable.id })
    .from(companiesTable)
    .where(and(eq(companiesTable.isDeleted, false), eq(companiesTable.isActive, true)));
  return rows.map((r) => r.id);
}

/**
 * Document expiry.
 *
 * `scanDocumentExpiry` already flips past-due documents to `expired` and
 * notifies owners about expired and near-expiry documents — it was simply only
 * ever invoked when somebody opened the documents screen, so a contract that
 * lapsed while nobody looked stayed "active" and silent.
 */
async function documentExpirySweep(): Promise<TaskRunResult> {
  const companyIds = await activeCompanyIds();
  const totals = { companies: companyIds.length, scanned: 0, expired: 0, nearExpiry: 0, notified: 0 };

  for (const companyId of companyIds) {
    // `actorUserId` is null: this run has no human behind it, and inventing one
    // would put a false name on the resulting notifications.
    const r = await scanDocumentExpiry(companyId, NEAR_EXPIRY_DAYS, null);
    totals.scanned += r.scanned;
    totals.expired += r.expired;
    totals.nearExpiry += r.nearExpiry;
    totals.notified += r.notified;
  }
  return totals;
}

/** Warning window for documents approaching expiry, matching the screen default. */
const NEAR_EXPIRY_DAYS = 30;

/**
 * Overdue receivables.
 *
 * Finance owns the definition; this only supplies the clock and the tenant
 * loop. Notification de-duplication is the emitter's, so a schedule that is
 * overdue for months still produces exactly one alert.
 */
async function overdueInstallmentsSweep(): Promise<TaskRunResult> {
  const companyIds = await activeCompanyIds();
  // Routed through the Operation Contract so the sweep gets an operation
  // identity, a recorded business outcome and an audit row with a system actor
  // — without the scheduler knowing anything about installments. The task still
  // only supplies the clock and the tenant list.
  const op = await executeOperation<{ companyIds: string[] }, Record<string, number>>(
    "installments.sweepOverdue",
    {
      actor: systemActor("installments.overdue-sweep"),
      input: { companyIds },
      // No idempotency key: this sweep is convergent and meant to re-run each
      // cadence. De-duplication of its *effects* is the notifier's job.
    },
  );
  return {
    operationId: op.operationId,
    status: op.status,
    outcome: op.outcome?.code ?? null,
    ...(op.result ?? {}),
  };
}

/**
 * Register the full task set. Called once from the API bootstrap, before
 * `startScheduler()` — the registry must be complete before the first tick so
 * boot replay can see every task.
 */
export function registerScheduledTasks(): void {
  registerTask({
    key: "documents.expiry-sweep",
    description: "Flip past-due documents to expired and notify owners of expiring documents",
    intervalMs: 6 * HOUR,
    timeoutMs: 5 * MINUTE,
    enabled: true,
    // A document that lapsed during a deploy must not wait six hours to be
    // noticed; the sweep is convergent so replaying it is harmless.
    replayOnBoot: true,
    handler: documentExpirySweep,
  });

  registerTask({
    key: "installments.overdue-sweep",
    description: "Notify the collections team about overdue installment schedules",
    intervalMs: 6 * HOUR,
    timeoutMs: 5 * MINUTE,
    enabled: true,
    replayOnBoot: true,
    handler: overdueInstallmentsSweep,
  });
}
