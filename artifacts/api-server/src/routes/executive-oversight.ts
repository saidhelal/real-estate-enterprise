import { Router, type IRouter, type Request } from "express";
import { and, eq, ne, lt, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { type AnyPgColumn } from "drizzle-orm/pg-core";
import {
  db,
  contractsTable,
  reservationsTable,
  leadsTable,
  unitsTable,
  unitStatusesTable,
  projectsTable,
  buildingsTable,
  customersTable,
  installmentSchedulesTable,
  cashboxesTable,
  bankAccountsTable,
  customerInvoicesTable,
  supplierInvoicesTable,
  contractorContractsTable,
  paymentCertificatesTable,
  purchaseOrdersTable,
  purchaseContractsTable,
  procurementApprovalsTable,
  suppliersTable,
  inventoryItemsTable,
  employeesTable,
  departmentsTable,
  payrollRunsTable,
  leaveRequestsTable,
  journalEntriesTable,
  fiscalPeriodsTable,
  legalCasesTable,
  legalNoticesTable,
  legalClaimsTable,
  serviceEscalationsTable,
  complaintsTable,
  fixedAssetsTable,
  employeeInsurancesTable,
  insuranceArrearsTable,
} from "@workspace/db";
import { GetExecutiveOversightResponse } from "@workspace/api-zod";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();

type Kpi = { key: string; value: string; kind: string; tone: string | null };
type Department = { key: string; kpis: Kpi[] };

function kpi(key: string, value: string | number, kind: string, tone: string | null = null): Kpi {
  return { key, value: String(value), kind, tone };
}

router.get(
  "/executive-oversight/dashboard",
  requireAuth,
  requirePermission("executiveOversight.view"),
  async (req, res): Promise<void> => {
    const q = req.query as Record<string, unknown>;
    const companyId = typeof q.companyId === "string" && q.companyId ? q.companyId : null;
    const today = new Date().toISOString().slice(0, 10);

    const scoped = (notDeleted: SQL, companyCol: AnyPgColumn, extra?: SQL): SQL => {
      const parts: SQL[] = [notDeleted];
      if (companyId) parts.push(eq(companyCol, companyId));
      if (extra) parts.push(extra);
      return and(...parts) as SQL;
    };
    const moneyExpr = (col: AnyPgColumn): SQL<string> => sql<string>`coalesce(sum(${col}), 0)::text`;

    const countWhere = async (table: any, where: SQL): Promise<number> => {
      const [row] = await db.select({ value: sql<number>`count(*)::int` }).from(table).where(where);
      return row?.value ?? 0;
    };
    const sumWhere = async (table: any, col: AnyPgColumn, where: SQL): Promise<string> => {
      const [row] = await db.select({ value: moneyExpr(col) }).from(table).where(where);
      return row?.value ?? "0";
    };

    const notDel = (col: AnyPgColumn): SQL => eq(col, false);

    const [
      // sales
      activeContracts,
      contractValue,
      unitStatusRows,
      activeReservations,
      // collections
      collTotals,
      overdueRow,
      // finance
      cashOnHand,
      bankBalance,
      arRow,
      apRow,
      // accounting
      jeTotal,
      jeDraft,
      jePosted,
      openPeriods,
      // crm
      leadsTotal,
      leadsNew,
      leadsWon,
      // construction
      contractorContracts,
      contractorValue,
      certifiedValue,
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
      // legal
      legalCasesCount,
      openLegalCases,
      pendingNotices,
      claimsAmount,
      // customer service
      openEscalations,
      complaintsCount,
      // fixed assets
      fixedAssetsCount,
      fixedAssetsValue,
      // insurance
      insuredCount,
      arrearsTotal,
      // real estate
      projectsCount,
      buildingsCount,
      unitsCount,
      customersCount,
    ] = await Promise.all([
      // sales
      countWhere(
        contractsTable,
        scoped(notDel(contractsTable.isDeleted), contractsTable.companyId, eq(contractsTable.status, "active")),
      ),
      sumWhere(
        contractsTable,
        contractsTable.totalPrice,
        scoped(notDel(contractsTable.isDeleted), contractsTable.companyId),
      ),
      db
        .select({ code: unitStatusesTable.code, value: sql<number>`count(*)::int` })
        .from(unitsTable)
        .leftJoin(unitStatusesTable, eq(unitsTable.unitStatusId, unitStatusesTable.id))
        .where(scoped(notDel(unitsTable.isDeleted), unitsTable.companyId))
        .groupBy(unitStatusesTable.code),
      countWhere(
        reservationsTable,
        scoped(
          notDel(reservationsTable.isDeleted),
          reservationsTable.companyId,
          ne(reservationsTable.status, "cancelled"),
        ),
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
      sumWhere(
        cashboxesTable,
        cashboxesTable.currentBalance,
        scoped(notDel(cashboxesTable.isDeleted), cashboxesTable.companyId),
      ),
      sumWhere(
        bankAccountsTable,
        bankAccountsTable.currentBalance,
        scoped(notDel(bankAccountsTable.isDeleted), bankAccountsTable.companyId),
      ),
      db
        .select({
          value: sql<string>`coalesce(sum(${customerInvoicesTable.total} - ${customerInvoicesTable.paidAmount}), 0)::text`,
        })
        .from(customerInvoicesTable)
        .where(
          scoped(
            notDel(customerInvoicesTable.isDeleted),
            customerInvoicesTable.companyId,
            ne(customerInvoicesTable.status, "cancelled"),
          ),
        ),
      db
        .select({
          value: sql<string>`coalesce(sum(${supplierInvoicesTable.total} - ${supplierInvoicesTable.paidAmount}), 0)::text`,
        })
        .from(supplierInvoicesTable)
        .where(
          scoped(
            notDel(supplierInvoicesTable.isDeleted),
            supplierInvoicesTable.companyId,
            ne(supplierInvoicesTable.status, "cancelled"),
          ),
        ),
      // accounting
      countWhere(journalEntriesTable, scoped(notDel(journalEntriesTable.isDeleted), journalEntriesTable.companyId)),
      countWhere(
        journalEntriesTable,
        scoped(notDel(journalEntriesTable.isDeleted), journalEntriesTable.companyId, eq(journalEntriesTable.status, "draft")),
      ),
      countWhere(
        journalEntriesTable,
        scoped(notDel(journalEntriesTable.isDeleted), journalEntriesTable.companyId, eq(journalEntriesTable.status, "posted")),
      ),
      countWhere(
        fiscalPeriodsTable,
        scoped(notDel(fiscalPeriodsTable.isDeleted), fiscalPeriodsTable.companyId, eq(fiscalPeriodsTable.status, "open")),
      ),
      // crm
      countWhere(leadsTable, scoped(notDel(leadsTable.isDeleted), leadsTable.companyId)),
      countWhere(leadsTable, scoped(notDel(leadsTable.isDeleted), leadsTable.companyId, eq(leadsTable.status, "new"))),
      countWhere(leadsTable, scoped(notDel(leadsTable.isDeleted), leadsTable.companyId, eq(leadsTable.status, "won"))),
      // construction
      countWhere(contractorContractsTable, scoped(notDel(contractorContractsTable.isDeleted), contractorContractsTable.companyId)),
      sumWhere(
        contractorContractsTable,
        contractorContractsTable.contractValue,
        scoped(notDel(contractorContractsTable.isDeleted), contractorContractsTable.companyId),
      ),
      sumWhere(
        paymentCertificatesTable,
        paymentCertificatesTable.netAmount,
        scoped(notDel(paymentCertificatesTable.isDeleted), paymentCertificatesTable.companyId),
      ),
      // procurement
      countWhere(suppliersTable, scoped(notDel(suppliersTable.isDeleted), suppliersTable.companyId)),
      countWhere(
        purchaseOrdersTable,
        scoped(notDel(purchaseOrdersTable.isDeleted), purchaseOrdersTable.companyId, ne(purchaseOrdersTable.status, "completed")),
      ),
      sumWhere(
        purchaseOrdersTable,
        purchaseOrdersTable.totalAmount,
        scoped(notDel(purchaseOrdersTable.isDeleted), purchaseOrdersTable.companyId),
      ),
      countWhere(
        procurementApprovalsTable,
        scoped(notDel(procurementApprovalsTable.isDeleted), procurementApprovalsTable.companyId, eq(procurementApprovalsTable.status, "pending")),
      ),
      // inventory
      countWhere(inventoryItemsTable, scoped(notDel(inventoryItemsTable.isDeleted), inventoryItemsTable.companyId)),
      // hr
      countWhere(employeesTable, scoped(notDel(employeesTable.isDeleted), employeesTable.companyId)),
      countWhere(employeesTable, scoped(notDel(employeesTable.isDeleted), employeesTable.companyId, eq(employeesTable.status, "active"))),
      countWhere(departmentsTable, scoped(notDel(departmentsTable.isDeleted), departmentsTable.companyId)),
      countWhere(leaveRequestsTable, scoped(notDel(leaveRequestsTable.isDeleted), leaveRequestsTable.companyId, eq(leaveRequestsTable.status, "submitted"))),
      sumWhere(
        payrollRunsTable,
        payrollRunsTable.totalNet,
        scoped(notDel(payrollRunsTable.isDeleted), payrollRunsTable.companyId, eq(payrollRunsTable.status, "posted")),
      ),
      // legal
      countWhere(legalCasesTable, scoped(notDel(legalCasesTable.isDeleted), legalCasesTable.companyId)),
      countWhere(
        legalCasesTable,
        scoped(
          notDel(legalCasesTable.isDeleted),
          legalCasesTable.companyId,
          sql`${legalCasesTable.status} not in ('closed', 'won', 'lost', 'settled')` as SQL,
        ),
      ),
      countWhere(legalNoticesTable, scoped(notDel(legalNoticesTable.isDeleted), legalNoticesTable.companyId, eq(legalNoticesTable.status, "draft"))),
      sumWhere(legalClaimsTable, legalClaimsTable.amount, scoped(notDel(legalClaimsTable.isDeleted), legalClaimsTable.companyId)),
      // customer service
      countWhere(serviceEscalationsTable, scoped(notDel(serviceEscalationsTable.isDeleted), serviceEscalationsTable.companyId, eq(serviceEscalationsTable.status, "open"))),
      countWhere(complaintsTable, scoped(notDel(complaintsTable.isDeleted), complaintsTable.companyId)),
      // fixed assets
      countWhere(fixedAssetsTable, scoped(notDel(fixedAssetsTable.isDeleted), fixedAssetsTable.companyId)),
      sumWhere(fixedAssetsTable, fixedAssetsTable.bookValue, scoped(notDel(fixedAssetsTable.isDeleted), fixedAssetsTable.companyId)),
      // insurance
      countWhere(employeeInsurancesTable, scoped(notDel(employeeInsurancesTable.isDeleted), employeeInsurancesTable.companyId, eq(employeeInsurancesTable.insuranceStatus, "active"))),
      sumWhere(insuranceArrearsTable, insuranceArrearsTable.amount, scoped(notDel(insuranceArrearsTable.isDeleted), insuranceArrearsTable.companyId, eq(insuranceArrearsTable.status, "outstanding"))),
      // real estate
      countWhere(projectsTable, scoped(notDel(projectsTable.isDeleted), projectsTable.companyId)),
      countWhere(buildingsTable, scoped(notDel(buildingsTable.isDeleted), buildingsTable.companyId)),
      countWhere(unitsTable, scoped(notDel(unitsTable.isDeleted), unitsTable.companyId)),
      countWhere(customersTable, scoped(notDel(customersTable.isDeleted), customersTable.companyId)),
    ]);

    const byStatus = (code: string): number => unitStatusRows.find((r) => r.code === code)?.value ?? 0;
    const coll = collTotals[0] ?? { due: "0", paid: "0", outstanding: "0" };
    const overdue = overdueRow[0] ?? { amount: "0", cnt: 0 };
    const dueNum = Number(coll.due);
    const paidNum = Number(coll.paid);
    const collectionRate = dueNum > 0 ? ((paidNum / dueNum) * 100).toFixed(1) : "0.0";
    const overdueAmount = overdue.amount;
    const overdueCount = overdue.cnt;

    const departments: Department[] = [
      {
        key: "sales",
        kpis: [
          kpi("activeContracts", activeContracts, "count"),
          kpi("contractValue", contractValue, "money"),
          kpi("unitsSold", byStatus("sold"), "count"),
          kpi("unitsReserved", byStatus("reserved"), "count", byStatus("reserved") > 0 ? "warning" : null),
          kpi("unitsAvailable", byStatus("available"), "count", "success"),
          kpi("activeReservations", activeReservations, "count"),
        ],
      },
      {
        key: "collections",
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
        kpis: [
          kpi("cashOnHand", cashOnHand, "money"),
          kpi("bankBalance", bankBalance, "money"),
          kpi("receivables", arRow[0]?.value ?? "0", "money", Number(arRow[0]?.value ?? "0") > 0 ? "warning" : null),
          kpi("payables", apRow[0]?.value ?? "0", "money", Number(apRow[0]?.value ?? "0") > 0 ? "warning" : null),
        ],
      },
      {
        key: "accounting",
        kpis: [
          kpi("journalEntries", jeTotal, "count"),
          kpi("draftEntries", jeDraft, "count", jeDraft > 0 ? "warning" : null),
          kpi("postedEntries", jePosted, "count"),
          kpi("openPeriods", openPeriods, "count"),
        ],
      },
      {
        key: "crm",
        kpis: [
          kpi("totalLeads", leadsTotal, "count"),
          kpi("newLeads", leadsNew, "count"),
          kpi("wonLeads", leadsWon, "count", "success"),
        ],
      },
      {
        key: "realEstate",
        kpis: [
          kpi("projects", projectsCount, "count"),
          kpi("buildings", buildingsCount, "count"),
          kpi("units", unitsCount, "count"),
          kpi("customers", customersCount, "count"),
        ],
      },
      {
        key: "construction",
        kpis: [
          kpi("contractorContracts", contractorContracts, "count"),
          kpi("contractValue", contractorValue, "money"),
          kpi("certifiedValue", certifiedValue, "money"),
        ],
      },
      {
        key: "procurement",
        kpis: [
          kpi("suppliers", suppliersCount, "count"),
          kpi("openPurchaseOrders", openPurchaseOrders, "count"),
          kpi("purchaseVolume", purchaseVolume, "money"),
          kpi("pendingApprovals", pendingApprovals, "count", pendingApprovals > 0 ? "warning" : null),
        ],
      },
      {
        key: "inventory",
        kpis: [kpi("items", inventoryItems, "count")],
      },
      {
        key: "hr",
        kpis: [
          kpi("employees", employeesCount, "count"),
          kpi("activeEmployees", activeEmployees, "count", "success"),
          kpi("departments", departmentsCount, "count"),
          kpi("pendingLeave", pendingLeave, "count", pendingLeave > 0 ? "warning" : null),
          kpi("payrollPosted", payrollPosted, "money"),
        ],
      },
      {
        key: "legal",
        kpis: [
          kpi("cases", legalCasesCount, "count"),
          kpi("openCases", openLegalCases, "count", openLegalCases > 0 ? "warning" : null),
          kpi("pendingNotices", pendingNotices, "count"),
          kpi("claimsAmount", claimsAmount, "money"),
        ],
      },
      {
        key: "customerService",
        kpis: [
          kpi("openEscalations", openEscalations, "count", openEscalations > 0 ? "warning" : null),
          kpi("complaints", complaintsCount, "count"),
        ],
      },
      {
        key: "fixedAssets",
        kpis: [
          kpi("assets", fixedAssetsCount, "count"),
          kpi("bookValue", fixedAssetsValue, "money"),
        ],
      },
      {
        key: "insurance",
        kpis: [
          kpi("insured", insuredCount, "count"),
          kpi("arrears", arrearsTotal, "money", Number(arrearsTotal) > 0 ? "danger" : null),
        ],
      },
    ];

    const payload = {
      generatedAt: new Date().toISOString(),
      departments,
    };

    res.json(GetExecutiveOversightResponse.parse(payload));
  },
);

export default router;
