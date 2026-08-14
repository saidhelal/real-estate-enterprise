import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  db,
  handoverRequestsTable,
  handoverSchedulesTable,
  handoverChecklistItemsTable,
  handoverMinutesTable,
  handoverSnagsTable,
  handoverApprovalsTable,
} from "@workspace/db";
import {
  ListHandoverRequestsResponse,
  CreateHandoverRequestBody,
  GetHandoverRequestResponse,
  UpdateHandoverRequestBody,
  ListHandoverSchedulesResponse,
  CreateHandoverScheduleBody,
  GetHandoverScheduleResponse,
  UpdateHandoverScheduleBody,
  ListHandoverChecklistItemsResponse,
  CreateHandoverChecklistItemBody,
  GetHandoverChecklistItemResponse,
  UpdateHandoverChecklistItemBody,
  ListHandoverMinutesResponse,
  CreateHandoverMinuteBody,
  GetHandoverMinuteResponse,
  UpdateHandoverMinuteBody,
  ListHandoverSnagsResponse,
  CreateHandoverSnagBody,
  GetHandoverSnagResponse,
  UpdateHandoverSnagBody,
  ListHandoverApprovalsResponse,
  CreateHandoverApprovalBody,
  GetHandoverApprovalResponse,
  UpdateHandoverApprovalBody,
  GetHandoverDashboardResponse,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { nextNumber } from "../lib/doc-number";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

// ----- handoverRequests -----
router.get("/handover-requests", requirePermission("handoverRequests.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(handoverRequestsTable.isDeleted, false)];
  const search = qStr(q, "search");
  if (search) {
    const s = or(ilike(handoverRequestsTable.code, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(handoverRequestsTable.companyId, companyId));
  const unitId = qStr(q, "unitId");
  if (unitId) filters.push(eq(handoverRequestsTable.unitId, unitId));
  const customerId = qStr(q, "customerId");
  if (customerId) filters.push(eq(handoverRequestsTable.customerId, customerId));
  const handoverType = qStr(q, "handoverType");
  if (handoverType) filters.push(eq(handoverRequestsTable.handoverType, handoverType));
  const status = qStr(q, "status");
  if (status) filters.push(eq(handoverRequestsTable.status, status));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(handoverRequestsTable).where(where);
  const rows = await db.select().from(handoverRequestsTable).where(where).orderBy(desc(handoverRequestsTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListHandoverRequestsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/handover-requests", requirePermission("handoverRequests.create"), async (req, res): Promise<void> => {
  const parsed = CreateHandoverRequestBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(handoverRequestsTable).values({ ...parsed.data, code: (await nextNumber("handoverRequest", req.authUser?.companyId ?? null)).value }).returning();
  await recordAudit(req, { action: "create", entity: "handoverRequest", entityId: row.id, newValue: row });
  res.status(201).json(GetHandoverRequestResponse.parse(serializeRow(row)));
});

router.get("/handover-requests/:id", requirePermission("handoverRequests.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(handoverRequestsTable).where(and(eq(handoverRequestsTable.id, id), eq(handoverRequestsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetHandoverRequestResponse.parse(serializeRow(row)));
});

router.patch("/handover-requests/:id", requirePermission("handoverRequests.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateHandoverRequestBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(handoverRequestsTable).where(and(eq(handoverRequestsTable.id, id), eq(handoverRequestsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  // The code belongs to the sequence that issued it, not to the editor.
  delete (update as Record<string, unknown>).code;
  const [row] = Object.keys(update).length
    ? await db.update(handoverRequestsTable).set(update).where(eq(handoverRequestsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "handoverRequest", entityId: id, oldValue: existing, newValue: row });
  res.json(GetHandoverRequestResponse.parse(serializeRow(row)));
});

router.delete("/handover-requests/:id", requirePermission("handoverRequests.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(handoverRequestsTable).set({ isDeleted: true, isActive: false }).where(and(eq(handoverRequestsTable.id, id), eq(handoverRequestsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "handoverRequest", entityId: id });
  res.json({ success: true });
});

// ----- handoverSchedules -----
router.get("/handover-schedules", requirePermission("handoverSchedules.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(handoverSchedulesTable.isDeleted, false)];
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(handoverSchedulesTable.companyId, companyId));
  const requestId = qStr(q, "requestId");
  if (requestId) filters.push(eq(handoverSchedulesTable.requestId, requestId));
  const assignedToUserId = qStr(q, "assignedToUserId");
  if (assignedToUserId) filters.push(eq(handoverSchedulesTable.assignedToUserId, assignedToUserId));
  const status = qStr(q, "status");
  if (status) filters.push(eq(handoverSchedulesTable.status, status));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(handoverSchedulesTable).where(where);
  const rows = await db.select().from(handoverSchedulesTable).where(where).orderBy(desc(handoverSchedulesTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListHandoverSchedulesResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/handover-schedules", requirePermission("handoverSchedules.create"), async (req, res): Promise<void> => {
  const parsed = CreateHandoverScheduleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(handoverSchedulesTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "handoverSchedule", entityId: row.id, newValue: row });
  res.status(201).json(GetHandoverScheduleResponse.parse(serializeRow(row)));
});

router.get("/handover-schedules/:id", requirePermission("handoverSchedules.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(handoverSchedulesTable).where(and(eq(handoverSchedulesTable.id, id), eq(handoverSchedulesTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetHandoverScheduleResponse.parse(serializeRow(row)));
});

router.patch("/handover-schedules/:id", requirePermission("handoverSchedules.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateHandoverScheduleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(handoverSchedulesTable).where(and(eq(handoverSchedulesTable.id, id), eq(handoverSchedulesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(handoverSchedulesTable).set(update).where(eq(handoverSchedulesTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "handoverSchedule", entityId: id, oldValue: existing, newValue: row });
  res.json(GetHandoverScheduleResponse.parse(serializeRow(row)));
});

router.delete("/handover-schedules/:id", requirePermission("handoverSchedules.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(handoverSchedulesTable).set({ isDeleted: true, isActive: false }).where(and(eq(handoverSchedulesTable.id, id), eq(handoverSchedulesTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "handoverSchedule", entityId: id });
  res.json({ success: true });
});

// ----- handoverChecklistItems -----
router.get("/handover-checklist-items", requirePermission("handoverChecklistItems.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(handoverChecklistItemsTable.isDeleted, false)];
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(handoverChecklistItemsTable.companyId, companyId));
  const requestId = qStr(q, "requestId");
  if (requestId) filters.push(eq(handoverChecklistItemsTable.requestId, requestId));
  const status = qStr(q, "status");
  if (status) filters.push(eq(handoverChecklistItemsTable.status, status));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(handoverChecklistItemsTable).where(where);
  const rows = await db.select().from(handoverChecklistItemsTable).where(where).orderBy(desc(handoverChecklistItemsTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListHandoverChecklistItemsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/handover-checklist-items", requirePermission("handoverChecklistItems.create"), async (req, res): Promise<void> => {
  const parsed = CreateHandoverChecklistItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(handoverChecklistItemsTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "handoverChecklistItem", entityId: row.id, newValue: row });
  res.status(201).json(GetHandoverChecklistItemResponse.parse(serializeRow(row)));
});

router.get("/handover-checklist-items/:id", requirePermission("handoverChecklistItems.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(handoverChecklistItemsTable).where(and(eq(handoverChecklistItemsTable.id, id), eq(handoverChecklistItemsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetHandoverChecklistItemResponse.parse(serializeRow(row)));
});

router.patch("/handover-checklist-items/:id", requirePermission("handoverChecklistItems.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateHandoverChecklistItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(handoverChecklistItemsTable).where(and(eq(handoverChecklistItemsTable.id, id), eq(handoverChecklistItemsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(handoverChecklistItemsTable).set(update).where(eq(handoverChecklistItemsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "handoverChecklistItem", entityId: id, oldValue: existing, newValue: row });
  res.json(GetHandoverChecklistItemResponse.parse(serializeRow(row)));
});

router.delete("/handover-checklist-items/:id", requirePermission("handoverChecklistItems.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(handoverChecklistItemsTable).set({ isDeleted: true, isActive: false }).where(and(eq(handoverChecklistItemsTable.id, id), eq(handoverChecklistItemsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "handoverChecklistItem", entityId: id });
  res.json({ success: true });
});

// ----- handoverMinutes -----
router.get("/handover-minutes", requirePermission("handoverMinutes.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(handoverMinutesTable.isDeleted, false)];
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(handoverMinutesTable.companyId, companyId));
  const requestId = qStr(q, "requestId");
  if (requestId) filters.push(eq(handoverMinutesTable.requestId, requestId));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(handoverMinutesTable).where(where);
  const rows = await db.select().from(handoverMinutesTable).where(where).orderBy(desc(handoverMinutesTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListHandoverMinutesResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/handover-minutes", requirePermission("handoverMinutes.create"), async (req, res): Promise<void> => {
  const parsed = CreateHandoverMinuteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(handoverMinutesTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "handoverMinute", entityId: row.id, newValue: row });
  res.status(201).json(GetHandoverMinuteResponse.parse(serializeRow(row)));
});

router.get("/handover-minutes/:id", requirePermission("handoverMinutes.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(handoverMinutesTable).where(and(eq(handoverMinutesTable.id, id), eq(handoverMinutesTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetHandoverMinuteResponse.parse(serializeRow(row)));
});

router.patch("/handover-minutes/:id", requirePermission("handoverMinutes.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateHandoverMinuteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(handoverMinutesTable).where(and(eq(handoverMinutesTable.id, id), eq(handoverMinutesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(handoverMinutesTable).set(update).where(eq(handoverMinutesTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "handoverMinute", entityId: id, oldValue: existing, newValue: row });
  res.json(GetHandoverMinuteResponse.parse(serializeRow(row)));
});

router.delete("/handover-minutes/:id", requirePermission("handoverMinutes.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(handoverMinutesTable).set({ isDeleted: true, isActive: false }).where(and(eq(handoverMinutesTable.id, id), eq(handoverMinutesTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "handoverMinute", entityId: id });
  res.json({ success: true });
});

// ----- handoverSnags -----
router.get("/handover-snags", requirePermission("handoverSnags.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(handoverSnagsTable.isDeleted, false)];
  const search = qStr(q, "search");
  if (search) {
    const s = or(ilike(handoverSnagsTable.title, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(handoverSnagsTable.companyId, companyId));
  const requestId = qStr(q, "requestId");
  if (requestId) filters.push(eq(handoverSnagsTable.requestId, requestId));
  const severity = qStr(q, "severity");
  if (severity) filters.push(eq(handoverSnagsTable.severity, severity));
  const status = qStr(q, "status");
  if (status) filters.push(eq(handoverSnagsTable.status, status));
  const assignedToUserId = qStr(q, "assignedToUserId");
  if (assignedToUserId) filters.push(eq(handoverSnagsTable.assignedToUserId, assignedToUserId));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(handoverSnagsTable).where(where);
  const rows = await db.select().from(handoverSnagsTable).where(where).orderBy(desc(handoverSnagsTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListHandoverSnagsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/handover-snags", requirePermission("handoverSnags.create"), async (req, res): Promise<void> => {
  const parsed = CreateHandoverSnagBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(handoverSnagsTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "handoverSnag", entityId: row.id, newValue: row });
  res.status(201).json(GetHandoverSnagResponse.parse(serializeRow(row)));
});

router.get("/handover-snags/:id", requirePermission("handoverSnags.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(handoverSnagsTable).where(and(eq(handoverSnagsTable.id, id), eq(handoverSnagsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetHandoverSnagResponse.parse(serializeRow(row)));
});

router.patch("/handover-snags/:id", requirePermission("handoverSnags.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateHandoverSnagBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(handoverSnagsTable).where(and(eq(handoverSnagsTable.id, id), eq(handoverSnagsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(handoverSnagsTable).set(update).where(eq(handoverSnagsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "handoverSnag", entityId: id, oldValue: existing, newValue: row });
  res.json(GetHandoverSnagResponse.parse(serializeRow(row)));
});

router.delete("/handover-snags/:id", requirePermission("handoverSnags.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(handoverSnagsTable).set({ isDeleted: true, isActive: false }).where(and(eq(handoverSnagsTable.id, id), eq(handoverSnagsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "handoverSnag", entityId: id });
  res.json({ success: true });
});

// ----- handoverApprovals -----
router.get("/handover-approvals", requirePermission("handoverApprovals.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(handoverApprovalsTable.isDeleted, false)];
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(handoverApprovalsTable.companyId, companyId));
  const requestId = qStr(q, "requestId");
  if (requestId) filters.push(eq(handoverApprovalsTable.requestId, requestId));
  const status = qStr(q, "status");
  if (status) filters.push(eq(handoverApprovalsTable.status, status));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(handoverApprovalsTable).where(where);
  const rows = await db.select().from(handoverApprovalsTable).where(where).orderBy(desc(handoverApprovalsTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListHandoverApprovalsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/handover-approvals", requirePermission("handoverApprovals.create"), async (req, res): Promise<void> => {
  const parsed = CreateHandoverApprovalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(handoverApprovalsTable).values({ ...parsed.data, status: "pending", approvalDate: null }).returning();
  await recordAudit(req, { action: "create", entity: "handoverApproval", entityId: row.id, newValue: row });
  res.status(201).json(GetHandoverApprovalResponse.parse(serializeRow(row)));
});

router.get("/handover-approvals/:id", requirePermission("handoverApprovals.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(handoverApprovalsTable).where(and(eq(handoverApprovalsTable.id, id), eq(handoverApprovalsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetHandoverApprovalResponse.parse(serializeRow(row)));
});

router.patch("/handover-approvals/:id", requirePermission("handoverApprovals.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateHandoverApprovalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (parsed.data.status === "approved" || parsed.data.status === "rejected") {
    res.status(403).json({ error: "Use the approve/reject endpoint to change approval status" });
    return;
  }
  const [existing] = await db.select().from(handoverApprovalsTable).where(and(eq(handoverApprovalsTable.id, id), eq(handoverApprovalsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(handoverApprovalsTable).set(update).where(eq(handoverApprovalsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "handoverApproval", entityId: id, oldValue: existing, newValue: row });
  res.json(GetHandoverApprovalResponse.parse(serializeRow(row)));
});

router.delete("/handover-approvals/:id", requirePermission("handoverApprovals.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(handoverApprovalsTable).set({ isDeleted: true, isActive: false }).where(and(eq(handoverApprovalsTable.id, id), eq(handoverApprovalsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "handoverApproval", entityId: id });
  res.json({ success: true });
});

router.post("/handover-approvals/:id/approve", requirePermission("handoverApprovals.approve"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [existing] = await db.select().from(handoverApprovalsTable).where(and(eq(handoverApprovalsTable.id, id), eq(handoverApprovalsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status === "approved") { res.status(409).json({ error: "Already approved" }); return; }
  const today = new Date().toISOString().slice(0, 10);
  const [row] = await db.update(handoverApprovalsTable).set({ status: "approved", approvalDate: today }).where(eq(handoverApprovalsTable.id, id)).returning();
  await recordAudit(req, { action: "approve", entity: "handoverApproval", entityId: id, oldValue: existing, newValue: row });
  res.json(GetHandoverApprovalResponse.parse(serializeRow(row)));
});

router.post("/handover-approvals/:id/reject", requirePermission("handoverApprovals.reject"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [existing] = await db.select().from(handoverApprovalsTable).where(and(eq(handoverApprovalsTable.id, id), eq(handoverApprovalsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status === "rejected") { res.status(409).json({ error: "Already rejected" }); return; }
  const [row] = await db.update(handoverApprovalsTable).set({ status: "rejected" }).where(eq(handoverApprovalsTable.id, id)).returning();
  await recordAudit(req, { action: "reject", entity: "handoverApproval", entityId: id, oldValue: existing, newValue: row });
  res.json(GetHandoverApprovalResponse.parse(serializeRow(row)));
});

router.get("/handover-dashboard", requirePermission("handoverRequests.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const companyId = qStr(q, "companyId");
  const base: SQL[] = [eq(handoverRequestsTable.isDeleted, false)];
  if (companyId) base.push(eq(handoverRequestsTable.companyId, companyId));
  const where = and(...base);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(handoverRequestsTable).where(where);
  const byStatusRows = await db.select({ status: handoverRequestsTable.status, count: sql<number>`count(*)::int` }).from(handoverRequestsTable).where(where).groupBy(handoverRequestsTable.status);
  const scheduledWhere = and(eq(handoverRequestsTable.isDeleted, false), eq(handoverRequestsTable.status, "scheduled"), ...(companyId ? [eq(handoverRequestsTable.companyId, companyId)] : []));
  const [{ count: scheduledCount }] = await db.select({ count: sql<number>`count(*)::int` }).from(handoverRequestsTable).where(scheduledWhere);
  const completedWhere = and(eq(handoverRequestsTable.isDeleted, false), eq(handoverRequestsTable.status, "completed"), ...(companyId ? [eq(handoverRequestsTable.companyId, companyId)] : []));
  const [{ count: completedCount }] = await db.select({ count: sql<number>`count(*)::int` }).from(handoverRequestsTable).where(completedWhere);
  const snagWhere = and(eq(handoverSnagsTable.isDeleted, false), eq(handoverSnagsTable.status, "open"), ...(companyId ? [eq(handoverSnagsTable.companyId, companyId)] : []));
  const [{ count: openSnags }] = await db.select({ count: sql<number>`count(*)::int` }).from(handoverSnagsTable).where(snagWhere);
  res.json(GetHandoverDashboardResponse.parse({ totalRequests: count, scheduledCount, completedCount, openSnags, byStatus: byStatusRows.map((r) => ({ status: r.status, count: r.count })) }));
});

export default router;
