import { Router, type IRouter, type Request } from "express";
import { and, eq, ne, lt, gte, lte, inArray, count, sql, desc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  db,
  contractsTable,
  reservationsTable,
  leadsTable,
  unitsTable,
  unitStatusesTable,
  projectsTable,
  customersTable,
  installmentSchedulesTable,
  installmentCollectionsTable,
  cashboxesTable,
  bankAccountsTable,
  treasuryTransactionsTable,
  bankTransactionsTable,
  customerInvoicesTable,
  supplierInvoicesTable,
  contractorContractsTable,
  workProgressUpdatesTable,
  paymentCertificatesTable,
  purchaseOrdersTable,
  suppliersTable,
  inventoryItemsTable,
  inventoryLedgerTable,
  employeesTable,
  departmentsTable,
  payrollRunsTable,
  attendanceRecordsTable,
  accountsTable,
  journalEntriesTable,
  journalEntryLinesTable,
} from "@workspace/db";
import {
  GetExecutiveDashboardResponse,
  GetSalesAnalyticsResponse,
  GetCollectionAnalyticsResponse,
  GetConstructionAnalyticsResponse,
  GetProcurementAnalyticsResponse,
  GetInventoryAnalyticsResponse,
  GetHrAnalyticsResponse,
  GetFinancialAnalyticsResponse,
} from "@workspace/api-zod";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use("/bi", requireAuth);

type Filters = {
  companyId: string | null;
  from: string | null;
  to: string | null;
  projectId: string | null;
  branchId: string | null;
};

function parseFilters(req: Request): Filters {
  const q = req.query as Record<string, unknown>;
  const str = (k: string): string | null =>
    typeof q[k] === "string" && q[k] ? (q[k] as string) : null;
  return {
    companyId: str("companyId"),
    from: str("from"),
    to: str("to"),
    projectId: str("projectId"),
    branchId: str("branchId"),
  };
}

const today = (): string => new Date().toISOString().slice(0, 10);

const moneySum = (col: unknown): SQL<string> =>
  sql<string>`coalesce(sum(${col}), 0)::text`;
const countText = (): SQL<string> => sql<string>`count(*)::text`;
const monthExpr = (col: unknown): SQL<string> =>
  sql<string>`to_char(${col}, 'YYYY-MM')`;

// Scope the permission guard to this router's own "/bi" paths. Routers are
// mounted with `router.use(biRouter)` (no path prefix), and Express runs a
// sub-router's `use` middleware for every request that passes through it — even
// ones it has no matching route for. A bare `router.use(requirePermission(...))`
// would therefore 403 every route mounted after this one (notifications,
// master-data, etc.) for any user lacking "bi.view". Binding it to "/bi" keeps
// the guard on BI endpoints only.
router.use("/bi", requirePermission("bi.view"));

// ---------------------------------------------------------------------------
// Executive dashboard
// ---------------------------------------------------------------------------
router.get("/bi/executive-dashboard", async (req, res): Promise<void> => {
  const f = parseFilters(req);
  const t = today();

  const contractScope: SQL[] = [eq(contractsTable.isDeleted, false)];
  if (f.companyId) contractScope.push(eq(contractsTable.companyId, f.companyId));
  if (f.branchId) contractScope.push(eq(contractsTable.branchId, f.branchId));
  if (f.from) contractScope.push(gte(contractsTable.contractDate, f.from));
  if (f.to) contractScope.push(lte(contractsTable.contractDate, f.to));

  const unitScope: SQL[] = [eq(unitsTable.isDeleted, false)];
  if (f.companyId) unitScope.push(eq(unitsTable.companyId, f.companyId));
  if (f.projectId) unitScope.push(eq(unitsTable.projectId, f.projectId));

  const schedScope: SQL[] = [eq(installmentSchedulesTable.isDeleted, false)];
  if (f.companyId) schedScope.push(eq(installmentSchedulesTable.companyId, f.companyId));

  const collScope: SQL[] = [eq(installmentCollectionsTable.isDeleted, false)];
  if (f.companyId) collScope.push(eq(installmentCollectionsTable.companyId, f.companyId));
  if (f.from) collScope.push(gte(installmentCollectionsTable.collectionDate, f.from));
  if (f.to) collScope.push(lte(installmentCollectionsTable.collectionDate, f.to));

  const cashScope: SQL[] = [eq(cashboxesTable.isDeleted, false)];
  if (f.companyId) cashScope.push(eq(cashboxesTable.companyId, f.companyId));
  const bankScope: SQL[] = [eq(bankAccountsTable.isDeleted, false)];
  if (f.companyId) bankScope.push(eq(bankAccountsTable.companyId, f.companyId));

  const ciScope: SQL[] = [eq(customerInvoicesTable.isDeleted, false), ne(customerInvoicesTable.status, "cancelled")];
  if (f.companyId) ciScope.push(eq(customerInvoicesTable.companyId, f.companyId));
  const siScope: SQL[] = [eq(supplierInvoicesTable.isDeleted, false), ne(supplierInvoicesTable.status, "cancelled")];
  if (f.companyId) siScope.push(eq(supplierInvoicesTable.companyId, f.companyId));

  const empScope: SQL[] = [eq(employeesTable.isDeleted, false), eq(employeesTable.status, "active")];
  if (f.companyId) empScope.push(eq(employeesTable.companyId, f.companyId));

  const projScope: SQL[] = [eq(projectsTable.isDeleted, false)];
  if (f.companyId) projScope.push(eq(projectsTable.companyId, f.companyId));

  const [
    salesRow,
    paidRow,
    outstandingRow,
    statusRows,
    projectsRow,
    activeContractsRow,
    overdueRow,
    cashRow,
    bankRow,
    arRow,
    apRow,
    employeesRow,
    salesTrend,
    collectionTrend,
  ] = await Promise.all([
    db.select({ value: moneySum(contractsTable.totalPrice) }).from(contractsTable).where(and(...contractScope)),
    db.select({ value: moneySum(installmentSchedulesTable.paidAmount) }).from(installmentSchedulesTable).where(and(...schedScope)),
    db
      .select({ value: sql<string>`coalesce(sum(${installmentSchedulesTable.amount} - ${installmentSchedulesTable.paidAmount}), 0)::text` })
      .from(installmentSchedulesTable)
      .where(and(...schedScope, ne(installmentSchedulesTable.status, "paid"))),
    db
      .select({ code: unitStatusesTable.code, value: count() })
      .from(unitsTable)
      .leftJoin(unitStatusesTable, eq(unitsTable.unitStatusId, unitStatusesTable.id))
      .where(and(...unitScope))
      .groupBy(unitStatusesTable.code),
    db.select({ value: count() }).from(projectsTable).where(and(...projScope)),
    db.select({ value: count() }).from(contractsTable).where(and(...contractScope, eq(contractsTable.status, "active"))),
    db
      .select({ value: count() })
      .from(installmentSchedulesTable)
      .where(and(...schedScope, ne(installmentSchedulesTable.status, "paid"), lt(installmentSchedulesTable.dueDate, t))),
    db.select({ value: moneySum(cashboxesTable.currentBalance) }).from(cashboxesTable).where(and(...cashScope)),
    db.select({ value: moneySum(bankAccountsTable.currentBalance) }).from(bankAccountsTable).where(and(...bankScope)),
    db
      .select({ value: sql<string>`coalesce(sum(${customerInvoicesTable.total} - ${customerInvoicesTable.paidAmount}), 0)::text` })
      .from(customerInvoicesTable)
      .where(and(...ciScope)),
    db
      .select({ value: sql<string>`coalesce(sum(${supplierInvoicesTable.total} - ${supplierInvoicesTable.paidAmount}), 0)::text` })
      .from(supplierInvoicesTable)
      .where(and(...siScope)),
    db.select({ value: count() }).from(employeesTable).where(and(...empScope)),
    db
      .select({ period: monthExpr(contractsTable.contractDate), value: moneySum(contractsTable.totalPrice) })
      .from(contractsTable)
      .where(and(...contractScope))
      .groupBy(monthExpr(contractsTable.contractDate))
      .orderBy(monthExpr(contractsTable.contractDate)),
    db
      .select({ period: monthExpr(installmentCollectionsTable.collectionDate), value: moneySum(installmentCollectionsTable.amount) })
      .from(installmentCollectionsTable)
      .where(and(...collScope))
      .groupBy(monthExpr(installmentCollectionsTable.collectionDate))
      .orderBy(monthExpr(installmentCollectionsTable.collectionDate)),
  ]);

  const byStatus = (code: string): number => statusRows.find((r) => r.code === code)?.value ?? 0;

  res.json(
    GetExecutiveDashboardResponse.parse({
      totalSalesValue: salesRow[0]?.value ?? "0",
      totalCollected: paidRow[0]?.value ?? "0",
      totalOutstanding: outstandingRow[0]?.value ?? "0",
      unitsSold: byStatus("sold"),
      unitsAvailable: byStatus("available"),
      unitsReserved: byStatus("reserved"),
      activeProjects: projectsRow[0]?.value ?? 0,
      activeContracts: activeContractsRow[0]?.value ?? 0,
      overdueInstallments: overdueRow[0]?.value ?? 0,
      cashOnHand: cashRow[0]?.value ?? "0",
      bankBalance: bankRow[0]?.value ?? "0",
      arOutstanding: arRow[0]?.value ?? "0",
      apOutstanding: apRow[0]?.value ?? "0",
      employeeCount: employeesRow[0]?.value ?? 0,
      salesTrend: salesTrend.map((r) => ({ period: r.period, value: r.value })),
      collectionTrend: collectionTrend.map((r) => ({ period: r.period, value: r.value })),
      unitStatusBreakdown: statusRows.map((r) => ({ key: r.code ?? "unknown", value: String(r.value) })),
    }),
  );
});

// ---------------------------------------------------------------------------
// Sales analytics
// ---------------------------------------------------------------------------
router.get("/bi/sales-analytics", async (req, res): Promise<void> => {
  const f = parseFilters(req);

  const cScope: SQL[] = [eq(contractsTable.isDeleted, false)];
  if (f.companyId) cScope.push(eq(contractsTable.companyId, f.companyId));
  if (f.branchId) cScope.push(eq(contractsTable.branchId, f.branchId));
  if (f.from) cScope.push(gte(contractsTable.contractDate, f.from));
  if (f.to) cScope.push(lte(contractsTable.contractDate, f.to));

  const rScope: SQL[] = [eq(reservationsTable.isDeleted, false)];
  if (f.companyId) rScope.push(eq(reservationsTable.companyId, f.companyId));
  if (f.branchId) rScope.push(eq(reservationsTable.branchId, f.branchId));
  if (f.from) rScope.push(gte(reservationsTable.reservationDate, f.from));
  if (f.to) rScope.push(lte(reservationsTable.reservationDate, f.to));

  const lScope: SQL[] = [eq(leadsTable.isDeleted, false)];
  if (f.companyId) lScope.push(eq(leadsTable.companyId, f.companyId));

  const [totalsRow, reservationRow, leadsRow, salesByMonth, salesByProject, salesByStatus] = await Promise.all([
    db
      .select({
        contracts: count(),
        value: moneySum(contractsTable.totalPrice),
        downPayments: moneySum(contractsTable.downPayment),
        avg: sql<string>`coalesce(round(avg(${contractsTable.totalPrice}), 2), 0)::text`,
      })
      .from(contractsTable)
      .where(and(...cScope)),
    db.select({ value: count(), amount: moneySum(reservationsTable.amount) }).from(reservationsTable).where(and(...rScope)),
    db.select({ value: count() }).from(leadsTable).where(and(...lScope)),
    db
      .select({ period: monthExpr(contractsTable.contractDate), value: moneySum(contractsTable.totalPrice), count: count() })
      .from(contractsTable)
      .where(and(...cScope))
      .groupBy(monthExpr(contractsTable.contractDate))
      .orderBy(monthExpr(contractsTable.contractDate)),
    db
      .select({ key: projectsTable.id, label: projectsTable.name, value: moneySum(contractsTable.totalPrice), count: count() })
      .from(contractsTable)
      .innerJoin(unitsTable, eq(unitsTable.id, contractsTable.unitId))
      .leftJoin(projectsTable, eq(projectsTable.id, unitsTable.projectId))
      .where(and(...cScope))
      .groupBy(projectsTable.id, projectsTable.name),
    db
      .select({ key: contractsTable.status, value: moneySum(contractsTable.totalPrice), count: count() })
      .from(contractsTable)
      .where(and(...cScope))
      .groupBy(contractsTable.status),
  ]);

  res.json(
    GetSalesAnalyticsResponse.parse({
      totalContracts: totalsRow[0]?.contracts ?? 0,
      totalContractValue: totalsRow[0]?.value ?? "0",
      totalDownPayments: totalsRow[0]?.downPayments ?? "0",
      avgContractValue: totalsRow[0]?.avg ?? "0",
      reservationsCount: reservationRow[0]?.value ?? 0,
      reservationsValue: reservationRow[0]?.amount ?? "0",
      leadsCount: leadsRow[0]?.value ?? 0,
      salesByMonth: salesByMonth.map((r) => ({ period: r.period, value: r.value, count: r.count })),
      salesByProject: salesByProject.map((r) => ({ key: r.key ?? "none", label: r.label ?? null, value: r.value, count: r.count })),
      salesByStatus: salesByStatus.map((r) => ({ key: r.key, value: r.value, count: r.count })),
    }),
  );
});

// ---------------------------------------------------------------------------
// Collection analytics
// ---------------------------------------------------------------------------
router.get("/bi/collection-analytics", async (req, res): Promise<void> => {
  const f = parseFilters(req);
  const t = today();

  const sScope: SQL[] = [eq(installmentSchedulesTable.isDeleted, false)];
  if (f.companyId) sScope.push(eq(installmentSchedulesTable.companyId, f.companyId));
  if (f.from) sScope.push(gte(installmentSchedulesTable.dueDate, f.from));
  if (f.to) sScope.push(lte(installmentSchedulesTable.dueDate, f.to));

  const cScope: SQL[] = [eq(installmentCollectionsTable.isDeleted, false)];
  if (f.companyId) cScope.push(eq(installmentCollectionsTable.companyId, f.companyId));
  if (f.from) cScope.push(gte(installmentCollectionsTable.collectionDate, f.from));
  if (f.to) cScope.push(lte(installmentCollectionsTable.collectionDate, f.to));

  const [totalsRow, overdueRow, byMonth, byStatus, receiptsByMonth] = await Promise.all([
    db
      .select({
        due: moneySum(installmentSchedulesTable.amount),
        paid: moneySum(installmentSchedulesTable.paidAmount),
        outstanding: sql<string>`coalesce(sum(${installmentSchedulesTable.amount} - ${installmentSchedulesTable.paidAmount}), 0)::text`,
      })
      .from(installmentSchedulesTable)
      .where(and(...sScope)),
    db
      .select({
        amount: sql<string>`coalesce(sum(${installmentSchedulesTable.amount} - ${installmentSchedulesTable.paidAmount}), 0)::text`,
        value: count(),
      })
      .from(installmentSchedulesTable)
      .where(and(...sScope, ne(installmentSchedulesTable.status, "paid"), lt(installmentSchedulesTable.dueDate, t))),
    db
      .select({
        period: monthExpr(installmentSchedulesTable.dueDate),
        primary: moneySum(installmentSchedulesTable.amount),
        secondary: moneySum(installmentSchedulesTable.paidAmount),
      })
      .from(installmentSchedulesTable)
      .where(and(...sScope))
      .groupBy(monthExpr(installmentSchedulesTable.dueDate))
      .orderBy(monthExpr(installmentSchedulesTable.dueDate)),
    db
      .select({ key: installmentSchedulesTable.status, value: moneySum(installmentSchedulesTable.amount), count: count() })
      .from(installmentSchedulesTable)
      .where(and(...sScope))
      .groupBy(installmentSchedulesTable.status),
    db
      .select({ period: monthExpr(installmentCollectionsTable.collectionDate), value: moneySum(installmentCollectionsTable.amount) })
      .from(installmentCollectionsTable)
      .where(and(...cScope))
      .groupBy(monthExpr(installmentCollectionsTable.collectionDate))
      .orderBy(monthExpr(installmentCollectionsTable.collectionDate)),
  ]);

  const due = Number(totalsRow[0]?.due ?? "0");
  const paid = Number(totalsRow[0]?.paid ?? "0");
  const rate = due > 0 ? ((paid / due) * 100).toFixed(2) : "0";

  res.json(
    GetCollectionAnalyticsResponse.parse({
      totalDue: totalsRow[0]?.due ?? "0",
      totalPaid: totalsRow[0]?.paid ?? "0",
      totalOutstanding: totalsRow[0]?.outstanding ?? "0",
      overdueAmount: overdueRow[0]?.amount ?? "0",
      overdueCount: overdueRow[0]?.value ?? 0,
      collectionRate: rate,
      collectionByMonth: byMonth.map((r) => ({ period: r.period, primary: r.primary, secondary: r.secondary })),
      installmentsByStatus: byStatus.map((r) => ({ key: r.key, value: r.value, count: r.count })),
      receiptsByMonth: receiptsByMonth.map((r) => ({ period: r.period, value: r.value })),
    }),
  );
});

// ---------------------------------------------------------------------------
// Construction analytics
// ---------------------------------------------------------------------------
router.get("/bi/construction-analytics", async (req, res): Promise<void> => {
  const f = parseFilters(req);

  const ccScope: SQL[] = [eq(contractorContractsTable.isDeleted, false)];
  if (f.companyId) ccScope.push(eq(contractorContractsTable.companyId, f.companyId));
  if (f.projectId) ccScope.push(eq(contractorContractsTable.projectId, f.projectId));

  const pcScope: SQL[] = [eq(paymentCertificatesTable.isDeleted, false)];
  if (f.companyId) pcScope.push(eq(paymentCertificatesTable.companyId, f.companyId));
  if (f.projectId) pcScope.push(eq(paymentCertificatesTable.projectId, f.projectId));

  const wpScope: SQL[] = [eq(workProgressUpdatesTable.isDeleted, false)];
  if (f.companyId) wpScope.push(eq(workProgressUpdatesTable.companyId, f.companyId));

  const [ccRow, avgRow, pcRow, progressByProject, certByStatus, ccByStatus] = await Promise.all([
    db
      .select({ contracts: count(), value: moneySum(contractorContractsTable.contractValue) })
      .from(contractorContractsTable)
      .where(and(...ccScope)),
    db
      .select({ avg: sql<string>`coalesce(round(avg(${workProgressUpdatesTable.progressPercent}), 2), 0)::text` })
      .from(workProgressUpdatesTable)
      .where(and(...wpScope)),
    db.select({ value: moneySum(paymentCertificatesTable.netAmount) }).from(paymentCertificatesTable).where(and(...pcScope)),
    db
      .select({ key: projectsTable.id, label: projectsTable.name, value: sql<string>`coalesce(round(avg(${workProgressUpdatesTable.progressPercent}), 2), 0)::text` })
      .from(workProgressUpdatesTable)
      .innerJoin(contractorContractsTable, eq(contractorContractsTable.id, workProgressUpdatesTable.contractId))
      .leftJoin(projectsTable, eq(projectsTable.id, contractorContractsTable.projectId))
      .where(and(...wpScope))
      .groupBy(projectsTable.id, projectsTable.name),
    db
      .select({ key: paymentCertificatesTable.status, value: moneySum(paymentCertificatesTable.netAmount), count: count() })
      .from(paymentCertificatesTable)
      .where(and(...pcScope))
      .groupBy(paymentCertificatesTable.status),
    db
      .select({ key: contractorContractsTable.status, value: moneySum(contractorContractsTable.contractValue), count: count() })
      .from(contractorContractsTable)
      .where(and(...ccScope))
      .groupBy(contractorContractsTable.status),
  ]);

  res.json(
    GetConstructionAnalyticsResponse.parse({
      contractorContracts: ccRow[0]?.contracts ?? 0,
      totalContractValue: ccRow[0]?.value ?? "0",
      avgProgress: avgRow[0]?.avg ?? "0",
      paymentCertificatesValue: pcRow[0]?.value ?? "0",
      progressByProject: progressByProject.map((r) => ({ key: r.key ?? "none", label: r.label ?? null, value: r.value })),
      certificatesByStatus: certByStatus.map((r) => ({ key: r.key, value: r.value, count: r.count })),
      contractsByStatus: ccByStatus.map((r) => ({ key: r.key, value: r.value, count: r.count })),
    }),
  );
});

// ---------------------------------------------------------------------------
// Procurement analytics
// ---------------------------------------------------------------------------
router.get("/bi/procurement-analytics", async (req, res): Promise<void> => {
  const f = parseFilters(req);

  const poScope: SQL[] = [eq(purchaseOrdersTable.isDeleted, false)];
  if (f.companyId) poScope.push(eq(purchaseOrdersTable.companyId, f.companyId));
  if (f.from) poScope.push(gte(purchaseOrdersTable.orderDate, f.from));
  if (f.to) poScope.push(lte(purchaseOrdersTable.orderDate, f.to));

  const supScope: SQL[] = [eq(suppliersTable.isDeleted, false)];
  if (f.companyId) supScope.push(eq(suppliersTable.companyId, f.companyId));

  const [poRow, supRow, poByStatus, poByMonth, topSuppliers] = await Promise.all([
    db.select({ orders: count(), value: moneySum(purchaseOrdersTable.totalAmount) }).from(purchaseOrdersTable).where(and(...poScope)),
    db
      .select({ suppliers: count(), avg: sql<string>`coalesce(round(avg(${suppliersTable.rating}), 2), 0)::text` })
      .from(suppliersTable)
      .where(and(...supScope)),
    db
      .select({ key: purchaseOrdersTable.status, value: moneySum(purchaseOrdersTable.totalAmount), count: count() })
      .from(purchaseOrdersTable)
      .where(and(...poScope))
      .groupBy(purchaseOrdersTable.status),
    db
      .select({ period: monthExpr(purchaseOrdersTable.orderDate), value: moneySum(purchaseOrdersTable.totalAmount) })
      .from(purchaseOrdersTable)
      .where(and(...poScope))
      .groupBy(monthExpr(purchaseOrdersTable.orderDate))
      .orderBy(monthExpr(purchaseOrdersTable.orderDate)),
    db
      .select({ key: suppliersTable.id, label: suppliersTable.name, value: moneySum(purchaseOrdersTable.totalAmount), count: count() })
      .from(purchaseOrdersTable)
      .leftJoin(suppliersTable, eq(suppliersTable.id, purchaseOrdersTable.supplierId))
      .where(and(...poScope))
      .groupBy(suppliersTable.id, suppliersTable.name)
      .orderBy(desc(moneySum(purchaseOrdersTable.totalAmount)))
      .limit(10),
  ]);

  res.json(
    GetProcurementAnalyticsResponse.parse({
      purchaseOrders: poRow[0]?.orders ?? 0,
      totalPoValue: poRow[0]?.value ?? "0",
      suppliersCount: supRow[0]?.suppliers ?? 0,
      avgSupplierRating: supRow[0]?.avg ?? "0",
      poByStatus: poByStatus.map((r) => ({ key: r.key, value: r.value, count: r.count })),
      poByMonth: poByMonth.map((r) => ({ period: r.period, value: r.value })),
      topSuppliers: topSuppliers.map((r) => ({ key: r.key ?? "none", label: r.label ?? null, value: r.value, count: r.count })),
    }),
  );
});

// ---------------------------------------------------------------------------
// Inventory analytics
// ---------------------------------------------------------------------------
router.get("/bi/inventory-analytics", async (req, res): Promise<void> => {
  const f = parseFilters(req);
  const company = f.companyId;

  const itemScope: SQL[] = [eq(inventoryItemsTable.isDeleted, false)];
  if (company) itemScope.push(eq(inventoryItemsTable.companyId, company));

  const companyClause = company ? sql`where company_id = ${company}` : sql``;

  const [itemsRow, latest, valueByItem] = await Promise.all([
    db.select({ value: count() }).from(inventoryItemsTable).where(and(...itemScope)),
    db.execute(sql`
      select i.id as id, i.name as name, i.name_ar as name_ar,
             coalesce(i.reorder_point, 0) as reorder_point,
             coalesce(l.bq, 0) as balance_quantity,
             coalesce(l.bv, 0) as balance_value
      from inventory_items i
      left join (
        select distinct on (item_id) item_id, balance_quantity as bq, balance_value as bv
        from inventory_ledger ${companyClause}
        order by item_id, transaction_date desc nulls last, created_at desc
      ) l on l.item_id = i.id
      where i.is_deleted = false ${company ? sql`and i.company_id = ${company}` : sql``}
    `),
    db
      .select({ key: inventoryItemsTable.id, label: inventoryItemsTable.name, value: moneySum(inventoryItemsTable.costPrice) })
      .from(inventoryItemsTable)
      .where(and(...itemScope))
      .groupBy(inventoryItemsTable.id, inventoryItemsTable.name)
      .orderBy(desc(moneySum(inventoryItemsTable.costPrice)))
      .limit(10),
  ]);

  const rows = (latest.rows ?? latest) as Array<{
    id: string;
    name: string;
    name_ar: string;
    reorder_point: string | number;
    balance_quantity: string | number;
    balance_value: string | number;
  }>;

  let totalStockValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  const lowStockItems: Array<{ key: string; label: string; value: string }> = [];
  for (const r of rows) {
    const bq = Number(r.balance_quantity);
    const bv = Number(r.balance_value);
    const rp = Number(r.reorder_point);
    totalStockValue += Number.isFinite(bv) ? bv : 0;
    if (bq <= 0) outOfStockCount += 1;
    if (rp > 0 && bq <= rp) {
      lowStockCount += 1;
      if (lowStockItems.length < 20) lowStockItems.push({ key: r.id, label: r.name, value: String(bq) });
    }
  }

  res.json(
    GetInventoryAnalyticsResponse.parse({
      totalItems: itemsRow[0]?.value ?? 0,
      totalStockValue: totalStockValue.toFixed(2),
      lowStockCount,
      outOfStockCount,
      valueByItem: valueByItem.map((r) => ({ key: r.key, label: r.label ?? null, value: r.value })),
      lowStockItems,
    }),
  );
});

// ---------------------------------------------------------------------------
// HR analytics
// ---------------------------------------------------------------------------
router.get("/bi/hr-analytics", async (req, res): Promise<void> => {
  const f = parseFilters(req);

  const empScope: SQL[] = [eq(employeesTable.isDeleted, false)];
  if (f.companyId) empScope.push(eq(employeesTable.companyId, f.companyId));

  const prScope: SQL[] = [eq(payrollRunsTable.isDeleted, false)];
  if (f.companyId) prScope.push(eq(payrollRunsTable.companyId, f.companyId));
  if (f.from) prScope.push(gte(payrollRunsTable.runDate, f.from));
  if (f.to) prScope.push(lte(payrollRunsTable.runDate, f.to));

  const deptScope: SQL[] = [eq(departmentsTable.isDeleted, false)];
  if (f.companyId) deptScope.push(eq(departmentsTable.companyId, f.companyId));

  const attScope: SQL[] = [eq(attendanceRecordsTable.isDeleted, false)];
  if (f.companyId) attScope.push(eq(attendanceRecordsTable.companyId, f.companyId));

  const [empRow, activeRow, payrollRow, salaryRow, deptRow, headByDept, payrollByMonth, attendance] = await Promise.all([
    db.select({ value: count() }).from(employeesTable).where(and(...empScope)),
    db.select({ value: count() }).from(employeesTable).where(and(...empScope, eq(employeesTable.status, "active"))),
    db.select({ value: moneySum(payrollRunsTable.totalNet) }).from(payrollRunsTable).where(and(...prScope)),
    db
      .select({ avg: sql<string>`coalesce(round(avg(${employeesTable.basicSalary}), 2), 0)::text` })
      .from(employeesTable)
      .where(and(...empScope)),
    db.select({ value: count() }).from(departmentsTable).where(and(...deptScope)),
    db
      .select({ key: departmentsTable.id, label: departmentsTable.name, value: countText(), count: count() })
      .from(employeesTable)
      .leftJoin(departmentsTable, eq(departmentsTable.id, employeesTable.departmentId))
      .where(and(...empScope))
      .groupBy(departmentsTable.id, departmentsTable.name),
    db
      .select({ period: monthExpr(payrollRunsTable.runDate), value: moneySum(payrollRunsTable.totalNet) })
      .from(payrollRunsTable)
      .where(and(...prScope))
      .groupBy(monthExpr(payrollRunsTable.runDate))
      .orderBy(monthExpr(payrollRunsTable.runDate)),
    db
      .select({ key: attendanceRecordsTable.status, value: countText(), count: count() })
      .from(attendanceRecordsTable)
      .where(and(...attScope))
      .groupBy(attendanceRecordsTable.status),
  ]);

  res.json(
    GetHrAnalyticsResponse.parse({
      employeeCount: empRow[0]?.value ?? 0,
      activeEmployees: activeRow[0]?.value ?? 0,
      totalPayroll: payrollRow[0]?.value ?? "0",
      avgSalary: salaryRow[0]?.avg ?? "0",
      departmentsCount: deptRow[0]?.value ?? 0,
      headcountByDepartment: headByDept.map((r) => ({ key: r.key ?? "none", label: r.label ?? null, value: r.value, count: r.count })),
      payrollByMonth: payrollByMonth.map((r) => ({ period: r.period, value: r.value })),
      attendanceBreakdown: attendance.map((r) => ({ key: r.key, value: r.value, count: r.count })),
    }),
  );
});

// ---------------------------------------------------------------------------
// Financial analytics
// ---------------------------------------------------------------------------
router.get("/bi/financial-analytics", async (req, res): Promise<void> => {
  const f = parseFilters(req);

  const cashScope: SQL[] = [eq(cashboxesTable.isDeleted, false)];
  if (f.companyId) cashScope.push(eq(cashboxesTable.companyId, f.companyId));
  const bankScope: SQL[] = [eq(bankAccountsTable.isDeleted, false)];
  if (f.companyId) bankScope.push(eq(bankAccountsTable.companyId, f.companyId));
  const ciScope: SQL[] = [eq(customerInvoicesTable.isDeleted, false), ne(customerInvoicesTable.status, "cancelled")];
  if (f.companyId) ciScope.push(eq(customerInvoicesTable.companyId, f.companyId));
  const siScope: SQL[] = [eq(supplierInvoicesTable.isDeleted, false), ne(supplierInvoicesTable.status, "cancelled")];
  if (f.companyId) siScope.push(eq(supplierInvoicesTable.companyId, f.companyId));

  const entryScope: SQL[] = [inArray(journalEntriesTable.status, ["posted", "reversed"])];
  if (f.companyId) entryScope.push(eq(journalEntriesTable.companyId, f.companyId));
  if (f.from) entryScope.push(gte(journalEntriesTable.entryDate, f.from));
  if (f.to) entryScope.push(lte(journalEntriesTable.entryDate, f.to));

  const netByTypeExpr = sql<string>`coalesce(sum(${journalEntryLinesTable.debit} - ${journalEntryLinesTable.credit}), 0)::text`;

  const treasuryScope: SQL[] = [eq(treasuryTransactionsTable.isDeleted, false)];
  if (f.companyId) treasuryScope.push(eq(treasuryTransactionsTable.companyId, f.companyId));
  if (f.from) treasuryScope.push(gte(treasuryTransactionsTable.transactionDate, f.from));
  if (f.to) treasuryScope.push(lte(treasuryTransactionsTable.transactionDate, f.to));
  const bankTxScope: SQL[] = [eq(bankTransactionsTable.isDeleted, false)];
  if (f.companyId) bankTxScope.push(eq(bankTransactionsTable.companyId, f.companyId));
  if (f.from) bankTxScope.push(gte(bankTransactionsTable.transactionDate, f.from));
  if (f.to) bankTxScope.push(lte(bankTransactionsTable.transactionDate, f.to));

  const [cashRow, bankRow, arRow, apRow, byType, byTypeMonth, treasuryFlow, bankFlow] = await Promise.all([
    db.select({ value: moneySum(cashboxesTable.currentBalance) }).from(cashboxesTable).where(and(...cashScope)),
    db.select({ value: moneySum(bankAccountsTable.currentBalance) }).from(bankAccountsTable).where(and(...bankScope)),
    db
      .select({ value: sql<string>`coalesce(sum(${customerInvoicesTable.total} - ${customerInvoicesTable.paidAmount}), 0)::text` })
      .from(customerInvoicesTable)
      .where(and(...ciScope)),
    db
      .select({ value: sql<string>`coalesce(sum(${supplierInvoicesTable.total} - ${supplierInvoicesTable.paidAmount}), 0)::text` })
      .from(supplierInvoicesTable)
      .where(and(...siScope)),
    db
      .select({ type: accountsTable.type, net: netByTypeExpr })
      .from(journalEntryLinesTable)
      .innerJoin(journalEntriesTable, eq(journalEntriesTable.id, journalEntryLinesTable.entryId))
      .innerJoin(accountsTable, eq(accountsTable.id, journalEntryLinesTable.accountId))
      .where(and(...entryScope))
      .groupBy(accountsTable.type),
    db
      .select({ period: monthExpr(journalEntriesTable.entryDate), type: accountsTable.type, net: netByTypeExpr })
      .from(journalEntryLinesTable)
      .innerJoin(journalEntriesTable, eq(journalEntriesTable.id, journalEntryLinesTable.entryId))
      .innerJoin(accountsTable, eq(accountsTable.id, journalEntryLinesTable.accountId))
      .where(and(...entryScope, inArray(accountsTable.type, ["revenue", "expense"])))
      .groupBy(monthExpr(journalEntriesTable.entryDate), accountsTable.type)
      .orderBy(monthExpr(journalEntriesTable.entryDate)),
    db
      .select({ period: monthExpr(treasuryTransactionsTable.transactionDate), type: treasuryTransactionsTable.type, value: moneySum(treasuryTransactionsTable.amount) })
      .from(treasuryTransactionsTable)
      .where(and(...treasuryScope))
      .groupBy(monthExpr(treasuryTransactionsTable.transactionDate), treasuryTransactionsTable.type),
    db
      .select({ period: monthExpr(bankTransactionsTable.transactionDate), type: bankTransactionsTable.type, value: moneySum(bankTransactionsTable.amount) })
      .from(bankTransactionsTable)
      .where(and(...bankTxScope))
      .groupBy(monthExpr(bankTransactionsTable.transactionDate), bankTransactionsTable.type),
  ]);

  const netOf = (type: string): number => Number(byType.find((r) => r.type === type)?.net ?? "0");
  const totalRevenue = -netOf("revenue");
  const totalExpenses = netOf("expense");
  const netIncome = totalRevenue - totalExpenses;

  const accountTypeBreakdown = byType.map((r) => {
    const net = Number(r.net);
    const value = r.type === "asset" || r.type === "expense" ? net : -net;
    return { key: r.type, value: value.toFixed(2) };
  });

  const revExpMap = new Map<string, { primary: number; secondary: number }>();
  for (const r of byTypeMonth) {
    const slot = revExpMap.get(r.period) ?? { primary: 0, secondary: 0 };
    if (r.type === "revenue") slot.primary += -Number(r.net);
    else if (r.type === "expense") slot.secondary += Number(r.net);
    revExpMap.set(r.period, slot);
  }
  const revenueVsExpense = [...revExpMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, v]) => ({ period, primary: v.primary.toFixed(2), secondary: v.secondary.toFixed(2) }));

  const flowMap = new Map<string, { primary: number; secondary: number }>();
  for (const r of [...treasuryFlow, ...bankFlow]) {
    const slot = flowMap.get(r.period) ?? { primary: 0, secondary: 0 };
    if (r.type === "in") slot.primary += Number(r.value);
    else slot.secondary += Number(r.value);
    flowMap.set(r.period, slot);
  }
  const cashFlowTrend = [...flowMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, v]) => ({ period, primary: v.primary.toFixed(2), secondary: v.secondary.toFixed(2) }));

  res.json(
    GetFinancialAnalyticsResponse.parse({
      cashBalance: cashRow[0]?.value ?? "0",
      bankBalance: bankRow[0]?.value ?? "0",
      totalRevenue: totalRevenue.toFixed(2),
      totalExpenses: totalExpenses.toFixed(2),
      netIncome: netIncome.toFixed(2),
      arOutstanding: arRow[0]?.value ?? "0",
      apOutstanding: apRow[0]?.value ?? "0",
      revenueVsExpense,
      accountTypeBreakdown,
      cashFlowTrend,
    }),
  );
});

export default router;
