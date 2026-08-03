import { Router, type IRouter } from "express";
import { and, eq, gt, lt, ne, isNull, desc, count, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { PgTable, AnyPgColumn } from "drizzle-orm/pg-core";
import {
  db,
  usersTable,
  companiesTable,
  branchesTable,
  rolesTable,
  fiscalYearsTable,
  currenciesTable,
  auditLogsTable,
  sessionsTable,
  projectsTable,
  buildingsTable,
  unitsTable,
  unitStatusesTable,
  leadsTable,
  customersTable,
  reservationsTable,
  contractsTable,
  installmentSchedulesTable,
} from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetRecentActivityResponse,
  GetRealEstateDashboardResponse,
} from "@workspace/api-zod";
import { toAuditLog } from "../lib/presenters";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

async function countWhere(table: PgTable, where: SQL | undefined): Promise<number> {
  const [row] = await db.select({ value: count() }).from(table).where(where);
  return row?.value ?? 0;
}

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [
    users,
    companies,
    branches,
    roles,
    fiscalYears,
    currencies,
    auditEvents,
    activeSessions,
  ] = await Promise.all([
    countWhere(usersTable, eq(usersTable.isDeleted, false)),
    countWhere(companiesTable, eq(companiesTable.isDeleted, false)),
    countWhere(branchesTable, eq(branchesTable.isDeleted, false)),
    countWhere(rolesTable, eq(rolesTable.isDeleted, false)),
    countWhere(fiscalYearsTable, eq(fiscalYearsTable.isDeleted, false)),
    countWhere(currenciesTable, eq(currenciesTable.isDeleted, false)),
    db.select({ value: count() }).from(auditLogsTable).then((r) => r[0]?.value ?? 0),
    countWhere(
      sessionsTable,
      and(isNull(sessionsTable.revokedAt), gt(sessionsTable.expiresAt, new Date())),
    ),
  ]);

  res.json(
    GetDashboardSummaryResponse.parse({
      users,
      companies,
      branches,
      roles,
      activeSessions,
      fiscalYears,
      currencies,
      auditEvents,
    }),
  );
});

router.get("/realestate/dashboard", async (req, res): Promise<void> => {
  const today = new Date().toISOString().slice(0, 10);
  const companyId =
    typeof req.query.companyId === "string" && req.query.companyId ? req.query.companyId : null;
  const scoped = (notDeleted: SQL, companyCol: AnyPgColumn): SQL =>
    companyId ? (and(notDeleted, eq(companyCol, companyId)) as SQL) : notDeleted;

  const unitsWhere = scoped(eq(unitsTable.isDeleted, false), unitsTable.companyId);
  const contractsWhere = scoped(eq(contractsTable.isDeleted, false), contractsTable.companyId);

  const [
    projects,
    buildings,
    units,
    leads,
    customers,
    reservations,
    contracts,
    statusRows,
    overdueRow,
    contractValueRow,
  ] = await Promise.all([
    countWhere(projectsTable, scoped(eq(projectsTable.isDeleted, false), projectsTable.companyId)),
    countWhere(buildingsTable, scoped(eq(buildingsTable.isDeleted, false), buildingsTable.companyId)),
    countWhere(unitsTable, unitsWhere),
    countWhere(leadsTable, scoped(eq(leadsTable.isDeleted, false), leadsTable.companyId)),
    countWhere(customersTable, scoped(eq(customersTable.isDeleted, false), customersTable.companyId)),
    countWhere(
      reservationsTable,
      scoped(eq(reservationsTable.isDeleted, false), reservationsTable.companyId),
    ),
    countWhere(contractsTable, contractsWhere),
    db
      .select({ code: unitStatusesTable.code, value: count() })
      .from(unitsTable)
      .leftJoin(unitStatusesTable, eq(unitsTable.unitStatusId, unitStatusesTable.id))
      .where(unitsWhere)
      .groupBy(unitStatusesTable.code),
    db
      .select({ value: count() })
      .from(installmentSchedulesTable)
      .where(
        and(
          eq(installmentSchedulesTable.isDeleted, false),
          ne(installmentSchedulesTable.status, "paid"),
          lt(installmentSchedulesTable.dueDate, today),
        ),
      ),
    db
      .select({
        value: sql<string>`coalesce(sum(${contractsTable.totalPrice}), 0)::text`,
      })
      .from(contractsTable)
      .where(contractsWhere),
  ]);

  const byStatus = (code: string): number =>
    statusRows.find((r) => r.code === code)?.value ?? 0;

  res.json(
    GetRealEstateDashboardResponse.parse({
      projects,
      buildings,
      units,
      availableUnits: byStatus("available"),
      reservedUnits: byStatus("reserved"),
      soldUnits: byStatus("sold"),
      leads,
      customers,
      reservations,
      contracts,
      overdueInstallments: overdueRow[0]?.value ?? 0,
      totalContractValue: contractValueRow[0]?.value ?? "0",
    }),
  );
});

router.get("/dashboard/recent-activity", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(auditLogsTable)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(12);
  res.json(GetRecentActivityResponse.parse(rows.map(toAuditLog)));
});

export default router;
