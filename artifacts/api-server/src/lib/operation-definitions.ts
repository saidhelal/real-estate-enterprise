import { registerOperation, type OperationHandlerResult } from "./operations";
import { scanDocumentExpiry } from "./edms";
import { sweepOverdueForCompanies, notifyOverdueSchedules } from "./installments-overdue";
import { db, installmentSchedulesTable } from "@workspace/db";
import { and, eq, lt, ne } from "drizzle-orm";

/**
 * The operation registry.
 *
 * Deliberately small. Phase 5's deliverable is the contract, not a migration of
 * all 47 modules — converting everything at once would leave a half-migrated
 * system where two conventions are live simultaneously, which is worse than
 * either. These three were chosen because each exercises a different part of
 * the contract:
 *
 *   documents.expireForCompany   permissioned, company-scoped, user-initiated
 *   installments.notifyOverdue   produces notifications through the existing
 *                                engine; demonstrates outcome ≠ result
 *   installments.sweepOverdue    system actor, cross-company, partial status
 *
 * Every handler calls a service that already existed. No business rule was
 * written here, and none was duplicated: the same functions the scheduler and
 * the HTTP routes already use are the ones invoked.
 */

/**
 * Expire a single company's documents on demand.
 *
 * The nightly sweep already does this for every company; this is the
 * user-initiated equivalent for one company, so an administrator does not have
 * to wait six hours after fixing a date.
 */
registerOperation<{ nearDays?: number }, Awaited<ReturnType<typeof scanDocumentExpiry>>>({
  key: "documents.expireForCompany",
  description: "Scan one company's documents for expiry and notify owners",
  sourceModule: "documents",
  // Reuses the existing permission string — no new permission was introduced.
  permission: "documents.update",
  targetType: "company",
  async handler(ctx, input) {
    if (!ctx.companyId) {
      throw new Error("companyId is required for a company-scoped document scan");
    }
    const result = await scanDocumentExpiry(
      ctx.companyId,
      input.nearDays ?? 30,
      ctx.actor.id,
    );
    // Outcome describes the business meaning; result carries the numbers.
    const outcome =
      result.expired > 0
        ? { code: "documents.expired", message: `${result.expired} document(s) marked expired.` }
        : result.nearExpiry > 0
          ? { code: "documents.near_expiry", message: `${result.nearExpiry} document(s) expiring soon.` }
          : { code: "documents.none_due", message: "No documents required expiry action." };
    return { result, outcome };
  },
});

/**
 * Notify collections about one company's overdue schedules, on demand.
 *
 * Shows the result/outcome split clearly: the technical result can be a clean
 * pass over 40 schedules while the business outcome is "nobody was told",
 * because the company has no user holding the collector permission.
 */
registerOperation<{ limit?: number }, { considered: number; notified: number; skippedNoRecipients: number }>({
  key: "installments.notifyOverdue",
  description: "Notify the collections team about a company's overdue installments",
  sourceModule: "installments",
  permission: "installmentSchedules.view",
  targetType: "company",
  async handler(ctx, input) {
    if (!ctx.companyId) {
      throw new Error("companyId is required for an overdue notification run");
    }
    const today = new Date().toISOString().slice(0, 10);
    const rows = await db
      .select()
      .from(installmentSchedulesTable)
      .where(
        and(
          // Company filter first: the tenant boundary is an explicit predicate,
          // never inherited from ambient state.
          eq(installmentSchedulesTable.companyId, ctx.companyId),
          eq(installmentSchedulesTable.isDeleted, false),
          ne(installmentSchedulesTable.status, "paid"),
          lt(installmentSchedulesTable.dueDate, today),
        ),
      )
      .limit(input.limit ?? 500);

    const r = await notifyOverdueSchedules(rows);

    const outcome =
      r.considered === 0
        ? { code: "installments.none_overdue", message: "No overdue installments found." }
        : r.notified === 0
          ? {
              code: "installments.no_recipients",
              message: `${r.considered} overdue installment(s) found, but no user holds the collector permission.`,
            }
          : {
              code: "installments.collections_notified",
              message: `Collections notified about ${r.notified} overdue installment(s).`,
            };

    return {
      result: { considered: r.considered, notified: r.notified, skippedNoRecipients: r.skippedNoRecipients },
      outcome,
    };
  },
});

/**
 * Cross-company overdue sweep — the system-actor case.
 *
 * Registered so the scheduler's sweep gains an operation identity without the
 * scheduler learning any business logic: the task hands this a system actor and
 * the contract does the rest.
 */
registerOperation<{ companyIds: string[] }, { companiesScanned: number; considered: number; notified: number }>({
  key: "installments.sweepOverdue",
  description: "System sweep notifying collections about overdue installments across companies",
  sourceModule: "installments",
  // No permission: system actors bypass RBAC by design, which is why this
  // handler takes an explicit company list rather than querying globally.
  targetType: "system",
  async handler(_ctx, input): Promise<OperationHandlerResult<{ companiesScanned: number; considered: number; notified: number }>> {
    const r = await sweepOverdueForCompanies(input.companyIds);
    const result = {
      companiesScanned: input.companyIds.length,
      considered: r.considered,
      notified: r.notified,
    };
    // A sweep where some companies had overdue items but no collectors is
    // neither success nor failure — this is the case `partial` exists for.
    const partial = r.skippedNoRecipients > 0;
    const outcome = partial
      ? {
          code: "installments.partially_notified",
          message: `${r.notified} notified; ${r.skippedNoRecipients} company/companies had no collector.`,
        }
      : r.considered === 0
        ? { code: "installments.none_overdue", message: "No overdue installments across any company." }
        : { code: "installments.collections_notified", message: `Collections notified about ${r.notified} overdue installment(s).` };

    return { result, outcome, partial };
  },
});

/** Called once at bootstrap so the registry is populated before any request. */
export function registerOperationDefinitions(): void {
  // Registration happens at module import (above). This exported function
  // exists so the bootstrap has an explicit, greppable call site rather than
  // relying on import side effects alone.
}
