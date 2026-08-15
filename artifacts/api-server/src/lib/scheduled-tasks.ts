import { and, eq } from "drizzle-orm";
import { db, companiesTable } from "@workspace/db";
import { registerTask, type TaskRunResult } from "./scheduler";
import { scanDocumentExpiry } from "./edms";
import { sweepCompany } from "./sla";
import { sweepReorderLevels } from "./stock";
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
 * Missed service deadlines.
 *
 * `sla.ts` decides what a deadline is, when it has been missed and who is
 * answerable; this supplies the clock and the tenant loop, like the other two.
 *
 * It runs far more often than the daily sweeps because an SLA is measured in
 * hours: a four-hour promise noticed six hours late has already failed twice
 * over. The sweep is convergent — an escalation is raised only when the level
 * it would write exceeds the level already on the record — so running it every
 * fifteen minutes produces one escalation per breach, not ninety-six.
 */
async function slaBreachSweep(): Promise<TaskRunResult> {
  const companyIds = await activeCompanyIds();
  const totals = { companies: companyIds.length, breached: 0, raised: 0, notified: 0, skippedNoRecipients: 0 };

  for (const companyId of companyIds) {
    const r = await sweepCompany(companyId);
    totals.breached += r.breached;
    totals.raised += r.raised;
    totals.notified += r.notified;
    totals.skippedNoRecipients += r.skippedNoRecipients;
  }
  return totals;
}

/**
 * Stock that has fallen to its reorder level.
 *
 * `stock.ts` decides what "low" means and who is answerable; this supplies the
 * clock and the tenant loop, like the others. Daily rather than hourly: a
 * reorder level is a purchasing signal, not an incident, and the notifier
 * de-duplicates per item so a shortage lasting a fortnight produces one alert.
 */
async function reorderLevelSweep(): Promise<TaskRunResult> {
  const companyIds = await activeCompanyIds();
  const totals = { companies: companyIds.length, checked: 0, below: 0, notified: 0 };

  for (const companyId of companyIds) {
    const r = await sweepReorderLevels(companyId);
    totals.checked += r.checked;
    totals.below += r.below;
    totals.notified += r.notified;
  }
  return totals;
}

/**
 * Register the full task set. Called once from the API bootstrap, before
 * `startScheduler()` — the registry must be complete before the first tick so
 * boot replay can see every task.
 */
export function registerScheduledTasks(): void {
  registerTask({
    key: "inventory.reorder-level-sweep",
    description: "Notify purchasing when stock reaches its reorder level",
    intervalMs: 12 * HOUR,
    timeoutMs: 5 * MINUTE,
    enabled: true,
    replayOnBoot: true,
    handler: reorderLevelSweep,
  });

  registerTask({
    key: "customer-service.sla-breach-sweep",
    description: "Escalate complaints, tickets and maintenance requests that missed their SLA",
    intervalMs: 15 * MINUTE,
    timeoutMs: 5 * MINUTE,
    enabled: true,
    // A breach that happened during a deploy is still a breach.
    replayOnBoot: true,
    handler: slaBreachSweep,
  });

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
