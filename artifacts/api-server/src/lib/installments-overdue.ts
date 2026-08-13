import { and, eq, lt, ne, inArray, type SQL } from "drizzle-orm";
import { db, installmentSchedulesTable, type InstallmentScheduleRow } from "@workspace/db";
import { notify, recipientsByPermission } from "./notify";

/**
 * The overdue-installment rule, in one place.
 *
 * This logic was written inline in the `/overdue-installments` read handler,
 * with a comment explaining that it had to fire there because the system had no
 * scheduler. Now that one exists, the rule needs two callers — the read (so a
 * collector opening the screen still gets current state) and the nightly sweep
 * (so nobody has to open the screen at all).
 *
 * It is extracted rather than reimplemented: a second copy of "what counts as
 * overdue and who hears about it" is exactly the duplicated-business-rule
 * problem the alignment forbids. The route now calls this; behaviour there is
 * unchanged.
 *
 * Idempotency is inherited, not invented — `notify` is unique per
 * `(recipient, sourceModule, sourceId, eventType)`, so the same overdue
 * schedule yields at most one notification however many times this runs.
 */

/** Notifications go to whoever may record a collection for that company. */
const COLLECTOR_PERMISSION = "installmentCollections.create";

export interface OverdueNotifyResult {
  /** Schedules considered in this pass. */
  considered: number;
  /** Distinct companies touched. */
  companies: number;
  /** Notify calls issued; the engine de-duplicates, so this is an upper bound. */
  notified: number;
  /** Companies with no user holding the collector permission. */
  skippedNoRecipients: number;
}

/**
 * Notify the collections team about overdue schedules.
 *
 * Recipients are resolved per company and cached for the pass, so an overdue
 * schedule can only ever reach the team of the company that owns it — a
 * scheduled sweep runs across companies and must not leak one company's
 * receivables into another's inbox.
 *
 * Never throws: both callers treat this as best-effort.
 */
export async function notifyOverdueSchedules(
  rows: InstallmentScheduleRow[],
): Promise<OverdueNotifyResult> {
  const result: OverdueNotifyResult = {
    considered: 0,
    companies: 0,
    notified: 0,
    skippedNoRecipients: 0,
  };

  const overdue = rows.filter((r) => !r.isDeleted);
  result.considered = overdue.length;
  if (overdue.length === 0) return result;

  const collectorsByCompany = new Map<string, string[]>();

  for (const r of overdue) {
    if (!collectorsByCompany.has(r.companyId)) {
      collectorsByCompany.set(
        r.companyId,
        await recipientsByPermission(db, COLLECTOR_PERMISSION, {
          companyId: r.companyId,
        }),
      );
    }
    const collectors = collectorsByCompany.get(r.companyId)!;
    if (collectors.length === 0) {
      result.skippedNoRecipients += 1;
      continue;
    }
    await notify(db, {
      recipientUserIds: collectors,
      companyId: r.companyId,
      category: "installments",
      eventType: "installment_overdue",
      priority: "high",
      title: "قسط متأخر / Overdue installment",
      body: `#${r.installmentNumber} · ${r.dueDate} · ${r.amount}`,
      sourceModule: "installments",
      sourceId: r.id,
      sourceRef: `#${r.installmentNumber}`,
      link: "/installment-schedules",
    });
    result.notified += 1;
  }

  result.companies = collectorsByCompany.size;
  return result;
}

/**
 * Company-scoped overdue sweep, for the scheduler.
 *
 * Bounded by `limit` per company: this exists to raise alerts, and a company
 * with ten thousand overdue schedules does not need ten thousand notifications
 * in one tick — the already-notified ones are de-duplicated by the emitter and
 * the rest are picked up on the next pass.
 */
export async function sweepOverdueForCompanies(
  companyIds: string[],
  limit = 500,
): Promise<OverdueNotifyResult> {
  const total: OverdueNotifyResult = {
    considered: 0,
    companies: 0,
    notified: 0,
    skippedNoRecipients: 0,
  };
  if (companyIds.length === 0) return total;

  const today = new Date().toISOString().slice(0, 10);

  for (const companyId of companyIds) {
    // Explicitly per company rather than one global query: the company filter
    // is the tenant boundary, and keeping it in the loop makes it impossible to
    // accidentally drop.
    const filters: SQL[] = [
      eq(installmentSchedulesTable.companyId, companyId),
      eq(installmentSchedulesTable.isDeleted, false),
      ne(installmentSchedulesTable.status, "paid"),
      lt(installmentSchedulesTable.dueDate, today),
    ];
    const rows = await db
      .select()
      .from(installmentSchedulesTable)
      .where(and(...filters))
      .limit(limit);

    const r = await notifyOverdueSchedules(rows);
    total.considered += r.considered;
    total.notified += r.notified;
    total.skippedNoRecipients += r.skippedNoRecipients;
    if (r.considered > 0) total.companies += 1;
  }

  return total;
}

/** Re-exported so callers needing an id filter do not rebuild the predicate. */
export function overdueScheduleIdFilter(ids: string[]): SQL | undefined {
  return ids.length > 0 ? inArray(installmentSchedulesTable.id, ids) : undefined;
}
