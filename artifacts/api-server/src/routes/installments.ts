import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, lt, ne, or, type SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  db,
  installmentPlansTable,
  installmentSchedulesTable,
  installmentCollectionsTable,
  penaltyRulesTable,
} from "@workspace/db";
import {
  ListInstallmentPlansResponse,
  CreateInstallmentPlanBody,
  GetInstallmentPlanResponse,
  UpdateInstallmentPlanBody,
  ListInstallmentSchedulesResponse,
  CreateInstallmentScheduleBody,
  GetInstallmentScheduleResponse,
  UpdateInstallmentScheduleBody,
  ListInstallmentCollectionsResponse,
  CreateInstallmentCollectionBody,
  GetInstallmentCollectionResponse,
  UpdateInstallmentCollectionBody,
  ListPenaltyRulesResponse,
  CreatePenaltyRuleBody,
  GetPenaltyRuleResponse,
  UpdatePenaltyRuleBody,
  ListOverdueInstallmentsResponse,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

// ----- installmentPlans -----
router.get("/installment-plans", requirePermission("installmentPlans.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(installmentPlansTable.isDeleted, false)];
  if (search) {
    const s = or(ilike(installmentPlansTable.code, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(installmentPlansTable.companyId, companyId));
  const contractId = qStr(q, "contractId");
  if (contractId) filters.push(eq(installmentPlansTable.contractId, contractId));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(installmentPlansTable)
    .where(where);
  const rows = await db
    .select()
    .from(installmentPlansTable)
    .where(where)
    .orderBy(desc(installmentPlansTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListInstallmentPlansResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/installment-plans", requirePermission("installmentPlans.create"), async (req, res): Promise<void> => {
  const parsed = CreateInstallmentPlanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(installmentPlansTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "installmentPlan", entityId: row.id, newValue: row });
  res.status(201).json(GetInstallmentPlanResponse.parse(serializeRow(row)));
});

router.get("/installment-plans/:id", requirePermission("installmentPlans.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(installmentPlansTable).where(and(eq(installmentPlansTable.id, id), eq(installmentPlansTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetInstallmentPlanResponse.parse(serializeRow(row)));
});

router.patch("/installment-plans/:id", requirePermission("installmentPlans.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateInstallmentPlanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(installmentPlansTable).where(and(eq(installmentPlansTable.id, id), eq(installmentPlansTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(installmentPlansTable).set(update).where(eq(installmentPlansTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "installmentPlan", entityId: id, oldValue: existing, newValue: row });
  res.json(GetInstallmentPlanResponse.parse(serializeRow(row)));
});

router.delete("/installment-plans/:id", requirePermission("installmentPlans.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(installmentPlansTable).set({ isDeleted: true, isActive: false }).where(and(eq(installmentPlansTable.id, id), eq(installmentPlansTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "installmentPlan", entityId: id });
  res.json({ success: true });
});

// ----- installmentSchedules -----
router.get("/installment-schedules", requirePermission("installmentSchedules.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(installmentSchedulesTable.isDeleted, false)];
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(installmentSchedulesTable.companyId, companyId));
  const planId = qStr(q, "planId");
  if (planId) filters.push(eq(installmentSchedulesTable.planId, planId));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(installmentSchedulesTable)
    .where(where);
  const rows = await db
    .select()
    .from(installmentSchedulesTable)
    .where(where)
    .orderBy(desc(installmentSchedulesTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListInstallmentSchedulesResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/installment-schedules", requirePermission("installmentSchedules.create"), async (req, res): Promise<void> => {
  const parsed = CreateInstallmentScheduleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(installmentSchedulesTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "installmentSchedule", entityId: row.id, newValue: row });
  res.status(201).json(GetInstallmentScheduleResponse.parse(serializeRow(row)));
});

router.get("/installment-schedules/:id", requirePermission("installmentSchedules.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(installmentSchedulesTable).where(and(eq(installmentSchedulesTable.id, id), eq(installmentSchedulesTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetInstallmentScheduleResponse.parse(serializeRow(row)));
});

router.patch("/installment-schedules/:id", requirePermission("installmentSchedules.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateInstallmentScheduleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(installmentSchedulesTable).where(and(eq(installmentSchedulesTable.id, id), eq(installmentSchedulesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(installmentSchedulesTable).set(update).where(eq(installmentSchedulesTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "installmentSchedule", entityId: id, oldValue: existing, newValue: row });
  res.json(GetInstallmentScheduleResponse.parse(serializeRow(row)));
});

router.delete("/installment-schedules/:id", requirePermission("installmentSchedules.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(installmentSchedulesTable).set({ isDeleted: true, isActive: false }).where(and(eq(installmentSchedulesTable.id, id), eq(installmentSchedulesTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "installmentSchedule", entityId: id });
  res.json({ success: true });
});

// ----- installmentCollections -----
router.get("/installment-collections", requirePermission("installmentCollections.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(installmentCollectionsTable.isDeleted, false)];
  if (search) {
    const s = or(ilike(installmentCollectionsTable.reference, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(installmentCollectionsTable.companyId, companyId));
  const scheduleId = qStr(q, "scheduleId");
  if (scheduleId) filters.push(eq(installmentCollectionsTable.scheduleId, scheduleId));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(installmentCollectionsTable)
    .where(where);
  const rows = await db
    .select()
    .from(installmentCollectionsTable)
    .where(where)
    .orderBy(desc(installmentCollectionsTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListInstallmentCollectionsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/installment-collections", requirePermission("installmentCollections.create"), async (req, res): Promise<void> => {
  const parsed = CreateInstallmentCollectionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(installmentCollectionsTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "installmentCollection", entityId: row.id, newValue: row });
  res.status(201).json(GetInstallmentCollectionResponse.parse(serializeRow(row)));
});

router.get("/installment-collections/:id", requirePermission("installmentCollections.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(installmentCollectionsTable).where(and(eq(installmentCollectionsTable.id, id), eq(installmentCollectionsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetInstallmentCollectionResponse.parse(serializeRow(row)));
});

router.patch("/installment-collections/:id", requirePermission("installmentCollections.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateInstallmentCollectionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(installmentCollectionsTable).where(and(eq(installmentCollectionsTable.id, id), eq(installmentCollectionsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(installmentCollectionsTable).set(update).where(eq(installmentCollectionsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "installmentCollection", entityId: id, oldValue: existing, newValue: row });
  res.json(GetInstallmentCollectionResponse.parse(serializeRow(row)));
});

router.delete("/installment-collections/:id", requirePermission("installmentCollections.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(installmentCollectionsTable).set({ isDeleted: true, isActive: false }).where(and(eq(installmentCollectionsTable.id, id), eq(installmentCollectionsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "installmentCollection", entityId: id });
  res.json({ success: true });
});

// ----- penaltyRules -----
router.get("/penalty-rules", requirePermission("penaltyRules.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(penaltyRulesTable.isDeleted, false)];
  if (search) {
    const s = or(ilike(penaltyRulesTable.code, `%${search}%`), ilike(penaltyRulesTable.name, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(penaltyRulesTable.companyId, companyId));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(penaltyRulesTable)
    .where(where);
  const rows = await db
    .select()
    .from(penaltyRulesTable)
    .where(where)
    .orderBy(desc(penaltyRulesTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListPenaltyRulesResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/penalty-rules", requirePermission("penaltyRules.create"), async (req, res): Promise<void> => {
  const parsed = CreatePenaltyRuleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(penaltyRulesTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "penaltyRule", entityId: row.id, newValue: row });
  res.status(201).json(GetPenaltyRuleResponse.parse(serializeRow(row)));
});

router.get("/penalty-rules/:id", requirePermission("penaltyRules.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(penaltyRulesTable).where(and(eq(penaltyRulesTable.id, id), eq(penaltyRulesTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetPenaltyRuleResponse.parse(serializeRow(row)));
});

router.patch("/penalty-rules/:id", requirePermission("penaltyRules.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdatePenaltyRuleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(penaltyRulesTable).where(and(eq(penaltyRulesTable.id, id), eq(penaltyRulesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(penaltyRulesTable).set(update).where(eq(penaltyRulesTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "penaltyRule", entityId: id, oldValue: existing, newValue: row });
  res.json(GetPenaltyRuleResponse.parse(serializeRow(row)));
});

router.delete("/penalty-rules/:id", requirePermission("penaltyRules.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(penaltyRulesTable).set({ isDeleted: true, isActive: false }).where(and(eq(penaltyRulesTable.id, id), eq(penaltyRulesTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "penaltyRule", entityId: id });
  res.json({ success: true });
});

// ----- overdue installments (special read) -----
router.get("/overdue-installments", requirePermission("installmentSchedules.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const today = new Date().toISOString().slice(0, 10);
  const filters: SQL[] = [
    eq(installmentSchedulesTable.isDeleted, false),
    ne(installmentSchedulesTable.status, "paid"),
    lt(installmentSchedulesTable.dueDate, today),
  ];
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(installmentSchedulesTable.companyId, companyId));
  const planId = qStr(q, "planId");
  if (planId) filters.push(eq(installmentSchedulesTable.planId, planId));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(installmentSchedulesTable)
    .where(where);
  const rows = await db
    .select()
    .from(installmentSchedulesTable)
    .where(where)
    .orderBy(desc(installmentSchedulesTable.dueDate))
    .limit(pageSize)
    .offset(offset);
  res.json(ListOverdueInstallmentsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

export default router;
