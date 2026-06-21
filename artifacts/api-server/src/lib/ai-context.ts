import { and, eq, ne, lt, count, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  db,
  contractsTable,
  reservationsTable,
  leadsTable,
  unitsTable,
  unitStatusesTable,
  projectsTable,
  installmentSchedulesTable,
  installmentCollectionsTable,
  cashboxesTable,
  bankAccountsTable,
  customerInvoicesTable,
  supplierInvoicesTable,
  contractorContractsTable,
  purchaseOrdersTable,
  suppliersTable,
  inventoryItemsTable,
  employeesTable,
  departmentsTable,
  payrollRunsTable,
  fixedAssetsTable,
  landParcelsTable,
  legalContractsTable,
  treasuryTransactionsTable,
  documentsTable,
  administrativeTasksTable,
  complaintsTable,
  handoverRequestsTable,
  marketingCampaignsTable,
} from "@workspace/db";
import type { AuthUser } from "./auth";

export type ContextFilters = {
  companyId: string | null;
  from: string | null;
  to: string | null;
  projectId: string | null;
  branchId: string | null;
};

const moneySum = (col: unknown): SQL<string> =>
  sql<string>`coalesce(sum(${col}), 0)::text`;
const today = (): string => new Date().toISOString().slice(0, 10);

/**
 * Authorization is enforced at the *metric* level, not the domain level. A
 * domain (e.g. "sales") groups several metrics that each map to a distinct
 * module permission (contracts.view, reservations.view, leads.view). The AI must
 * only ground on figures the user could already read in the app, so every
 * individual metric below is gated by `has(user, <its own permission>)`.
 *
 * `"*"` (super admin) and `"bi.view"` (the cross-module BI dashboard permission,
 * which legitimately surfaces every aggregate) are broad grants. Any other user
 * sees only the metrics whose specific module permission they hold — e.g. a user
 * with just `leads.view` gets lead counts and nothing else from the sales domain.
 */
function has(user: AuthUser, permission: string): boolean {
  const p = user.permissions;
  return p.includes("*") || p.includes("bi.view") || p.includes(permission);
}

/** True when the user can see at least one metric in the given domain. */
function canAny(user: AuthUser, permissions: string[]): boolean {
  return permissions.some((perm) => has(user, perm));
}

export type ErpContext = {
  scope: ContextFilters;
  domains: string[];
  hasData: boolean;
  data: Record<string, unknown>;
};

/**
 * Build a compact, permission- and company-scoped snapshot of live ERP data to
 * ground the model. Only domains the user is allowed to view are queried and
 * included. Returns aggregate figures (no row-level PII) suitable for a system
 * prompt. All numbers are strings/ints to avoid float drift.
 */
export async function buildErpContext(
  user: AuthUser,
  filters: ContextFilters,
): Promise<ErpContext> {
  const f = filters;
  const t = today();
  const data: Record<string, unknown> = {};
  const domains: string[] = [];

  const tasks: Array<Promise<void>> = [];

  if (canAny(user, ["contracts.view", "reservations.view", "leads.view"])) {
    const cScope: SQL[] = [eq(contractsTable.isDeleted, false)];
    if (f.companyId) cScope.push(eq(contractsTable.companyId, f.companyId));
    if (f.branchId) cScope.push(eq(contractsTable.branchId, f.branchId));
    if (f.from) cScope.push(sql`${contractsTable.contractDate} >= ${f.from}`);
    if (f.to) cScope.push(sql`${contractsTable.contractDate} <= ${f.to}`);

    const rScope: SQL[] = [eq(reservationsTable.isDeleted, false)];
    if (f.companyId) rScope.push(eq(reservationsTable.companyId, f.companyId));

    const lScope: SQL[] = [eq(leadsTable.isDeleted, false)];
    if (f.companyId) lScope.push(eq(leadsTable.companyId, f.companyId));

    tasks.push(
      (async () => {
        const sales: Record<string, unknown> = {};
        if (has(user, "contracts.view")) {
          const [totals, byStatus] = await Promise.all([
            db
              .select({
                contracts: count(),
                value: moneySum(contractsTable.totalPrice),
                avg: sql<string>`coalesce(round(avg(${contractsTable.totalPrice}), 2), 0)::text`,
              })
              .from(contractsTable)
              .where(and(...cScope)),
            db
              .select({ key: contractsTable.status, count: count(), value: moneySum(contractsTable.totalPrice) })
              .from(contractsTable)
              .where(and(...cScope))
              .groupBy(contractsTable.status),
          ]);
          sales.totalContracts = totals[0]?.contracts ?? 0;
          sales.totalContractValue = totals[0]?.value ?? "0";
          sales.avgContractValue = totals[0]?.avg ?? "0";
          sales.contractsByStatus = byStatus;
        }
        if (has(user, "reservations.view")) {
          const reservations = await db
            .select({ count: count(), value: moneySum(reservationsTable.amount) })
            .from(reservationsTable)
            .where(and(...rScope));
          sales.reservationsCount = reservations[0]?.count ?? 0;
          sales.reservationsValue = reservations[0]?.value ?? "0";
        }
        if (has(user, "leads.view")) {
          const leads = await db.select({ count: count() }).from(leadsTable).where(and(...lScope));
          sales.leadsCount = leads[0]?.count ?? 0;
        }
        if (Object.keys(sales).length > 0) {
          data.sales = sales;
          domains.push("sales");
        }
      })(),
    );
  }

  if (canAny(user, ["units.view", "projects.view"])) {
    const uScope: SQL[] = [eq(unitsTable.isDeleted, false)];
    if (f.companyId) uScope.push(eq(unitsTable.companyId, f.companyId));
    if (f.projectId) uScope.push(eq(unitsTable.projectId, f.projectId));
    const pScope: SQL[] = [eq(projectsTable.isDeleted, false)];
    if (f.companyId) pScope.push(eq(projectsTable.companyId, f.companyId));

    tasks.push(
      (async () => {
        const units: Record<string, unknown> = {};
        if (has(user, "units.view")) {
          const byStatus = await db
            .select({ code: unitStatusesTable.code, count: count() })
            .from(unitsTable)
            .leftJoin(unitStatusesTable, eq(unitsTable.unitStatusId, unitStatusesTable.id))
            .where(and(...uScope))
            .groupBy(unitStatusesTable.code);
          const find = (code: string): number =>
            byStatus.find((r) => r.code === code)?.count ?? 0;
          units.sold = find("sold");
          units.available = find("available");
          units.reserved = find("reserved");
          units.byStatus = byStatus;
        }
        if (has(user, "projects.view")) {
          const projects = await db.select({ count: count() }).from(projectsTable).where(and(...pScope));
          units.activeProjects = projects[0]?.count ?? 0;
        }
        if (Object.keys(units).length > 0) {
          data.units = units;
          domains.push("units");
        }
      })(),
    );
  }

  if (canAny(user, ["installmentSchedules.view", "installmentCollections.view"])) {
    const sScope: SQL[] = [eq(installmentSchedulesTable.isDeleted, false)];
    if (f.companyId) sScope.push(eq(installmentSchedulesTable.companyId, f.companyId));
    const colScope: SQL[] = [eq(installmentCollectionsTable.isDeleted, false)];
    if (f.companyId) colScope.push(eq(installmentCollectionsTable.companyId, f.companyId));

    tasks.push(
      (async () => {
        const collections: Record<string, unknown> = {};
        if (has(user, "installmentSchedules.view")) {
          const [totals, overdue] = await Promise.all([
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
                count: count(),
              })
              .from(installmentSchedulesTable)
              .where(and(...sScope, ne(installmentSchedulesTable.status, "paid"), lt(installmentSchedulesTable.dueDate, t))),
          ]);
          const due = Number(totals[0]?.due ?? "0");
          const paid = Number(totals[0]?.paid ?? "0");
          collections.totalDue = totals[0]?.due ?? "0";
          collections.totalPaid = totals[0]?.paid ?? "0";
          collections.totalOutstanding = totals[0]?.outstanding ?? "0";
          collections.collectionRate = due > 0 ? ((paid / due) * 100).toFixed(2) : "0";
          collections.overdueAmount = overdue[0]?.amount ?? "0";
          collections.overdueCount = overdue[0]?.count ?? 0;
        }
        if (has(user, "installmentCollections.view")) {
          const collected = await db
            .select({ value: moneySum(installmentCollectionsTable.amount), count: count() })
            .from(installmentCollectionsTable)
            .where(and(...colScope));
          collections.collectionsRecorded = collected[0]?.count ?? 0;
          collections.collectionsValue = collected[0]?.value ?? "0";
        }
        if (Object.keys(collections).length > 0) {
          data.collections = collections;
          domains.push("collections");
        }
      })(),
    );
  }

  if (canAny(user, ["cashboxes.view", "bankAccounts.view", "customerInvoices.view", "supplierInvoices.view"])) {
    const cashScope: SQL[] = [eq(cashboxesTable.isDeleted, false)];
    if (f.companyId) cashScope.push(eq(cashboxesTable.companyId, f.companyId));
    const bankScope: SQL[] = [eq(bankAccountsTable.isDeleted, false)];
    if (f.companyId) bankScope.push(eq(bankAccountsTable.companyId, f.companyId));
    const ciScope: SQL[] = [eq(customerInvoicesTable.isDeleted, false), ne(customerInvoicesTable.status, "cancelled")];
    if (f.companyId) ciScope.push(eq(customerInvoicesTable.companyId, f.companyId));
    const siScope: SQL[] = [eq(supplierInvoicesTable.isDeleted, false), ne(supplierInvoicesTable.status, "cancelled")];
    if (f.companyId) siScope.push(eq(supplierInvoicesTable.companyId, f.companyId));

    tasks.push(
      (async () => {
        const finance: Record<string, unknown> = {};
        if (has(user, "cashboxes.view")) {
          const cash = await db.select({ value: moneySum(cashboxesTable.currentBalance) }).from(cashboxesTable).where(and(...cashScope));
          finance.cashOnHand = cash[0]?.value ?? "0";
        }
        if (has(user, "bankAccounts.view")) {
          const bank = await db.select({ value: moneySum(bankAccountsTable.currentBalance) }).from(bankAccountsTable).where(and(...bankScope));
          finance.bankBalance = bank[0]?.value ?? "0";
        }
        if (has(user, "customerInvoices.view")) {
          const ar = await db
            .select({ value: sql<string>`coalesce(sum(${customerInvoicesTable.total} - ${customerInvoicesTable.paidAmount}), 0)::text` })
            .from(customerInvoicesTable)
            .where(and(...ciScope));
          finance.arOutstanding = ar[0]?.value ?? "0";
        }
        if (has(user, "supplierInvoices.view")) {
          const ap = await db
            .select({ value: sql<string>`coalesce(sum(${supplierInvoicesTable.total} - ${supplierInvoicesTable.paidAmount}), 0)::text` })
            .from(supplierInvoicesTable)
            .where(and(...siScope));
          finance.apOutstanding = ap[0]?.value ?? "0";
        }
        if (Object.keys(finance).length > 0) {
          data.finance = finance;
          domains.push("finance");
        }
      })(),
    );
  }

  if (has(user, "inventoryItems.view")) {
    const itemScope: SQL[] = [eq(inventoryItemsTable.isDeleted, false)];
    if (f.companyId) itemScope.push(eq(inventoryItemsTable.companyId, f.companyId));
    tasks.push(
      (async () => {
        const items = await db.select({ count: count() }).from(inventoryItemsTable).where(and(...itemScope));
        data.inventory = { totalItems: items[0]?.count ?? 0 };
        domains.push("inventory");
      })(),
    );
  }

  if (canAny(user, ["employees.view", "departments.view", "payrollRuns.view"])) {
    const empScope: SQL[] = [eq(employeesTable.isDeleted, false)];
    if (f.companyId) empScope.push(eq(employeesTable.companyId, f.companyId));
    const deptScope: SQL[] = [eq(departmentsTable.isDeleted, false)];
    if (f.companyId) deptScope.push(eq(departmentsTable.companyId, f.companyId));
    const prScope: SQL[] = [eq(payrollRunsTable.isDeleted, false)];
    if (f.companyId) prScope.push(eq(payrollRunsTable.companyId, f.companyId));
    tasks.push(
      (async () => {
        const hr: Record<string, unknown> = {};
        if (has(user, "employees.view")) {
          const [emp, active] = await Promise.all([
            db.select({ count: count() }).from(employeesTable).where(and(...empScope)),
            db.select({ count: count() }).from(employeesTable).where(and(...empScope, eq(employeesTable.status, "active"))),
          ]);
          hr.totalEmployees = emp[0]?.count ?? 0;
          hr.activeEmployees = active[0]?.count ?? 0;
        }
        if (has(user, "departments.view")) {
          const depts = await db.select({ count: count() }).from(departmentsTable).where(and(...deptScope));
          hr.departments = depts[0]?.count ?? 0;
        }
        if (has(user, "payrollRuns.view")) {
          const payroll = await db.select({ value: moneySum(payrollRunsTable.totalNet) }).from(payrollRunsTable).where(and(...prScope));
          hr.totalPayroll = payroll[0]?.value ?? "0";
        }
        if (Object.keys(hr).length > 0) {
          data.hr = hr;
          domains.push("hr");
        }
      })(),
    );
  }

  if (canAny(user, ["purchaseOrders.view", "suppliers.view"])) {
    const poScope: SQL[] = [eq(purchaseOrdersTable.isDeleted, false)];
    if (f.companyId) poScope.push(eq(purchaseOrdersTable.companyId, f.companyId));
    const supScope: SQL[] = [eq(suppliersTable.isDeleted, false)];
    if (f.companyId) supScope.push(eq(suppliersTable.companyId, f.companyId));
    tasks.push(
      (async () => {
        const procurement: Record<string, unknown> = {};
        if (has(user, "purchaseOrders.view")) {
          const po = await db.select({ orders: count(), value: moneySum(purchaseOrdersTable.totalAmount) }).from(purchaseOrdersTable).where(and(...poScope));
          procurement.purchaseOrders = po[0]?.orders ?? 0;
          procurement.totalPoValue = po[0]?.value ?? "0";
        }
        if (has(user, "suppliers.view")) {
          const sup = await db.select({ count: count() }).from(suppliersTable).where(and(...supScope));
          procurement.suppliers = sup[0]?.count ?? 0;
        }
        if (Object.keys(procurement).length > 0) {
          data.procurement = procurement;
          domains.push("procurement");
        }
      })(),
    );
  }

  if (has(user, "contractorContracts.view")) {
    const ccScope: SQL[] = [eq(contractorContractsTable.isDeleted, false)];
    if (f.companyId) ccScope.push(eq(contractorContractsTable.companyId, f.companyId));
    if (f.projectId) ccScope.push(eq(contractorContractsTable.projectId, f.projectId));
    tasks.push(
      (async () => {
        const cc = await db
          .select({ count: count(), value: moneySum(contractorContractsTable.contractValue) })
          .from(contractorContractsTable)
          .where(and(...ccScope));
        data.construction = {
          contractorContracts: cc[0]?.count ?? 0,
          totalContractValue: cc[0]?.value ?? "0",
        };
        domains.push("construction");
      })(),
    );
  }

  if (has(user, "fixedAssets.view")) {
    const faScope: SQL[] = [eq(fixedAssetsTable.isDeleted, false)];
    if (f.companyId) faScope.push(eq(fixedAssetsTable.companyId, f.companyId));
    tasks.push(
      (async () => {
        const fa = await db
          .select({
            count: count(),
            cost: moneySum(fixedAssetsTable.acquisitionCost),
            bookValue: moneySum(fixedAssetsTable.bookValue),
          })
          .from(fixedAssetsTable)
          .where(and(...faScope));
        data.fixedAssets = {
          totalAssets: fa[0]?.count ?? 0,
          acquisitionCost: fa[0]?.cost ?? "0",
          netBookValue: fa[0]?.bookValue ?? "0",
        };
        domains.push("fixedAssets");
      })(),
    );
  }

  if (has(user, "landParcels.view")) {
    const lpScope: SQL[] = [eq(landParcelsTable.isDeleted, false)];
    if (f.companyId) lpScope.push(eq(landParcelsTable.companyId, f.companyId));
    tasks.push(
      (async () => {
        const [totals, byStatus] = await Promise.all([
          db
            .select({
              count: count(),
              area: moneySum(landParcelsTable.area),
              value: moneySum(landParcelsTable.marketValue),
            })
            .from(landParcelsTable)
            .where(and(...lpScope)),
          db
            .select({ key: landParcelsTable.status, count: count() })
            .from(landParcelsTable)
            .where(and(...lpScope))
            .groupBy(landParcelsTable.status),
        ]);
        data.landBank = {
          totalParcels: totals[0]?.count ?? 0,
          totalArea: totals[0]?.area ?? "0",
          marketValue: totals[0]?.value ?? "0",
          parcelsByStatus: byStatus,
        };
        domains.push("landBank");
      })(),
    );
  }

  if (has(user, "legalContracts.view")) {
    const lcScope: SQL[] = [eq(legalContractsTable.isDeleted, false)];
    if (f.companyId) lcScope.push(eq(legalContractsTable.companyId, f.companyId));
    tasks.push(
      (async () => {
        const [totals, byStatus] = await Promise.all([
          db
            .select({ count: count(), value: moneySum(legalContractsTable.value) })
            .from(legalContractsTable)
            .where(and(...lcScope)),
          db
            .select({ key: legalContractsTable.status, count: count() })
            .from(legalContractsTable)
            .where(and(...lcScope))
            .groupBy(legalContractsTable.status),
        ]);
        data.legal = {
          legalContracts: totals[0]?.count ?? 0,
          legalContractValue: totals[0]?.value ?? "0",
          contractsByStatus: byStatus,
        };
        domains.push("legal");
      })(),
    );
  }

  if (has(user, "treasuryTransactions.view")) {
    const ttScope: SQL[] = [eq(treasuryTransactionsTable.isDeleted, false)];
    if (f.companyId) ttScope.push(eq(treasuryTransactionsTable.companyId, f.companyId));
    tasks.push(
      (async () => {
        const tt = await db
          .select({ count: count(), value: moneySum(treasuryTransactionsTable.amount) })
          .from(treasuryTransactionsTable)
          .where(and(...ttScope));
        data.treasury = {
          treasuryTransactions: tt[0]?.count ?? 0,
          treasuryVolume: tt[0]?.value ?? "0",
        };
        domains.push("treasury");
      })(),
    );
  }

  if (has(user, "documents.view")) {
    const docScope: SQL[] = [eq(documentsTable.isDeleted, false)];
    if (f.companyId) docScope.push(eq(documentsTable.companyId, f.companyId));
    tasks.push(
      (async () => {
        const [totals, byStatus] = await Promise.all([
          db.select({ count: count() }).from(documentsTable).where(and(...docScope)),
          db
            .select({ key: documentsTable.status, count: count() })
            .from(documentsTable)
            .where(and(...docScope))
            .groupBy(documentsTable.status),
        ]);
        data.documents = {
          totalDocuments: totals[0]?.count ?? 0,
          documentsByStatus: byStatus,
        };
        domains.push("documents");
      })(),
    );
  }

  if (has(user, "administrativeTasks.view")) {
    const atScope: SQL[] = [eq(administrativeTasksTable.isDeleted, false)];
    if (f.companyId) atScope.push(eq(administrativeTasksTable.companyId, f.companyId));
    tasks.push(
      (async () => {
        const [totals, byStatus] = await Promise.all([
          db.select({ count: count() }).from(administrativeTasksTable).where(and(...atScope)),
          db
            .select({ key: administrativeTasksTable.status, count: count() })
            .from(administrativeTasksTable)
            .where(and(...atScope))
            .groupBy(administrativeTasksTable.status),
        ]);
        data.generalAdmin = {
          administrativeTasks: totals[0]?.count ?? 0,
          tasksByStatus: byStatus,
        };
        domains.push("generalAdmin");
      })(),
    );
  }

  if (canAny(user, ["complaints.view", "handoverRequests.view"])) {
    const cmpScope: SQL[] = [eq(complaintsTable.isDeleted, false)];
    if (f.companyId) cmpScope.push(eq(complaintsTable.companyId, f.companyId));
    const hoScope: SQL[] = [eq(handoverRequestsTable.isDeleted, false)];
    if (f.companyId) hoScope.push(eq(handoverRequestsTable.companyId, f.companyId));
    tasks.push(
      (async () => {
        const customerService: Record<string, unknown> = {};
        if (has(user, "complaints.view")) {
          const [totals, byStatus] = await Promise.all([
            db.select({ count: count() }).from(complaintsTable).where(and(...cmpScope)),
            db
              .select({ key: complaintsTable.status, count: count() })
              .from(complaintsTable)
              .where(and(...cmpScope))
              .groupBy(complaintsTable.status),
          ]);
          customerService.complaints = totals[0]?.count ?? 0;
          customerService.complaintsByStatus = byStatus;
        }
        if (has(user, "handoverRequests.view")) {
          const [totals, byStatus] = await Promise.all([
            db.select({ count: count() }).from(handoverRequestsTable).where(and(...hoScope)),
            db
              .select({ key: handoverRequestsTable.status, count: count() })
              .from(handoverRequestsTable)
              .where(and(...hoScope))
              .groupBy(handoverRequestsTable.status),
          ]);
          customerService.handoverRequests = totals[0]?.count ?? 0;
          customerService.handoversByStatus = byStatus;
        }
        if (Object.keys(customerService).length > 0) {
          data.customerService = customerService;
          domains.push("customerService");
        }
      })(),
    );
  }

  if (has(user, "marketing.view")) {
    const mcScope: SQL[] = [eq(marketingCampaignsTable.isDeleted, false)];
    if (f.companyId) mcScope.push(eq(marketingCampaignsTable.companyId, f.companyId));
    tasks.push(
      (async () => {
        const mc = await db
          .select({
            count: count(),
            budget: moneySum(marketingCampaignsTable.budget),
            spend: moneySum(marketingCampaignsTable.actualCost),
          })
          .from(marketingCampaignsTable)
          .where(and(...mcScope));
        data.marketing = {
          campaigns: mc[0]?.count ?? 0,
          campaignBudget: mc[0]?.budget ?? "0",
          campaignSpend: mc[0]?.spend ?? "0",
        };
        domains.push("marketing");
      })(),
    );
  }

  await Promise.all(tasks);

  const hasData = Object.values(data).some((domain) =>
    Object.values(domain as Record<string, unknown>).some((v) => {
      if (typeof v === "number") return v > 0;
      if (typeof v === "string") return v !== "0" && v !== "0.00" && v !== "";
      if (Array.isArray(v)) return v.length > 0;
      return false;
    }),
  );

  return { scope: f, domains, hasData, data };
}
