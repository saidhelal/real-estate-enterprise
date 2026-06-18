import { Router, type IRouter } from "express";
import { and, eq, ne, lt, gte, desc, inArray, isNotNull, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { type AnyPgColumn } from "drizzle-orm/pg-core";
import {
  db,
  contractsTable,
  reservationsTable,
  unitTransfersTable,
  leadsTable,
  unitsTable,
  unitStatusesTable,
  projectsTable,
  phasesTable,
  buildingsTable,
  customersTable,
  installmentSchedulesTable,
  cashboxesTable,
  bankAccountsTable,
  customerInvoicesTable,
  supplierInvoicesTable,
  contractorContractsTable,
  workProgressUpdatesTable,
  paymentCertificatesTable,
  purchaseOrdersTable,
  procurementApprovalsTable,
  suppliersTable,
  inventoryItemsTable,
  employeesTable,
  departmentsTable,
  attendanceRecordsTable,
  payrollRunsTable,
  leaveRequestsTable,
  journalEntriesTable,
  fiscalPeriodsTable,
  budgetsTable,
  budgetLinesTable,
  legalCasesTable,
  legalNoticesTable,
  legalClaimsTable,
  serviceEscalationsTable,
  complaintsTable,
  maintenanceRequestsTable,
  handoverRequestsTable,
  fixedAssetsTable,
  employeeInsurancesTable,
  insuranceArrearsTable,
  insuranceSubscriptionsTable,
  insurancePenaltiesTable,
  auditLogsTable,
} from "@workspace/db";
import { GetExecutiveOversightResponse } from "@workspace/api-zod";
import { toCents, fromCents } from "../lib/money";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();

type Kpi = { key: string; value: string; kind: string; tone: string | null };

function kpi(key: string, value: string | number, kind: string, tone: string | null = null): Kpi {
  return { key, value: String(value), kind, tone };
}

const pct = (num: number, den: number): string | null =>
  den > 0 ? ((num / den) * 100).toFixed(1) : null;

/**
 * Maps audit-log entity names to the oversight department they belong to, so
 * "completed operations this month" can be attributed per department. Unknown
 * entities are simply not counted toward any department.
 */
const ENTITY_DEPT: Record<string, string> = {
  reservation: "sales",
  reservationPayment: "sales",
  contract: "sales",
  installmentPlan: "sales",
  unitTransfer: "sales",
  receipt: "collections",
  installmentCollection: "collections",
  cheque: "collections",
  paymentVoucher: "finance",
  treasuryTransaction: "finance",
  bankTransaction: "finance",
  customerInvoice: "finance",
  supplierInvoice: "finance",
  journalEntry: "accounting",
  fiscalPeriod: "accounting",
  budget: "accounting",
  lead: "crm",
  leadActivity: "crm",
  leadFollowUp: "crm",
  callLog: "crm",
  project: "realEstate",
  building: "realEstate",
  floor: "realEstate",
  unit: "realEstate",
  customer: "realEstate",
  contractor: "construction",
  contractorContract: "construction",
  paymentCertificate: "construction",
  certificateApprovalLog: "construction",
  workProgressUpdate: "construction",
  variationOrder: "construction",
  supplier: "procurement",
  supplierCategory: "procurement",
  purchaseOrder: "procurement",
  purchaseRequest: "procurement",
  goodsReceiptNote: "procurement",
  rfq: "procurement",
  supplierQuotation: "procurement",
  procurementApproval: "procurement",
  inventoryItem: "inventory",
  goodsReceipt: "inventory",
  goodsIssue: "inventory",
  inventoryTransfer: "inventory",
  stockAdjustment: "inventory",
  stockCount: "inventory",
  employee: "hr",
  leaveRequest: "hr",
  payrollRun: "hr",
  employeeLoan: "hr",
  employeeAdvance: "hr",
  attendanceRecord: "hr",
  legalCase: "legal",
  legalNotice: "legal",
  legalContract: "legal",
  legalClaim: "legal",
  complaint: "customerService",
  serviceEscalation: "customerService",
  supportTicket: "customerService",
  handoverRequest: "customerService",
  maintenanceRequest: "customerService",
  fixedAsset: "fixedAssets",
  assetTransfer: "fixedAssets",
  assetDepreciation: "fixedAssets",
  assetDisposal: "fixedAssets",
  vehicle: "fixedAssets",
  employeeInsurance: "insurance",
  insuranceSubscription: "insurance",
  insurancePenalty: "insurance",
  assessedPenalty: "insurance",
};

router.get(
  "/executive-oversight/dashboard",
  requireAuth,
  requirePermission("executiveOversight.view", "executiveOversight.viewOwn"),
  async (req, res): Promise<void> => {
    const q = req.query as Record<string, unknown>;
    const companyId = typeof q.companyId === "string" && q.companyId ? q.companyId : null;
    const today = new Date().toISOString().slice(0, 10);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 6);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const perms = req.authUser?.permissions ?? [];
    const level = perms.includes("*") || perms.includes("executiveOversight.view") ? "full" : "department";

    const scoped = (notDeleted: SQL, companyCol: AnyPgColumn, extra?: SQL): SQL => {
      const parts: SQL[] = [notDeleted];
      if (companyId) parts.push(eq(companyCol, companyId));
      if (extra) parts.push(extra);
      return and(...parts) as SQL;
    };
    const moneyExpr = (col: AnyPgColumn): SQL<string> => sql<string>`coalesce(sum(${col}), 0)::text`;
    const notDel = (col: AnyPgColumn): SQL => eq(col, false);

    const countWhere = async (table: any, where: SQL): Promise<number> => {
      const [row] = await db.select({ value: sql<number>`count(*)::int` }).from(table).where(where);
      return row?.value ?? 0;
    };
    const sumWhere = async (table: any, col: AnyPgColumn, where: SQL): Promise<string> => {
      const [row] = await db.select({ value: moneyExpr(col) }).from(table).where(where);
      return row?.value ?? "0";
    };
    const createdSince = async (
      table: any,
      delCol: AnyPgColumn,
      companyCol: AnyPgColumn,
      createdCol: AnyPgColumn,
      since: Date,
    ): Promise<number> => countWhere(table, scoped(notDel(delCol), companyCol, gte(createdCol, since)));
    const auditSince = async (since: Date): Promise<number> =>
      countWhere(auditLogsTable, gte(auditLogsTable.createdAt, since));

    const budgetOverrunCount = async (): Promise<number> => {
      const where = and(
        eq(budgetLinesTable.isDeleted, false),
        companyId ? eq(budgetLinesTable.companyId, companyId) : undefined,
        sql`(
          select coalesce(sum(jel.debit - jel.credit), 0)
          from journal_entry_lines jel
          join journal_entries je on je.id = jel.entry_id and je.is_deleted = false and je.status = 'posted'
          where jel.account_id = ${budgetLinesTable.accountId}
            and (${budgetLinesTable.costCenterId} is null or jel.cost_center_id = ${budgetLinesTable.costCenterId})
        ) > ${budgetLinesTable.amount}`,
      ) as SQL;
      const [row] = await db
        .select({ value: sql<number>`count(*)::int` })
        .from(budgetLinesTable)
        .innerJoin(
          budgetsTable,
          and(
            eq(budgetsTable.id, budgetLinesTable.budgetId),
            eq(budgetsTable.isDeleted, false),
            inArray(budgetsTable.status, ["approved", "active"]),
          ),
        )
        .where(where);
      return row?.value ?? 0;
    };

    const [
      // sales
      activeContracts,
      contractValue,
      unitStatusRows,
      activeReservations,
      transfersCount,
      contractsCancelled,
      reservationsCancelled,
      // collections
      collTotals,
      overdueRow,
      // finance
      cashOnHand,
      bankBalance,
      arRow,
      apRow,
      revenuesTotal,
      expensesTotal,
      // accounting
      jeTotal,
      jeDraft,
      jePosted,
      openPeriods,
      budgetOverruns,
      // crm
      leadsTotal,
      leadsNew,
      leadsWon,
      // construction
      contractorContracts,
      contractorValue,
      certifiedValue,
      avgProgressRow,
      activeWorks,
      stoppedWorks,
      delayedWorks,
      completedWorks,
      // procurement
      suppliersCount,
      openPurchaseOrders,
      purchaseVolume,
      pendingApprovals,
      // inventory
      inventoryItems,
      // hr
      employeesCount,
      activeEmployees,
      departmentsCount,
      pendingLeave,
      payrollPosted,
      inactiveEmployees,
      presentToday,
      absentToday,
      lateToday,
      // legal
      legalCasesCount,
      openLegalCases,
      pendingNotices,
      claimsAmount,
      // customer service
      openEscalations,
      complaintsCount,
      openComplaints,
      deliveryRequests,
      afterSales,
      avgResponseRow,
      // fixed assets
      fixedAssetsCount,
      fixedAssetsValue,
      // insurance
      insuredCount,
      arrearsTotal,
      arrearsCount,
      subscriptionsCount,
      subscriptionsDue,
      penaltiesTotal,
      expiredPolicies,
      // real estate
      projectsCount,
      activeProjects,
      completedProjects,
      stalledProjects,
      delayedPhases,
      buildingsCount,
      unitsCount,
      customersCount,
    ] = await Promise.all([
      // sales
      countWhere(
        contractsTable,
        scoped(notDel(contractsTable.isDeleted), contractsTable.companyId, eq(contractsTable.status, "active")),
      ),
      sumWhere(contractsTable, contractsTable.totalPrice, scoped(notDel(contractsTable.isDeleted), contractsTable.companyId)),
      db
        .select({ code: unitStatusesTable.code, value: sql<number>`count(*)::int` })
        .from(unitsTable)
        .leftJoin(unitStatusesTable, eq(unitsTable.unitStatusId, unitStatusesTable.id))
        .where(scoped(notDel(unitsTable.isDeleted), unitsTable.companyId))
        .groupBy(unitStatusesTable.code),
      countWhere(
        reservationsTable,
        scoped(notDel(reservationsTable.isDeleted), reservationsTable.companyId, ne(reservationsTable.status, "cancelled")),
      ),
      countWhere(unitTransfersTable, scoped(notDel(unitTransfersTable.isDeleted), unitTransfersTable.companyId)),
      countWhere(
        contractsTable,
        scoped(notDel(contractsTable.isDeleted), contractsTable.companyId, eq(contractsTable.status, "cancelled")),
      ),
      countWhere(
        reservationsTable,
        scoped(notDel(reservationsTable.isDeleted), reservationsTable.companyId, eq(reservationsTable.status, "cancelled")),
      ),
      // collections
      db
        .select({
          due: sql<string>`coalesce(sum(${installmentSchedulesTable.amount}), 0)::text`,
          paid: sql<string>`coalesce(sum(${installmentSchedulesTable.paidAmount}), 0)::text`,
          outstanding: sql<string>`coalesce(sum(${installmentSchedulesTable.amount} - ${installmentSchedulesTable.paidAmount}), 0)::text`,
        })
        .from(installmentSchedulesTable)
        .where(scoped(notDel(installmentSchedulesTable.isDeleted), installmentSchedulesTable.companyId)),
      db
        .select({
          amount: sql<string>`coalesce(sum(${installmentSchedulesTable.amount} - ${installmentSchedulesTable.paidAmount}), 0)::text`,
          cnt: sql<number>`count(*)::int`,
        })
        .from(installmentSchedulesTable)
        .where(
          scoped(
            notDel(installmentSchedulesTable.isDeleted),
            installmentSchedulesTable.companyId,
            and(ne(installmentSchedulesTable.status, "paid"), lt(installmentSchedulesTable.dueDate, today)) as SQL,
          ),
        ),
      // finance
      sumWhere(cashboxesTable, cashboxesTable.currentBalance, scoped(notDel(cashboxesTable.isDeleted), cashboxesTable.companyId)),
      sumWhere(bankAccountsTable, bankAccountsTable.currentBalance, scoped(notDel(bankAccountsTable.isDeleted), bankAccountsTable.companyId)),
      db
        .select({ value: sql<string>`coalesce(sum(${customerInvoicesTable.total} - ${customerInvoicesTable.paidAmount}), 0)::text` })
        .from(customerInvoicesTable)
        .where(scoped(notDel(customerInvoicesTable.isDeleted), customerInvoicesTable.companyId, ne(customerInvoicesTable.status, "cancelled"))),
      db
        .select({ value: sql<string>`coalesce(sum(${supplierInvoicesTable.total} - ${supplierInvoicesTable.paidAmount}), 0)::text` })
        .from(supplierInvoicesTable)
        .where(scoped(notDel(supplierInvoicesTable.isDeleted), supplierInvoicesTable.companyId, ne(supplierInvoicesTable.status, "cancelled"))),
      sumWhere(customerInvoicesTable, customerInvoicesTable.total, scoped(notDel(customerInvoicesTable.isDeleted), customerInvoicesTable.companyId, ne(customerInvoicesTable.status, "cancelled"))),
      sumWhere(supplierInvoicesTable, supplierInvoicesTable.total, scoped(notDel(supplierInvoicesTable.isDeleted), supplierInvoicesTable.companyId, ne(supplierInvoicesTable.status, "cancelled"))),
      // accounting
      countWhere(journalEntriesTable, scoped(notDel(journalEntriesTable.isDeleted), journalEntriesTable.companyId)),
      countWhere(journalEntriesTable, scoped(notDel(journalEntriesTable.isDeleted), journalEntriesTable.companyId, eq(journalEntriesTable.status, "draft"))),
      countWhere(journalEntriesTable, scoped(notDel(journalEntriesTable.isDeleted), journalEntriesTable.companyId, eq(journalEntriesTable.status, "posted"))),
      countWhere(fiscalPeriodsTable, scoped(notDel(fiscalPeriodsTable.isDeleted), fiscalPeriodsTable.companyId, eq(fiscalPeriodsTable.status, "open"))),
      budgetOverrunCount(),
      // crm
      countWhere(leadsTable, scoped(notDel(leadsTable.isDeleted), leadsTable.companyId)),
      countWhere(leadsTable, scoped(notDel(leadsTable.isDeleted), leadsTable.companyId, eq(leadsTable.status, "new"))),
      countWhere(leadsTable, scoped(notDel(leadsTable.isDeleted), leadsTable.companyId, eq(leadsTable.status, "won"))),
      // construction
      countWhere(contractorContractsTable, scoped(notDel(contractorContractsTable.isDeleted), contractorContractsTable.companyId)),
      sumWhere(contractorContractsTable, contractorContractsTable.contractValue, scoped(notDel(contractorContractsTable.isDeleted), contractorContractsTable.companyId)),
      sumWhere(paymentCertificatesTable, paymentCertificatesTable.netAmount, scoped(notDel(paymentCertificatesTable.isDeleted), paymentCertificatesTable.companyId)),
      db
        .select({ value: sql<string>`coalesce(round(avg(${workProgressUpdatesTable.progressPercent})::numeric, 0), 0)::text` })
        .from(workProgressUpdatesTable)
        .where(scoped(notDel(workProgressUpdatesTable.isDeleted), workProgressUpdatesTable.companyId, eq(workProgressUpdatesTable.status, "approved"))),
      countWhere(contractorContractsTable, scoped(notDel(contractorContractsTable.isDeleted), contractorContractsTable.companyId, eq(contractorContractsTable.status, "active"))),
      countWhere(contractorContractsTable, scoped(notDel(contractorContractsTable.isDeleted), contractorContractsTable.companyId, eq(contractorContractsTable.status, "suspended"))),
      countWhere(contractorContractsTable, scoped(notDel(contractorContractsTable.isDeleted), contractorContractsTable.companyId, and(eq(contractorContractsTable.status, "active"), lt(contractorContractsTable.endDate, today)) as SQL)),
      countWhere(contractorContractsTable, scoped(notDel(contractorContractsTable.isDeleted), contractorContractsTable.companyId, eq(contractorContractsTable.status, "completed"))),
      // procurement
      countWhere(suppliersTable, scoped(notDel(suppliersTable.isDeleted), suppliersTable.companyId)),
      countWhere(purchaseOrdersTable, scoped(notDel(purchaseOrdersTable.isDeleted), purchaseOrdersTable.companyId, ne(purchaseOrdersTable.status, "completed"))),
      sumWhere(purchaseOrdersTable, purchaseOrdersTable.totalAmount, scoped(notDel(purchaseOrdersTable.isDeleted), purchaseOrdersTable.companyId)),
      countWhere(procurementApprovalsTable, scoped(notDel(procurementApprovalsTable.isDeleted), procurementApprovalsTable.companyId, eq(procurementApprovalsTable.status, "pending"))),
      // inventory
      countWhere(inventoryItemsTable, scoped(notDel(inventoryItemsTable.isDeleted), inventoryItemsTable.companyId)),
      // hr
      countWhere(employeesTable, scoped(notDel(employeesTable.isDeleted), employeesTable.companyId)),
      countWhere(employeesTable, scoped(notDel(employeesTable.isDeleted), employeesTable.companyId, eq(employeesTable.status, "active"))),
      countWhere(departmentsTable, scoped(notDel(departmentsTable.isDeleted), departmentsTable.companyId)),
      countWhere(leaveRequestsTable, scoped(notDel(leaveRequestsTable.isDeleted), leaveRequestsTable.companyId, eq(leaveRequestsTable.status, "submitted"))),
      sumWhere(payrollRunsTable, payrollRunsTable.totalNet, scoped(notDel(payrollRunsTable.isDeleted), payrollRunsTable.companyId, eq(payrollRunsTable.status, "posted"))),
      countWhere(employeesTable, scoped(notDel(employeesTable.isDeleted), employeesTable.companyId, eq(employeesTable.status, "inactive"))),
      countWhere(attendanceRecordsTable, scoped(notDel(attendanceRecordsTable.isDeleted), attendanceRecordsTable.companyId, and(eq(attendanceRecordsTable.attendanceDate, today), eq(attendanceRecordsTable.status, "present")) as SQL)),
      countWhere(attendanceRecordsTable, scoped(notDel(attendanceRecordsTable.isDeleted), attendanceRecordsTable.companyId, and(eq(attendanceRecordsTable.attendanceDate, today), eq(attendanceRecordsTable.status, "absent")) as SQL)),
      countWhere(attendanceRecordsTable, scoped(notDel(attendanceRecordsTable.isDeleted), attendanceRecordsTable.companyId, and(eq(attendanceRecordsTable.attendanceDate, today), eq(attendanceRecordsTable.status, "late")) as SQL)),
      // legal
      countWhere(legalCasesTable, scoped(notDel(legalCasesTable.isDeleted), legalCasesTable.companyId)),
      countWhere(legalCasesTable, scoped(notDel(legalCasesTable.isDeleted), legalCasesTable.companyId, sql`${legalCasesTable.status} not in ('closed', 'won', 'lost', 'settled')` as SQL)),
      countWhere(legalNoticesTable, scoped(notDel(legalNoticesTable.isDeleted), legalNoticesTable.companyId, eq(legalNoticesTable.status, "draft"))),
      sumWhere(legalClaimsTable, legalClaimsTable.amount, scoped(notDel(legalClaimsTable.isDeleted), legalClaimsTable.companyId)),
      // customer service
      countWhere(serviceEscalationsTable, scoped(notDel(serviceEscalationsTable.isDeleted), serviceEscalationsTable.companyId, eq(serviceEscalationsTable.status, "open"))),
      countWhere(complaintsTable, scoped(notDel(complaintsTable.isDeleted), complaintsTable.companyId)),
      countWhere(complaintsTable, scoped(notDel(complaintsTable.isDeleted), complaintsTable.companyId, inArray(complaintsTable.status, ["open", "in_progress"]))),
      countWhere(handoverRequestsTable, scoped(notDel(handoverRequestsTable.isDeleted), handoverRequestsTable.companyId, inArray(handoverRequestsTable.status, ["requested", "scheduled", "in_progress"]))),
      countWhere(maintenanceRequestsTable, scoped(notDel(maintenanceRequestsTable.isDeleted), maintenanceRequestsTable.companyId, inArray(maintenanceRequestsTable.status, ["open", "in_progress"]))),
      db
        .select({ value: sql<string>`coalesce(round(avg(extract(epoch from (${complaintsTable.firstResponseAt} - ${complaintsTable.createdAt})) / 3600.0)::numeric, 1), 0)::text` })
        .from(complaintsTable)
        .where(scoped(notDel(complaintsTable.isDeleted), complaintsTable.companyId, isNotNull(complaintsTable.firstResponseAt))),
      // fixed assets
      countWhere(fixedAssetsTable, scoped(notDel(fixedAssetsTable.isDeleted), fixedAssetsTable.companyId)),
      sumWhere(fixedAssetsTable, fixedAssetsTable.bookValue, scoped(notDel(fixedAssetsTable.isDeleted), fixedAssetsTable.companyId)),
      // insurance
      countWhere(employeeInsurancesTable, scoped(notDel(employeeInsurancesTable.isDeleted), employeeInsurancesTable.companyId, eq(employeeInsurancesTable.insuranceStatus, "active"))),
      sumWhere(insuranceArrearsTable, insuranceArrearsTable.amount, scoped(notDel(insuranceArrearsTable.isDeleted), insuranceArrearsTable.companyId, eq(insuranceArrearsTable.status, "outstanding"))),
      countWhere(insuranceArrearsTable, scoped(notDel(insuranceArrearsTable.isDeleted), insuranceArrearsTable.companyId, eq(insuranceArrearsTable.status, "outstanding"))),
      countWhere(insuranceSubscriptionsTable, scoped(notDel(insuranceSubscriptionsTable.isDeleted), insuranceSubscriptionsTable.companyId)),
      sumWhere(insuranceSubscriptionsTable, insuranceSubscriptionsTable.totalAmount, scoped(notDel(insuranceSubscriptionsTable.isDeleted), insuranceSubscriptionsTable.companyId, eq(insuranceSubscriptionsTable.status, "pending"))),
      sumWhere(insurancePenaltiesTable, insurancePenaltiesTable.amount, scoped(notDel(insurancePenaltiesTable.isDeleted), insurancePenaltiesTable.companyId, eq(insurancePenaltiesTable.status, "pending"))),
      countWhere(employeeInsurancesTable, scoped(notDel(employeeInsurancesTable.isDeleted), employeeInsurancesTable.companyId, eq(employeeInsurancesTable.insuranceStatus, "expired"))),
      // real estate
      countWhere(projectsTable, scoped(notDel(projectsTable.isDeleted), projectsTable.companyId)),
      countWhere(projectsTable, scoped(notDel(projectsTable.isDeleted), projectsTable.companyId, eq(projectsTable.status, "active"))),
      countWhere(projectsTable, scoped(notDel(projectsTable.isDeleted), projectsTable.companyId, eq(projectsTable.status, "completed"))),
      countWhere(projectsTable, scoped(notDel(projectsTable.isDeleted), projectsTable.companyId, eq(projectsTable.status, "on_hold"))),
      countWhere(phasesTable, scoped(notDel(phasesTable.isDeleted), phasesTable.companyId, and(eq(phasesTable.status, "active"), lt(phasesTable.endDate, today)) as SQL)),
      countWhere(buildingsTable, scoped(notDel(buildingsTable.isDeleted), buildingsTable.companyId)),
      countWhere(unitsTable, scoped(notDel(unitsTable.isDeleted), unitsTable.companyId)),
      countWhere(customersTable, scoped(notDel(customersTable.isDeleted), customersTable.companyId)),
    ]);

    // Time-windowed activity + audit attribution + lists (second batch)
    const [
      opsToday,
      opsWeek,
      opsMonth,
      contractsToday,
      contractsWeek,
      contractsMonth,
      reservationsToday,
      reservationsWeek,
      reservationsMonth,
      customersToday,
      customersWeek,
      customersMonth,
      leadsToday,
      leadsWeek,
      leadsMonth,
      auditByEntity,
      onHoldProjectRows,
      delayedPhaseProjectRows,
      eventRows,
    ] = await Promise.all([
      auditSince(startOfToday),
      auditSince(startOfWeek),
      auditSince(startOfMonth),
      createdSince(contractsTable, contractsTable.isDeleted, contractsTable.companyId, contractsTable.createdAt, startOfToday),
      createdSince(contractsTable, contractsTable.isDeleted, contractsTable.companyId, contractsTable.createdAt, startOfWeek),
      createdSince(contractsTable, contractsTable.isDeleted, contractsTable.companyId, contractsTable.createdAt, startOfMonth),
      createdSince(reservationsTable, reservationsTable.isDeleted, reservationsTable.companyId, reservationsTable.createdAt, startOfToday),
      createdSince(reservationsTable, reservationsTable.isDeleted, reservationsTable.companyId, reservationsTable.createdAt, startOfWeek),
      createdSince(reservationsTable, reservationsTable.isDeleted, reservationsTable.companyId, reservationsTable.createdAt, startOfMonth),
      createdSince(customersTable, customersTable.isDeleted, customersTable.companyId, customersTable.createdAt, startOfToday),
      createdSince(customersTable, customersTable.isDeleted, customersTable.companyId, customersTable.createdAt, startOfWeek),
      createdSince(customersTable, customersTable.isDeleted, customersTable.companyId, customersTable.createdAt, startOfMonth),
      createdSince(leadsTable, leadsTable.isDeleted, leadsTable.companyId, leadsTable.createdAt, startOfToday),
      createdSince(leadsTable, leadsTable.isDeleted, leadsTable.companyId, leadsTable.createdAt, startOfWeek),
      createdSince(leadsTable, leadsTable.isDeleted, leadsTable.companyId, leadsTable.createdAt, startOfMonth),
      db
        .select({ entity: auditLogsTable.entity, value: sql<number>`count(*)::int` })
        .from(auditLogsTable)
        .where(gte(auditLogsTable.createdAt, startOfMonth))
        .groupBy(auditLogsTable.entity),
      db
        .select({ id: projectsTable.id, name: projectsTable.name, nameAr: projectsTable.nameAr, code: projectsTable.code })
        .from(projectsTable)
        .where(scoped(notDel(projectsTable.isDeleted), projectsTable.companyId, eq(projectsTable.status, "on_hold")))
        .limit(12),
      db
        .selectDistinct({ id: projectsTable.id, name: projectsTable.name, nameAr: projectsTable.nameAr, code: projectsTable.code })
        .from(phasesTable)
        .innerJoin(projectsTable, eq(projectsTable.id, phasesTable.projectId))
        .where(scoped(notDel(phasesTable.isDeleted), phasesTable.companyId, and(eq(phasesTable.status, "active"), lt(phasesTable.endDate, today)) as SQL))
        .limit(12),
      db
        .select({
          id: auditLogsTable.id,
          action: auditLogsTable.action,
          entity: auditLogsTable.entity,
          entityId: auditLogsTable.entityId,
          userName: auditLogsTable.userName,
          createdAt: auditLogsTable.createdAt,
        })
        .from(auditLogsTable)
        .orderBy(desc(auditLogsTable.createdAt))
        .limit(25),
    ]);

    const byStatus = (code: string): number => unitStatusRows.find((r) => r.code === code)?.value ?? 0;
    const coll = collTotals[0] ?? { due: "0", paid: "0", outstanding: "0" };
    const overdue = overdueRow[0] ?? { amount: "0", cnt: 0 };
    const dueNum = Number(coll.due);
    const paidNum = Number(coll.paid);
    const collectionRate = pct(paidNum, dueNum) ?? "0.0";
    const overdueAmount = overdue.amount;
    const overdueCount = overdue.cnt;
    const ar = arRow[0]?.value ?? "0";
    const ap = apRow[0]?.value ?? "0";
    const avgProgress = avgProgressRow[0]?.value ?? "0";
    const avgResponse = avgResponseRow[0]?.value ?? "0";
    const liquidity = fromCents((toCents(cashOnHand) ?? 0n) + (toCents(bankBalance) ?? 0n));
    const attendanceTotal = presentToday + absentToday + lateToday;

    const unitsSold = byStatus("sold");
    const unitsReserved = byStatus("reserved");
    const unitsAvailable = byStatus("available");

    // Completed operations per department (this month, from the audit trail).
    const completedByDept: Record<string, number> = {};
    for (const row of auditByEntity) {
      const dept = row.entity ? ENTITY_DEPT[row.entity] : undefined;
      if (dept) completedByDept[dept] = (completedByDept[dept] ?? 0) + (row.value ?? 0);
    }

    type DeptDef = { key: string; kpis: Kpi[]; overdueTasks: number; completionRate: string | null };
    const deptDefs: DeptDef[] = [
      {
        key: "sales",
        overdueTasks: 0,
        completionRate: pct(unitsSold, unitsCount),
        kpis: [
          kpi("activeContracts", activeContracts, "count"),
          kpi("contractValue", contractValue, "money"),
          kpi("unitsSold", unitsSold, "count"),
          kpi("unitsReserved", unitsReserved, "count", unitsReserved > 0 ? "warning" : null),
          kpi("unitsAvailable", unitsAvailable, "count", "success"),
          kpi("activeReservations", activeReservations, "count"),
        ],
      },
      {
        key: "collections",
        overdueTasks: overdueCount,
        completionRate: collectionRate,
        kpis: [
          kpi("totalDue", coll.due, "money"),
          kpi("totalCollected", coll.paid, "money", "success"),
          kpi("outstanding", coll.outstanding, "money"),
          kpi("overdueAmount", overdueAmount, "money", Number(overdueAmount) > 0 ? "danger" : null),
          kpi("overdueCount", overdueCount, "count", overdueCount > 0 ? "warning" : null),
          kpi("collectionRate", collectionRate, "percent", Number(collectionRate) >= 80 ? "success" : "warning"),
        ],
      },
      {
        key: "finance",
        overdueTasks: 0,
        completionRate: null,
        kpis: [
          kpi("cashOnHand", cashOnHand, "money"),
          kpi("bankBalance", bankBalance, "money"),
          kpi("receivables", ar, "money", Number(ar) > 0 ? "warning" : null),
          kpi("payables", ap, "money", Number(ap) > 0 ? "warning" : null),
        ],
      },
      {
        key: "accounting",
        overdueTasks: jeDraft,
        completionRate: pct(jePosted, jeTotal),
        kpis: [
          kpi("journalEntries", jeTotal, "count"),
          kpi("draftEntries", jeDraft, "count", jeDraft > 0 ? "warning" : null),
          kpi("postedEntries", jePosted, "count"),
          kpi("openPeriods", openPeriods, "count"),
          kpi("budgetOverruns", budgetOverruns, "count", budgetOverruns > 0 ? "danger" : null),
        ],
      },
      {
        key: "crm",
        overdueTasks: 0,
        completionRate: pct(leadsWon, leadsTotal),
        kpis: [
          kpi("totalLeads", leadsTotal, "count"),
          kpi("newLeads", leadsNew, "count"),
          kpi("wonLeads", leadsWon, "count", "success"),
        ],
      },
      {
        key: "realEstate",
        overdueTasks: delayedPhases,
        completionRate: null,
        kpis: [
          kpi("projects", projectsCount, "count"),
          kpi("activeProjects", activeProjects, "count"),
          kpi("buildings", buildingsCount, "count"),
          kpi("units", unitsCount, "count"),
          kpi("customers", customersCount, "count"),
        ],
      },
      {
        key: "construction",
        overdueTasks: delayedWorks + stoppedWorks,
        completionRate: avgProgress,
        kpis: [
          kpi("contractorContracts", contractorContracts, "count"),
          kpi("contractValue", contractorValue, "money"),
          kpi("certifiedValue", certifiedValue, "money"),
          kpi("avgProgress", avgProgress, "percent"),
          kpi("stoppedWorks", stoppedWorks, "count", stoppedWorks > 0 ? "warning" : null),
          kpi("delayedWorks", delayedWorks, "count", delayedWorks > 0 ? "warning" : null),
        ],
      },
      {
        key: "procurement",
        overdueTasks: pendingApprovals,
        completionRate: null,
        kpis: [
          kpi("suppliers", suppliersCount, "count"),
          kpi("openPurchaseOrders", openPurchaseOrders, "count"),
          kpi("purchaseVolume", purchaseVolume, "money"),
          kpi("pendingApprovals", pendingApprovals, "count", pendingApprovals > 0 ? "warning" : null),
        ],
      },
      {
        key: "inventory",
        overdueTasks: 0,
        completionRate: null,
        kpis: [kpi("items", inventoryItems, "count")],
      },
      {
        key: "hr",
        overdueTasks: pendingLeave,
        completionRate: pct(presentToday, attendanceTotal),
        kpis: [
          kpi("employees", employeesCount, "count"),
          kpi("activeEmployees", activeEmployees, "count", "success"),
          kpi("departments", departmentsCount, "count"),
          kpi("pendingLeave", pendingLeave, "count", pendingLeave > 0 ? "warning" : null),
          kpi("inactiveEmployees", inactiveEmployees, "count", inactiveEmployees > 0 ? "warning" : null),
          kpi("payrollPosted", payrollPosted, "money"),
        ],
      },
      {
        key: "legal",
        overdueTasks: openLegalCases,
        completionRate: null,
        kpis: [
          kpi("cases", legalCasesCount, "count"),
          kpi("openCases", openLegalCases, "count", openLegalCases > 0 ? "warning" : null),
          kpi("pendingNotices", pendingNotices, "count"),
          kpi("claimsAmount", claimsAmount, "money"),
        ],
      },
      {
        key: "customerService",
        overdueTasks: openComplaints + openEscalations,
        completionRate: null,
        kpis: [
          kpi("openComplaints", openComplaints, "count", openComplaints > 0 ? "warning" : null),
          kpi("openEscalations", openEscalations, "count", openEscalations > 0 ? "warning" : null),
          kpi("complaints", complaintsCount, "count"),
          kpi("responseTime", avgResponse, "hours"),
        ],
      },
      {
        key: "fixedAssets",
        overdueTasks: 0,
        completionRate: null,
        kpis: [kpi("assets", fixedAssetsCount, "count"), kpi("bookValue", fixedAssetsValue, "money")],
      },
      {
        key: "insurance",
        overdueTasks: expiredPolicies,
        completionRate: null,
        kpis: [
          kpi("insured", insuredCount, "count"),
          kpi("subscriptions", subscriptionsCount, "count"),
          kpi("penalties", penaltiesTotal, "money", Number(penaltiesTotal) > 0 ? "warning" : null),
          kpi("arrears", arrearsTotal, "money", Number(arrearsTotal) > 0 ? "danger" : null),
          kpi("expiredPolicies", expiredPolicies, "count", expiredPolicies > 0 ? "warning" : null),
        ],
      },
    ];

    const departments = deptDefs.map((d) => {
      const tones = d.kpis.map((k) => k.tone);
      const status = tones.includes("danger") ? "critical" : tones.includes("warning") ? "attention" : "healthy";
      const alerts = tones.filter((tone) => tone === "warning" || tone === "danger").length;
      return {
        key: d.key,
        status,
        completionRate: d.completionRate,
        overdueTasks: d.overdueTasks,
        completedOps: completedByDept[d.key] ?? 0,
        alerts,
        kpis: d.kpis,
      };
    });

    // ---- Section: projects ----
    const atRiskMap = new Map<string, { id: string; name: string; status: string; completionRate: string | null; tone: string | null; issue: string }>();
    for (const p of onHoldProjectRows) {
      atRiskMap.set(p.id, { id: p.id, name: p.name ?? p.nameAr ?? p.code ?? "—", status: "on_hold", completionRate: null, tone: "warning", issue: "stalled" });
    }
    for (const p of delayedPhaseProjectRows) {
      if (!atRiskMap.has(p.id)) {
        atRiskMap.set(p.id, { id: p.id, name: p.name ?? p.nameAr ?? p.code ?? "—", status: "active", completionRate: null, tone: "warning", issue: "delayedPhase" });
      }
    }
    const projects = {
      kpis: [
        kpi("totalProjects", projectsCount, "count"),
        kpi("activeProjects", activeProjects, "count"),
        kpi("completedProjects", completedProjects, "count", "success"),
        kpi("stalledProjects", stalledProjects, "count", stalledProjects > 0 ? "warning" : null),
        kpi("delayedPhases", delayedPhases, "count", delayedPhases > 0 ? "warning" : null),
        kpi("budgetOverruns", budgetOverruns, "count", budgetOverruns > 0 ? "danger" : null),
        kpi("avgProgress", avgProgress, "percent"),
      ],
      atRisk: Array.from(atRiskMap.values()).slice(0, 12),
    };

    // ---- Section: financial ----
    const financial: Kpi[] = [
      kpi("revenues", revenuesTotal, "money", "success"),
      kpi("expenses", expensesTotal, "money"),
      kpi("netCashFlow", liquidity, "money"),
      kpi("totalCollected", coll.paid, "money", "success"),
      kpi("outstanding", coll.outstanding, "money"),
      kpi("overdueAmount", overdueAmount, "money", Number(overdueAmount) > 0 ? "danger" : null),
      kpi("cashOnHand", cashOnHand, "money"),
      kpi("bankBalance", bankBalance, "money"),
      kpi("receivables", ar, "money", Number(ar) > 0 ? "warning" : null),
      kpi("payables", ap, "money", Number(ap) > 0 ? "warning" : null),
    ];

    // ---- Section: sales & customers ----
    const cancellations = contractsCancelled + reservationsCancelled;
    const sales: Kpi[] = [
      kpi("newCustomers", customersMonth, "count"),
      kpi("newLeads", leadsMonth, "count"),
      kpi("activeReservations", activeReservations, "count"),
      kpi("activeContracts", activeContracts, "count"),
      kpi("transfers", transfersCount, "count"),
      kpi("cancellations", cancellations, "count", cancellations > 0 ? "warning" : null),
    ];

    // ---- Section: execution (construction) ----
    const execution: Kpi[] = [
      kpi("avgProgress", avgProgress, "percent"),
      kpi("activeWorks", activeWorks, "count"),
      kpi("stoppedWorks", stoppedWorks, "count", stoppedWorks > 0 ? "warning" : null),
      kpi("delayedWorks", delayedWorks, "count", delayedWorks > 0 ? "warning" : null),
      kpi("completedWorks", completedWorks, "count", "success"),
    ];

    // ---- Section: HR ----
    const hr: Kpi[] = [
      kpi("presentToday", presentToday, "count", "success"),
      kpi("absentToday", absentToday, "count", absentToday > 0 ? "warning" : null),
      kpi("lateToday", lateToday, "count", lateToday > 0 ? "warning" : null),
      kpi("inactiveEmployees", inactiveEmployees, "count", inactiveEmployees > 0 ? "warning" : null),
      kpi("activeEmployees", activeEmployees, "count"),
    ];

    // ---- Section: customer service ----
    const customerService: Kpi[] = [
      kpi("openComplaints", openComplaints, "count", openComplaints > 0 ? "warning" : null),
      kpi("deliveryRequests", deliveryRequests, "count"),
      kpi("afterSales", afterSales, "count"),
      kpi("openEscalations", openEscalations, "count", openEscalations > 0 ? "warning" : null),
      kpi("responseTime", avgResponse, "hours"),
    ];

    // ---- Section: insurance ----
    const insurance: Kpi[] = [
      kpi("subscriptions", subscriptionsCount, "count"),
      kpi("subscriptionsDue", subscriptionsDue, "money", Number(subscriptionsDue) > 0 ? "warning" : null),
      kpi("penalties", penaltiesTotal, "money", Number(penaltiesTotal) > 0 ? "warning" : null),
      kpi("arrears", arrearsTotal, "money", Number(arrearsTotal) > 0 ? "danger" : null),
      kpi("expiredPolicies", expiredPolicies, "count", expiredPolicies > 0 ? "warning" : null),
    ];

    // ---- Section: critical alerts (only what needs top-management attention) ----
    type Alert = { key: string; severity: string; department: string; count: number; value: string | null; kind: string | null };
    const alertDefs: Array<Alert & { active: boolean }> = [
      { key: "overdueInstallments", severity: "danger", department: "collections", count: overdueCount, value: overdueAmount, kind: "money", active: Number(overdueAmount) > 0 },
      { key: "insuranceArrears", severity: "danger", department: "insurance", count: arrearsCount, value: arrearsTotal, kind: "money", active: Number(arrearsTotal) > 0 },
      { key: "budgetOverruns", severity: "danger", department: "accounting", count: budgetOverruns, value: null, kind: null, active: budgetOverruns > 0 },
      { key: "stalledProjects", severity: "warning", department: "realEstate", count: stalledProjects, value: null, kind: null, active: stalledProjects > 0 },
      { key: "delayedPhases", severity: "warning", department: "realEstate", count: delayedPhases, value: null, kind: null, active: delayedPhases > 0 },
      { key: "stoppedWorks", severity: "warning", department: "construction", count: stoppedWorks, value: null, kind: null, active: stoppedWorks > 0 },
      { key: "delayedWorks", severity: "warning", department: "construction", count: delayedWorks, value: null, kind: null, active: delayedWorks > 0 },
      { key: "openLegalCases", severity: "warning", department: "legal", count: openLegalCases, value: null, kind: null, active: openLegalCases > 0 },
      { key: "pendingApprovals", severity: "warning", department: "procurement", count: pendingApprovals, value: null, kind: null, active: pendingApprovals > 0 },
      { key: "expiredPolicies", severity: "warning", department: "insurance", count: expiredPolicies, value: null, kind: null, active: expiredPolicies > 0 },
      { key: "openComplaints", severity: "warning", department: "customerService", count: openComplaints, value: null, kind: null, active: openComplaints > 0 },
    ];
    const criticalAlerts = alertDefs
      .filter((a) => a.active)
      .map(({ active: _active, ...a }) => a)
      .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "danger" ? -1 : 1));

    // ---- Section: executive event log ----
    const eventLog = eventRows.map((e) => ({
      id: e.id,
      action: e.action ?? "",
      entity: e.entity ?? "",
      entityId: e.entityId ?? null,
      user: e.userName ?? "system",
      timestamp: (e.createdAt ?? new Date()).toISOString(),
    }));

    // ---- Section: time-windowed indicators ----
    const windowKpis = (ops: number, c: number, r: number, cust: number, l: number): Kpi[] => [
      kpi("operations", ops, "count"),
      kpi("newContracts", c, "count"),
      kpi("newReservations", r, "count"),
      kpi("newCustomers", cust, "count"),
      kpi("newLeads", l, "count"),
    ];

    // ---- Section: executive summary ----
    const summary: Kpi[] = [
      kpi("contractValue", contractValue, "money"),
      kpi("totalCollected", coll.paid, "money", "success"),
      kpi("overdueAmount", overdueAmount, "money", Number(overdueAmount) > 0 ? "danger" : null),
      kpi("liquidity", liquidity, "money"),
      kpi("activeProjects", activeProjects, "count"),
      kpi("unitsSold", unitsSold, "count"),
      kpi("unitsAvailable", unitsAvailable, "count", "success"),
      kpi("activeEmployees", activeEmployees, "count"),
      kpi("criticalAlerts", criticalAlerts.length, "count", criticalAlerts.length > 0 ? "danger" : "success"),
    ];

    const payload = {
      generatedAt: new Date().toISOString(),
      scope: { level },
      summary,
      today: windowKpis(opsToday, contractsToday, reservationsToday, customersToday, leadsToday),
      week: windowKpis(opsWeek, contractsWeek, reservationsWeek, customersWeek, leadsWeek),
      month: windowKpis(opsMonth, contractsMonth, reservationsMonth, customersMonth, leadsMonth),
      departments,
      projects,
      financial,
      sales,
      execution,
      hr,
      customerService,
      insurance,
      criticalAlerts,
      eventLog,
    };

    res.json(GetExecutiveOversightResponse.parse(payload));
  },
);

export default router;
