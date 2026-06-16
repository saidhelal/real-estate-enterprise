import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  db,
  slaPoliciesTable,
  serviceEscalationsTable,
} from "@workspace/db";
import {
  ListSlaPoliciesResponse,
  CreateSlaPolicyBody,
  GetSlaPolicyResponse,
  UpdateSlaPolicyBody,
  ListServiceEscalationsResponse,
  CreateServiceEscalationBody,
  GetServiceEscalationResponse,
  UpdateServiceEscalationBody,
  GetCustomerServiceDashboardResponse,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

// ----- slaPolicies -----
router.get("/sla-policies", requirePermission("slaPolicies.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(slaPoliciesTable.isDeleted, false)];
  const search = qStr(q, "search");
  if (search) {
    const s = or(ilike(slaPoliciesTable.code, `%${search}%`), ilike(slaPoliciesTable.name, `%${search}%`), ilike(slaPoliciesTable.nameAr, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(slaPoliciesTable.companyId, companyId));
  const channel = qStr(q, "channel");
  if (channel) filters.push(eq(slaPoliciesTable.channel, channel));
  const priority = qStr(q, "priority");
  if (priority) filters.push(eq(slaPoliciesTable.priority, priority));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(slaPoliciesTable).where(where);
  const rows = await db.select().from(slaPoliciesTable).where(where).orderBy(desc(slaPoliciesTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListSlaPoliciesResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/sla-policies", requirePermission("slaPolicies.create"), async (req, res): Promise<void> => {
  const parsed = CreateSlaPolicyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(slaPoliciesTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "slaPolicy", entityId: row.id, newValue: row });
  res.status(201).json(GetSlaPolicyResponse.parse(serializeRow(row)));
});

router.get("/sla-policies/:id", requirePermission("slaPolicies.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(slaPoliciesTable).where(and(eq(slaPoliciesTable.id, id), eq(slaPoliciesTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetSlaPolicyResponse.parse(serializeRow(row)));
});

router.patch("/sla-policies/:id", requirePermission("slaPolicies.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateSlaPolicyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(slaPoliciesTable).where(and(eq(slaPoliciesTable.id, id), eq(slaPoliciesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(slaPoliciesTable).set(update).where(eq(slaPoliciesTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "slaPolicy", entityId: id, oldValue: existing, newValue: row });
  res.json(GetSlaPolicyResponse.parse(serializeRow(row)));
});

router.delete("/sla-policies/:id", requirePermission("slaPolicies.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(slaPoliciesTable).set({ isDeleted: true, isActive: false }).where(and(eq(slaPoliciesTable.id, id), eq(slaPoliciesTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "slaPolicy", entityId: id });
  res.json({ success: true });
});

// ----- serviceEscalations -----
router.get("/service-escalations", requirePermission("serviceEscalations.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(serviceEscalationsTable.isDeleted, false)];
  const search = qStr(q, "search");
  if (search) {
    const s = or(ilike(serviceEscalationsTable.code, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(serviceEscalationsTable.companyId, companyId));
  const sourceType = qStr(q, "sourceType");
  if (sourceType) filters.push(eq(serviceEscalationsTable.sourceType, sourceType));
  const sourceId = qStr(q, "sourceId");
  if (sourceId) filters.push(eq(serviceEscalationsTable.sourceId, sourceId));
  const escalatedToUserId = qStr(q, "escalatedToUserId");
  if (escalatedToUserId) filters.push(eq(serviceEscalationsTable.escalatedToUserId, escalatedToUserId));
  const status = qStr(q, "status");
  if (status) filters.push(eq(serviceEscalationsTable.status, status));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(serviceEscalationsTable).where(where);
  const rows = await db.select().from(serviceEscalationsTable).where(where).orderBy(desc(serviceEscalationsTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListServiceEscalationsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/service-escalations", requirePermission("serviceEscalations.create"), async (req, res): Promise<void> => {
  const parsed = CreateServiceEscalationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(serviceEscalationsTable).values({ ...parsed.data, status: "open", resolvedAt: null }).returning();
  await recordAudit(req, { action: "create", entity: "serviceEscalation", entityId: row.id, newValue: row });
  res.status(201).json(GetServiceEscalationResponse.parse(serializeRow(row)));
});

router.get("/service-escalations/:id", requirePermission("serviceEscalations.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(serviceEscalationsTable).where(and(eq(serviceEscalationsTable.id, id), eq(serviceEscalationsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetServiceEscalationResponse.parse(serializeRow(row)));
});

router.patch("/service-escalations/:id", requirePermission("serviceEscalations.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateServiceEscalationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (parsed.data.status === "resolved") {
    res.status(403).json({ error: "Use the resolve endpoint to resolve an escalation" });
    return;
  }
  const [existing] = await db.select().from(serviceEscalationsTable).where(and(eq(serviceEscalationsTable.id, id), eq(serviceEscalationsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(serviceEscalationsTable).set(update).where(eq(serviceEscalationsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "serviceEscalation", entityId: id, oldValue: existing, newValue: row });
  res.json(GetServiceEscalationResponse.parse(serializeRow(row)));
});

router.delete("/service-escalations/:id", requirePermission("serviceEscalations.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(serviceEscalationsTable).set({ isDeleted: true, isActive: false }).where(and(eq(serviceEscalationsTable.id, id), eq(serviceEscalationsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "serviceEscalation", entityId: id });
  res.json({ success: true });
});

router.post("/service-escalations/:id/resolve", requirePermission("serviceEscalations.resolve"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [existing] = await db.select().from(serviceEscalationsTable).where(and(eq(serviceEscalationsTable.id, id), eq(serviceEscalationsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status === "resolved") { res.status(409).json({ error: "Already resolved" }); return; }
  const today = new Date().toISOString().slice(0, 10);
  const [row] = await db.update(serviceEscalationsTable).set({ status: "resolved", resolvedAt: today }).where(eq(serviceEscalationsTable.id, id)).returning();
  await recordAudit(req, { action: "resolve", entity: "serviceEscalation", entityId: id, oldValue: existing, newValue: row });
  res.json(GetServiceEscalationResponse.parse(serializeRow(row)));
});

router.get("/customer-service-dashboard", requirePermission("serviceEscalations.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const companyId = qStr(q, "companyId");
  const base: SQL[] = [eq(serviceEscalationsTable.isDeleted, false)];
  if (companyId) base.push(eq(serviceEscalationsTable.companyId, companyId));
  const where = and(...base);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(serviceEscalationsTable).where(where);
  const openWhere = and(eq(serviceEscalationsTable.isDeleted, false), eq(serviceEscalationsTable.status, "open"), ...(companyId ? [eq(serviceEscalationsTable.companyId, companyId)] : []));
  const [{ count: openEscalations }] = await db.select({ count: sql<number>`count(*)::int` }).from(serviceEscalationsTable).where(openWhere);
  const slaWhere = and(eq(slaPoliciesTable.isDeleted, false), ...(companyId ? [eq(slaPoliciesTable.companyId, companyId)] : []));
  const [{ count: slaPolicies }] = await db.select({ count: sql<number>`count(*)::int` }).from(slaPoliciesTable).where(slaWhere);
  const byStatusRows = await db.select({ status: serviceEscalationsTable.status, count: sql<number>`count(*)::int` }).from(serviceEscalationsTable).where(where).groupBy(serviceEscalationsTable.status);
  res.json(GetCustomerServiceDashboardResponse.parse({ totalEscalations: count, openEscalations, slaPolicies, byStatus: byStatusRows.map((r) => ({ status: r.status, count: r.count })) }));
});

export default router;
