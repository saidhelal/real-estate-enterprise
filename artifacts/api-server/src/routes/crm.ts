import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, isNull, or, type SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  db,
  leadsTable,
  leadSourcesTable,
  leadActivitiesTable,
  leadFollowUpsTable,
  leadAssignmentsTable,
  leadConversionsTable,
} from "@workspace/db";
import {
  ListLeadsResponse,
  CreateLeadBody,
  GetLeadResponse,
  UpdateLeadBody,
  ListLeadSourcesResponse,
  CreateLeadSourceBody,
  GetLeadSourceResponse,
  UpdateLeadSourceBody,
  ListLeadActivitiesResponse,
  CreateLeadActivityBody,
  GetLeadActivityResponse,
  UpdateLeadActivityBody,
  ListLeadFollowUpsResponse,
  CreateLeadFollowUpBody,
  GetLeadFollowUpResponse,
  UpdateLeadFollowUpBody,
  ListLeadAssignmentsResponse,
  CreateLeadAssignmentBody,
  GetLeadAssignmentResponse,
  UpdateLeadAssignmentBody,
  ListLeadConversionsResponse,
  CreateLeadConversionBody,
  GetLeadConversionResponse,
  UpdateLeadConversionBody,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

// ----- leads -----
router.get("/leads", requirePermission("leads.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(leadsTable.isDeleted, false)];
  if (search) {
    const s = or(
      ilike(leadsTable.code, `%${search}%`),
      ilike(leadsTable.fullName, `%${search}%`),
      ilike(leadsTable.phone, `%${search}%`),
      ilike(leadsTable.nationalId, `%${search}%`),
    );
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(leadsTable.companyId, companyId));
  const branchId = qStr(q, "branchId");
  if (branchId) filters.push(eq(leadsTable.branchId, branchId));
  const sourceId = qStr(q, "sourceId");
  if (sourceId) filters.push(eq(leadsTable.sourceId, sourceId));
  const assignedToUserId = qStr(q, "assignedToUserId");
  if (assignedToUserId) filters.push(eq(leadsTable.assignedToUserId, assignedToUserId));
  // Unassigned queue for the Assign Customer screen: leads with no sales user yet.
  if (qStr(q, "unassigned") === "true") filters.push(isNull(leadsTable.assignedToUserId));
  const status = qStr(q, "status");
  if (status) filters.push(eq(leadsTable.status, status));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leadsTable)
    .where(where);
  const rows = await db
    .select()
    .from(leadsTable)
    .where(where)
    .orderBy(desc(leadsTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListLeadsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/leads", requirePermission("leads.create"), async (req, res): Promise<void> => {
  const parsed = CreateLeadBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;
  // Duplicate detection: National ID first, then Mobile (phone). Company-scoped,
  // ignoring soft-deleted leads. Blank values never count as duplicates.
  const nationalId = data.nationalId?.trim();
  const phone = data.phone?.trim();
  const dupConds: SQL[] = [];
  if (nationalId) dupConds.push(eq(leadsTable.nationalId, nationalId));
  if (phone) dupConds.push(eq(leadsTable.phone, phone));
  const dupOr = dupConds.length ? or(...dupConds) : undefined;
  if (dupOr) {
    const existing = await db
      .select()
      .from(leadsTable)
      .where(and(eq(leadsTable.companyId, data.companyId), eq(leadsTable.isDeleted, false), dupOr));
    const byNationalId = nationalId ? existing.find((l) => l.nationalId === nationalId) : undefined;
    const byPhone = phone ? existing.find((l) => l.phone === phone) : undefined;
    const match = byNationalId ?? byPhone;
    if (match) {
      res.status(409).json({
        error: byNationalId
          ? "A lead with this National ID already exists."
          : "A lead with this Mobile already exists.",
        duplicateField: byNationalId ? "nationalId" : "phone",
        existingLeadId: match.id,
      });
      return;
    }
  }
  const [row] = await db.insert(leadsTable).values({ ...data }).returning();
  await recordAudit(req, { action: "create", entity: "lead", entityId: row.id, newValue: row });
  res.status(201).json(GetLeadResponse.parse(serializeRow(row)));
});

router.get("/leads/:id", requirePermission("leads.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(leadsTable).where(and(eq(leadsTable.id, id), eq(leadsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetLeadResponse.parse(serializeRow(row)));
});

router.patch("/leads/:id", requirePermission("leads.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateLeadBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(leadsTable).where(and(eq(leadsTable.id, id), eq(leadsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(leadsTable).set(update).where(eq(leadsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "lead", entityId: id, oldValue: existing, newValue: row });
  res.json(GetLeadResponse.parse(serializeRow(row)));
});

router.delete("/leads/:id", requirePermission("leads.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(leadsTable).set({ isDeleted: true, isActive: false }).where(and(eq(leadsTable.id, id), eq(leadsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "lead", entityId: id });
  res.json({ success: true });
});

// ----- leadSources -----
router.get("/lead-sources", requirePermission("leadSources.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(leadSourcesTable.isDeleted, false)];
  if (search) {
    const s = or(ilike(leadSourcesTable.code, `%${search}%`), ilike(leadSourcesTable.name, `%${search}%`));
    if (s) filters.push(s);
  }
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leadSourcesTable)
    .where(where);
  const rows = await db
    .select()
    .from(leadSourcesTable)
    .where(where)
    .orderBy(desc(leadSourcesTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListLeadSourcesResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/lead-sources", requirePermission("leadSources.create"), async (req, res): Promise<void> => {
  const parsed = CreateLeadSourceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(leadSourcesTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "leadSource", entityId: row.id, newValue: row });
  res.status(201).json(GetLeadSourceResponse.parse(serializeRow(row)));
});

router.get("/lead-sources/:id", requirePermission("leadSources.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(leadSourcesTable).where(and(eq(leadSourcesTable.id, id), eq(leadSourcesTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetLeadSourceResponse.parse(serializeRow(row)));
});

router.patch("/lead-sources/:id", requirePermission("leadSources.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateLeadSourceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(leadSourcesTable).where(and(eq(leadSourcesTable.id, id), eq(leadSourcesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(leadSourcesTable).set(update).where(eq(leadSourcesTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "leadSource", entityId: id, oldValue: existing, newValue: row });
  res.json(GetLeadSourceResponse.parse(serializeRow(row)));
});

router.delete("/lead-sources/:id", requirePermission("leadSources.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(leadSourcesTable).set({ isDeleted: true, isActive: false }).where(and(eq(leadSourcesTable.id, id), eq(leadSourcesTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "leadSource", entityId: id });
  res.json({ success: true });
});

// ----- leadActivities -----
router.get("/lead-activities", requirePermission("leadActivities.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(leadActivitiesTable.isDeleted, false)];
  if (search) {
    const s = ilike(leadActivitiesTable.subject, `%${search}%`);
    if (s) filters.push(s);
  }
  const leadId = qStr(q, "leadId");
  if (leadId) filters.push(eq(leadActivitiesTable.leadId, leadId));
  const customerId = qStr(q, "customerId");
  if (customerId) filters.push(eq(leadActivitiesTable.customerId, customerId));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leadActivitiesTable)
    .where(where);
  const rows = await db
    .select()
    .from(leadActivitiesTable)
    .where(where)
    .orderBy(desc(leadActivitiesTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListLeadActivitiesResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/lead-activities", requirePermission("leadActivities.create"), async (req, res): Promise<void> => {
  const parsed = CreateLeadActivityBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!parsed.data.leadId && !parsed.data.customerId) {
    res.status(400).json({ error: "Either leadId or customerId is required" });
    return;
  }
  const userId = req.authUser?.id ?? parsed.data.userId;
  const [row] = await db.insert(leadActivitiesTable).values({ ...parsed.data, userId }).returning();
  await recordAudit(req, { action: "create", entity: "leadActivity", entityId: row.id, newValue: row });
  res.status(201).json(GetLeadActivityResponse.parse(serializeRow(row)));
});

router.get("/lead-activities/:id", requirePermission("leadActivities.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(leadActivitiesTable).where(and(eq(leadActivitiesTable.id, id), eq(leadActivitiesTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetLeadActivityResponse.parse(serializeRow(row)));
});

router.patch("/lead-activities/:id", requirePermission("leadActivities.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateLeadActivityBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(leadActivitiesTable).where(and(eq(leadActivitiesTable.id, id), eq(leadActivitiesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(leadActivitiesTable).set(update).where(eq(leadActivitiesTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "leadActivity", entityId: id, oldValue: existing, newValue: row });
  res.json(GetLeadActivityResponse.parse(serializeRow(row)));
});

router.delete("/lead-activities/:id", requirePermission("leadActivities.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(leadActivitiesTable).set({ isDeleted: true, isActive: false }).where(and(eq(leadActivitiesTable.id, id), eq(leadActivitiesTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "leadActivity", entityId: id });
  res.json({ success: true });
});

// ----- leadFollowUps -----
router.get("/lead-follow-ups", requirePermission("leadFollowUps.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(leadFollowUpsTable.isDeleted, false)];
  if (search) {
    const s = ilike(leadFollowUpsTable.notes, `%${search}%`);
    if (s) filters.push(s);
  }
  const leadId = qStr(q, "leadId");
  if (leadId) filters.push(eq(leadFollowUpsTable.leadId, leadId));
  const customerId = qStr(q, "customerId");
  if (customerId) filters.push(eq(leadFollowUpsTable.customerId, customerId));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leadFollowUpsTable)
    .where(where);
  const rows = await db
    .select()
    .from(leadFollowUpsTable)
    .where(where)
    .orderBy(desc(leadFollowUpsTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListLeadFollowUpsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/lead-follow-ups", requirePermission("leadFollowUps.create"), async (req, res): Promise<void> => {
  const parsed = CreateLeadFollowUpBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (!parsed.data.leadId && !parsed.data.customerId) {
    res.status(400).json({ error: "Either leadId or customerId is required" });
    return;
  }
  const userId = req.authUser?.id ?? parsed.data.userId;
  const [row] = await db.insert(leadFollowUpsTable).values({ ...parsed.data, userId }).returning();
  await recordAudit(req, { action: "create", entity: "leadFollowUp", entityId: row.id, newValue: row });
  res.status(201).json(GetLeadFollowUpResponse.parse(serializeRow(row)));
});

router.get("/lead-follow-ups/:id", requirePermission("leadFollowUps.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(leadFollowUpsTable).where(and(eq(leadFollowUpsTable.id, id), eq(leadFollowUpsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetLeadFollowUpResponse.parse(serializeRow(row)));
});

router.patch("/lead-follow-ups/:id", requirePermission("leadFollowUps.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateLeadFollowUpBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(leadFollowUpsTable).where(and(eq(leadFollowUpsTable.id, id), eq(leadFollowUpsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(leadFollowUpsTable).set(update).where(eq(leadFollowUpsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "leadFollowUp", entityId: id, oldValue: existing, newValue: row });
  res.json(GetLeadFollowUpResponse.parse(serializeRow(row)));
});

router.delete("/lead-follow-ups/:id", requirePermission("leadFollowUps.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(leadFollowUpsTable).set({ isDeleted: true, isActive: false }).where(and(eq(leadFollowUpsTable.id, id), eq(leadFollowUpsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "leadFollowUp", entityId: id });
  res.json({ success: true });
});

// ----- leadAssignments -----
router.get("/lead-assignments", requirePermission("leadAssignments.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(leadAssignmentsTable.isDeleted, false)];
  if (search) {
    const s = ilike(leadAssignmentsTable.notes, `%${search}%`);
    if (s) filters.push(s);
  }
  const leadId = qStr(q, "leadId");
  if (leadId) filters.push(eq(leadAssignmentsTable.leadId, leadId));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leadAssignmentsTable)
    .where(where);
  const rows = await db
    .select()
    .from(leadAssignmentsTable)
    .where(where)
    .orderBy(desc(leadAssignmentsTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListLeadAssignmentsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/lead-assignments", requirePermission("leadAssignments.create"), async (req, res): Promise<void> => {
  const parsed = CreateLeadAssignmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  // branchId is not stored on the assignment history row; it is applied to the
  // lead itself (leads already own branchId). Keep it out of the insert.
  const { branchId, ...assignment } = parsed.data;
  const [row] = await db.insert(leadAssignmentsTable).values({ ...assignment }).returning();
  // The assignment must actually take effect on the lead so it leaves the
  // "unassigned" queue: set the sales user (and branch when provided).
  const leadUpdate: { assignedToUserId: string; branchId?: string } = {
    assignedToUserId: assignment.assignedToUserId,
  };
  if (branchId) leadUpdate.branchId = branchId;
  await db
    .update(leadsTable)
    .set(leadUpdate)
    .where(and(eq(leadsTable.id, assignment.leadId), eq(leadsTable.isDeleted, false)));
  await recordAudit(req, { action: "create", entity: "leadAssignment", entityId: row.id, newValue: row });
  res.status(201).json(GetLeadAssignmentResponse.parse(serializeRow(row)));
});

router.get("/lead-assignments/:id", requirePermission("leadAssignments.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(leadAssignmentsTable).where(and(eq(leadAssignmentsTable.id, id), eq(leadAssignmentsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetLeadAssignmentResponse.parse(serializeRow(row)));
});

router.patch("/lead-assignments/:id", requirePermission("leadAssignments.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateLeadAssignmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(leadAssignmentsTable).where(and(eq(leadAssignmentsTable.id, id), eq(leadAssignmentsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(leadAssignmentsTable).set(update).where(eq(leadAssignmentsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "leadAssignment", entityId: id, oldValue: existing, newValue: row });
  res.json(GetLeadAssignmentResponse.parse(serializeRow(row)));
});

router.delete("/lead-assignments/:id", requirePermission("leadAssignments.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(leadAssignmentsTable).set({ isDeleted: true, isActive: false }).where(and(eq(leadAssignmentsTable.id, id), eq(leadAssignmentsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "leadAssignment", entityId: id });
  res.json({ success: true });
});

// ----- leadConversions -----
router.get("/lead-conversions", requirePermission("leadConversions.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(leadConversionsTable.isDeleted, false)];
  if (search) {
    const s = ilike(leadConversionsTable.notes, `%${search}%`);
    if (s) filters.push(s);
  }
  const leadId = qStr(q, "leadId");
  if (leadId) filters.push(eq(leadConversionsTable.leadId, leadId));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leadConversionsTable)
    .where(where);
  const rows = await db
    .select()
    .from(leadConversionsTable)
    .where(where)
    .orderBy(desc(leadConversionsTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListLeadConversionsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/lead-conversions", requirePermission("leadConversions.create"), async (req, res): Promise<void> => {
  const parsed = CreateLeadConversionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(leadConversionsTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "leadConversion", entityId: row.id, newValue: row });
  res.status(201).json(GetLeadConversionResponse.parse(serializeRow(row)));
});

router.get("/lead-conversions/:id", requirePermission("leadConversions.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(leadConversionsTable).where(and(eq(leadConversionsTable.id, id), eq(leadConversionsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetLeadConversionResponse.parse(serializeRow(row)));
});

router.patch("/lead-conversions/:id", requirePermission("leadConversions.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateLeadConversionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(leadConversionsTable).where(and(eq(leadConversionsTable.id, id), eq(leadConversionsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(leadConversionsTable).set(update).where(eq(leadConversionsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "leadConversion", entityId: id, oldValue: existing, newValue: row });
  res.json(GetLeadConversionResponse.parse(serializeRow(row)));
});

router.delete("/lead-conversions/:id", requirePermission("leadConversions.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(leadConversionsTable).set({ isDeleted: true, isActive: false }).where(and(eq(leadConversionsTable.id, id), eq(leadConversionsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "leadConversion", entityId: id });
  res.json({ success: true });
});

export default router;
