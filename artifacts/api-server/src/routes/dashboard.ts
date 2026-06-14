import { Router, type IRouter } from "express";
import { and, eq, gt, isNull, desc, count } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
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
} from "@workspace/db";
import { GetDashboardSummaryResponse, GetRecentActivityResponse } from "@workspace/api-zod";
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

router.get("/dashboard/recent-activity", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(auditLogsTable)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(12);
  res.json(GetRecentActivityResponse.parse(rows.map(toAuditLog)));
});

export default router;
