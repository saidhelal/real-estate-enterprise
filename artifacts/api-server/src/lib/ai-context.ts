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
 * Map each context domain to the permissions that may view it. A user sees a
 * domain only if their permission set intersects this list (or holds "*").
 * This is the same data the corresponding BI/module screens expose, so the AI
 * never grounds on data the user could not already read.
 */
const DOMAIN_PERMISSIONS: Record<string, string[]> = {
  sales: ["bi.view", "contracts.view", "reservations.view", "leads.view"],
  units: ["bi.view", "units.view"],
  collections: [
    "bi.view",
    "installmentSchedules.view",
    "installmentCollections.view",
  ],
  finance: [
    "bi.view",
    "cashboxes.view",
    "bankAccounts.view",
    "customerInvoices.view",
    "supplierInvoices.view",
  ],
  inventory: ["bi.view", "inventoryItems.view"],
  hr: ["bi.view", "employees.view"],
  procurement: ["bi.view", "purchaseOrders.view"],
  construction: ["bi.view", "contractorContracts.view"],
};

function can(user: AuthUser, domain: string): boolean {
  if (user.permissions.includes("*")) return true;
  const needed = DOMAIN_PERMISSIONS[domain] ?? [];
  return needed.some((p) => user.permissions.includes(p));
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

  if (can(user, "sales")) {
    domains.push("sales");
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
        const [totals, byStatus, reservations, leads] = await Promise.all([
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
          db
            .select({ count: count(), value: moneySum(reservationsTable.amount) })
            .from(reservationsTable)
            .where(and(...rScope)),
          db.select({ count: count() }).from(leadsTable).where(and(...lScope)),
        ]);
        data.sales = {
          totalContracts: totals[0]?.contracts ?? 0,
          totalContractValue: totals[0]?.value ?? "0",
          avgContractValue: totals[0]?.avg ?? "0",
          contractsByStatus: byStatus,
          reservationsCount: reservations[0]?.count ?? 0,
          reservationsValue: reservations[0]?.value ?? "0",
          leadsCount: leads[0]?.count ?? 0,
        };
      })(),
    );
  }

  if (can(user, "units")) {
    domains.push("units");
    const uScope: SQL[] = [eq(unitsTable.isDeleted, false)];
    if (f.companyId) uScope.push(eq(unitsTable.companyId, f.companyId));
    if (f.projectId) uScope.push(eq(unitsTable.projectId, f.projectId));
    const pScope: SQL[] = [eq(projectsTable.isDeleted, false)];
    if (f.companyId) pScope.push(eq(projectsTable.companyId, f.companyId));

    tasks.push(
      (async () => {
        const [byStatus, projects] = await Promise.all([
          db
            .select({ code: unitStatusesTable.code, count: count() })
            .from(unitsTable)
            .leftJoin(unitStatusesTable, eq(unitsTable.unitStatusId, unitStatusesTable.id))
            .where(and(...uScope))
            .groupBy(unitStatusesTable.code),
          db.select({ count: count() }).from(projectsTable).where(and(...pScope)),
        ]);
        const find = (code: string): number =>
          byStatus.find((r) => r.code === code)?.count ?? 0;
        data.units = {
          sold: find("sold"),
          available: find("available"),
          reserved: find("reserved"),
          byStatus,
          activeProjects: projects[0]?.count ?? 0,
        };
      })(),
    );
  }

  if (can(user, "collections")) {
    domains.push("collections");
    const sScope: SQL[] = [eq(installmentSchedulesTable.isDeleted, false)];
    if (f.companyId) sScope.push(eq(installmentSchedulesTable.companyId, f.companyId));
    const colScope: SQL[] = [eq(installmentCollectionsTable.isDeleted, false)];
    if (f.companyId) colScope.push(eq(installmentCollectionsTable.companyId, f.companyId));

    tasks.push(
      (async () => {
        const [totals, overdue, collected] = await Promise.all([
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
          db
            .select({ value: moneySum(installmentCollectionsTable.amount), count: count() })
            .from(installmentCollectionsTable)
            .where(and(...colScope)),
        ]);
        const due = Number(totals[0]?.due ?? "0");
        const paid = Number(totals[0]?.paid ?? "0");
        data.collections = {
          totalDue: totals[0]?.due ?? "0",
          totalPaid: totals[0]?.paid ?? "0",
          totalOutstanding: totals[0]?.outstanding ?? "0",
          collectionRate: due > 0 ? ((paid / due) * 100).toFixed(2) : "0",
          overdueAmount: overdue[0]?.amount ?? "0",
          overdueCount: overdue[0]?.count ?? 0,
          collectionsRecorded: collected[0]?.count ?? 0,
          collectionsValue: collected[0]?.value ?? "0",
        };
      })(),
    );
  }

  if (can(user, "finance")) {
    domains.push("finance");
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
        const [cash, bank, ar, ap] = await Promise.all([
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
        ]);
        data.finance = {
          cashOnHand: cash[0]?.value ?? "0",
          bankBalance: bank[0]?.value ?? "0",
          arOutstanding: ar[0]?.value ?? "0",
          apOutstanding: ap[0]?.value ?? "0",
        };
      })(),
    );
  }

  if (can(user, "inventory")) {
    domains.push("inventory");
    const itemScope: SQL[] = [eq(inventoryItemsTable.isDeleted, false)];
    if (f.companyId) itemScope.push(eq(inventoryItemsTable.companyId, f.companyId));
    tasks.push(
      (async () => {
        const [items] = await Promise.all([
          db.select({ count: count() }).from(inventoryItemsTable).where(and(...itemScope)),
        ]);
        data.inventory = { totalItems: items[0]?.count ?? 0 };
      })(),
    );
  }

  if (can(user, "hr")) {
    domains.push("hr");
    const empScope: SQL[] = [eq(employeesTable.isDeleted, false)];
    if (f.companyId) empScope.push(eq(employeesTable.companyId, f.companyId));
    const deptScope: SQL[] = [eq(departmentsTable.isDeleted, false)];
    if (f.companyId) deptScope.push(eq(departmentsTable.companyId, f.companyId));
    const prScope: SQL[] = [eq(payrollRunsTable.isDeleted, false)];
    if (f.companyId) prScope.push(eq(payrollRunsTable.companyId, f.companyId));
    tasks.push(
      (async () => {
        const [emp, active, depts, payroll] = await Promise.all([
          db.select({ count: count() }).from(employeesTable).where(and(...empScope)),
          db.select({ count: count() }).from(employeesTable).where(and(...empScope, eq(employeesTable.status, "active"))),
          db.select({ count: count() }).from(departmentsTable).where(and(...deptScope)),
          db.select({ value: moneySum(payrollRunsTable.totalNet) }).from(payrollRunsTable).where(and(...prScope)),
        ]);
        data.hr = {
          totalEmployees: emp[0]?.count ?? 0,
          activeEmployees: active[0]?.count ?? 0,
          departments: depts[0]?.count ?? 0,
          totalPayroll: payroll[0]?.value ?? "0",
        };
      })(),
    );
  }

  if (can(user, "procurement")) {
    domains.push("procurement");
    const poScope: SQL[] = [eq(purchaseOrdersTable.isDeleted, false)];
    if (f.companyId) poScope.push(eq(purchaseOrdersTable.companyId, f.companyId));
    const supScope: SQL[] = [eq(suppliersTable.isDeleted, false)];
    if (f.companyId) supScope.push(eq(suppliersTable.companyId, f.companyId));
    tasks.push(
      (async () => {
        const [po, sup] = await Promise.all([
          db.select({ orders: count(), value: moneySum(purchaseOrdersTable.totalAmount) }).from(purchaseOrdersTable).where(and(...poScope)),
          db.select({ count: count() }).from(suppliersTable).where(and(...supScope)),
        ]);
        data.procurement = {
          purchaseOrders: po[0]?.orders ?? 0,
          totalPoValue: po[0]?.value ?? "0",
          suppliers: sup[0]?.count ?? 0,
        };
      })(),
    );
  }

  if (can(user, "construction")) {
    domains.push("construction");
    const ccScope: SQL[] = [eq(contractorContractsTable.isDeleted, false)];
    if (f.companyId) ccScope.push(eq(contractorContractsTable.companyId, f.companyId));
    if (f.projectId) ccScope.push(eq(contractorContractsTable.projectId, f.projectId));
    tasks.push(
      (async () => {
        const [cc] = await Promise.all([
          db
            .select({ count: count(), value: moneySum(contractorContractsTable.contractValue) })
            .from(contractorContractsTable)
            .where(and(...ccScope)),
        ]);
        data.construction = {
          contractorContracts: cc[0]?.count ?? 0,
          totalContractValue: cc[0]?.value ?? "0",
        };
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
