import { Router, type IRouter } from "express";
import { and, eq, desc } from "drizzle-orm";
import { db, auditLogsTable, loginHistoryTable } from "@workspace/db";
import {
  ListAuditLogsResponse,
  ListLoginHistoryResponse,
} from "@workspace/api-zod";
import { toAuditLog, toLoginHistory } from "../lib/presenters";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/audit-logs", requirePermission("audit.view"), async (req, res): Promise<void> => {
  const entity = typeof req.query.entity === "string" ? req.query.entity : "";
  const action = typeof req.query.action === "string" ? req.query.action : "";

  const filters = [];
  if (entity) filters.push(eq(auditLogsTable.entity, entity));
  if (action) filters.push(eq(auditLogsTable.action, action));

  const rows = await db
    .select()
    .from(auditLogsTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(500);
  res.json(ListAuditLogsResponse.parse(rows.map(toAuditLog)));
});

router.get("/login-history", requirePermission("audit.view"), async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(loginHistoryTable)
    .orderBy(desc(loginHistoryTable.createdAt))
    .limit(500);
  res.json(ListLoginHistoryResponse.parse(rows.map(toLoginHistory)));
});

export default router;
