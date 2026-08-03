import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, gte, ilike, inArray, or, type SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import {
  ListNotificationsResponse,
  CreateNotificationBody,
  GetNotificationResponse,
  UpdateNotificationBody,
  GetNotificationsDashboardResponse,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";

// Notification Center (الإشعارات والتنبيهات): the internal ERP notification inbox.
// Each row is one notification addressed to a recipient user. The module is
// standalone for now — other modules will write rows into it gradually.
//
// Access model: notifications are PERSONAL, so list/get/dashboard require only
// authentication (no per-module permission); a user always sees their own inbox.
// Scope (spec item 18) is enforced in `scopeFilter`:
//   - "*" or "notifications.viewAll" -> all notifications (Owner/Super Admin/GM)
//   - else, if the user has department scopes -> own rows + their departments
//   - else -> own rows only
// Mutations (read/favorite/archive/delete/restore/mark-all) are also auth-only
// but only ever touch rows inside the caller's visible scope (404 otherwise), so
// a user can manage their own inbox without a CRUD permission. Manual creation
// (POST) is the one privileged action, guarded by `notifications.create`.

const router: IRouter = Router();
router.use(requireAuth);

type Row = Record<string, unknown>;

/** Build the row-visibility filter for the authenticated caller. */
function scopeFilter(req: Request): SQL {
  const user = req.authUser!;
  if (user.permissions.includes("*") || user.permissions.includes("notifications.viewAll")) {
    // Sees everything; an undeleted-true tautology keeps a non-null SQL.
    return sql`true`;
  }
  const mine = eq(notificationsTable.recipientUserId, user.id);
  const deptIds = user.scopes.departmentIds;
  if (deptIds.length > 0) {
    return or(mine, inArray(notificationsTable.departmentId, deptIds))!;
  }
  return mine;
}

/** Translate the inbox `view` param into its state predicate. */
function viewFilter(view: string): SQL {
  switch (view) {
    case "unread":
      return and(eq(notificationsTable.isDeleted, false), eq(notificationsTable.isRead, false))!;
    case "read":
      return and(eq(notificationsTable.isDeleted, false), eq(notificationsTable.isRead, true))!;
    case "favorites":
      return and(eq(notificationsTable.isDeleted, false), eq(notificationsTable.isFavorite, true))!;
    case "archived":
      return and(eq(notificationsTable.isDeleted, false), eq(notificationsTable.isArchived, true))!;
    case "trash":
      return eq(notificationsTable.isDeleted, true);
    case "all":
    default:
      return eq(notificationsTable.isDeleted, false);
  }
}

// GET /notifications-dashboard — scoped counters (item 19).
router.get("/notifications-dashboard", async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const companyId = qStr(q, "companyId");
  const scope = scopeFilter(req);
  const live: SQL[] = [scope, eq(notificationsTable.isDeleted, false)];
  if (companyId) live.push(eq(notificationsTable.companyId, companyId));

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 6);
  const startOfMonth = new Date(startOfToday);
  startOfMonth.setDate(startOfMonth.getDate() - 29);

  const countWhere = async (extra: SQL[] = []): Promise<number> => {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notificationsTable)
      .where(and(...live, ...extra));
    return count;
  };

  const [total, unread, urgent, today, week, month] = await Promise.all([
    countWhere(),
    countWhere([eq(notificationsTable.isRead, false)]),
    countWhere([eq(notificationsTable.priority, "urgent")]),
    countWhere([gte(notificationsTable.createdAt, startOfToday)]),
    countWhere([gte(notificationsTable.createdAt, startOfWeek)]),
    countWhere([gte(notificationsTable.createdAt, startOfMonth)]),
  ]);

  res.json(GetNotificationsDashboardResponse.parse({ total, unread, urgent, today, week, month }));
});

// GET /notifications — paginated list with view + filters, scoped to the caller.
router.get("/notifications", async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [scopeFilter(req), viewFilter(qStr(q, "view"))];

  const search = qStr(q, "search");
  if (search) {
    const s = or(
      ilike(notificationsTable.title, `%${search}%`),
      ilike(notificationsTable.body, `%${search}%`),
      ilike(notificationsTable.sourceRef, `%${search}%`),
    );
    if (s) filters.push(s);
  }
  for (const c of ["companyId", "category", "priority", "channel"] as const) {
    const v = qStr(q, c);
    if (v) filters.push(eq(notificationsTable[c], v));
  }

  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notificationsTable)
    .where(where);
  const rows = (await db
    .select()
    .from(notificationsTable)
    .where(where)
    .orderBy(desc(notificationsTable.createdAt))
    .limit(pageSize)
    .offset(offset)) as Row[];

  res.json(ListNotificationsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

// POST /notifications — manual/system creation (privileged).
router.post("/notifications", requirePermission("notifications.create"), async (req, res): Promise<void> => {
  const parsed = CreateNotificationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const inserted = (await db.insert(notificationsTable).values({ ...parsed.data }).returning()) as Row[];
  const row = inserted[0];
  await recordAudit(req, { action: "create", entity: "notification", entityId: String(row.id), newValue: row });
  res.status(201).json(GetNotificationResponse.parse(serializeRow(row)));
});

// POST /notifications/mark-all-read — clear the unread counter for the caller's
// visible, undeleted notifications. Declared before "/:id" so it is not shadowed.
router.post("/notifications/mark-all-read", async (req, res): Promise<void> => {
  await db
    .update(notificationsTable)
    .set({ isRead: true, readAt: new Date() })
    .where(and(scopeFilter(req), eq(notificationsTable.isDeleted, false), eq(notificationsTable.isRead, false)));
  await recordAudit(req, { action: "update", entity: "notification", entityId: "mark-all-read" });
  res.json({ success: true });
});

/** Fetch a single notification only if it is inside the caller's scope. */
async function findVisible(req: Request, id: string): Promise<Row | undefined> {
  const found = (await db
    .select()
    .from(notificationsTable)
    .where(and(eq(notificationsTable.id, id), scopeFilter(req)))) as Row[];
  return found[0];
}

// GET /notifications/:id
router.get("/notifications/:id", async (req, res): Promise<void> => {
  const row = await findVisible(req, String(req.params.id));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(GetNotificationResponse.parse(serializeRow(row)));
});

// PATCH /notifications/:id — toggle read/favorite/archive (and limited fields).
router.patch("/notifications/:id", async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateNotificationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await findVisible(req, id);
  if (!existing || existing.isDeleted) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const update: Record<string, unknown> = { ...parsed.data };
  // Keep readAt consistent with the isRead transition.
  if (typeof update.isRead === "boolean") {
    update.readAt = update.isRead ? new Date() : null;
  }
  const row = Object.keys(update).length
    ? ((await db.update(notificationsTable).set(update).where(eq(notificationsTable.id, id)).returning()) as Row[])[0]
    : existing;
  await recordAudit(req, { action: "update", entity: "notification", entityId: id, oldValue: existing, newValue: row });
  res.json(GetNotificationResponse.parse(serializeRow(row)));
});

// DELETE /notifications/:id — move to trash (soft-delete, recoverable).
router.delete("/notifications/:id", async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const existing = await findVisible(req, id);
  if (!existing || existing.isDeleted) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await db.update(notificationsTable).set({ isDeleted: true }).where(eq(notificationsTable.id, id));
  await recordAudit(req, { action: "delete", entity: "notification", entityId: id });
  res.json({ success: true });
});

// POST /notifications/:id/restore — bring a notification back from trash.
router.post("/notifications/:id/restore", async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const existing = await findVisible(req, id);
  if (!existing || !existing.isDeleted) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const row = ((await db
    .update(notificationsTable)
    .set({ isDeleted: false, isActive: true })
    .where(eq(notificationsTable.id, id))
    .returning()) as Row[])[0];
  await recordAudit(req, { action: "update", entity: "notification", entityId: id, newValue: row });
  res.json(GetNotificationResponse.parse(serializeRow(row)));
});

export default router;
