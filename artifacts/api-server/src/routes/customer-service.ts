import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  db,
  slaPoliciesTable,
  serviceEscalationsTable,
  customersTable,
  contractsTable,
  reservationsTable,
  installmentPlansTable,
  installmentSchedulesTable,
  complaintsTable,
  maintenanceRequestsTable,
  supportTicketsTable,
  callLogsTable,
  workOrdersTable,
  customerSatisfactionSurveysTable,
  leadFollowUpsTable,
  leadsTable,
  handoverRequestsTable,
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
  ListCsComplaintsResponse,
  CreateCsComplaintBody,
  GetCsComplaintResponse,
  UpdateCsComplaintBody,
  ListCsMaintenanceRequestsResponse,
  CreateCsMaintenanceRequestBody,
  GetCsMaintenanceRequestResponse,
  UpdateCsMaintenanceRequestBody,
  ListCsSupportTicketsResponse,
  CreateCsSupportTicketBody,
  GetCsSupportTicketResponse,
  UpdateCsSupportTicketBody,
  ListCallLogsResponse,
  CreateCallLogBody,
  GetCallLogResponse,
  UpdateCallLogBody,
  ListWorkOrdersResponse,
  CreateWorkOrderBody,
  GetWorkOrderResponse,
  UpdateWorkOrderBody,
  ListCustomerSatisfactionSurveysResponse,
  CreateCustomerSatisfactionSurveyBody,
  GetCustomerSatisfactionSurveyResponse,
  UpdateCustomerSatisfactionSurveyBody,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { nextNumber } from "../lib/doc-number";
import { requireAuth, requirePermission } from "../middleware/auth";
import { notify, recipientsByPermission } from "../lib/notify";

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
  const [row] = await db.insert(slaPoliciesTable).values({ ...parsed.data, code: (await nextNumber("slaPolicy", req.authUser?.companyId ?? null)).value }).returning();
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
  // The code belongs to the sequence that issued it, not to the editor.
  delete (update as Record<string, unknown>).code;
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
  const row = await db.transaction(async (tx) => {
    const [created] = await tx.insert(serviceEscalationsTable).values({ ...parsed.data, code: (await nextNumber("serviceEscalation", req.authUser?.companyId ?? null)).value, status: "open", resolvedAt: null }).returning();
    // Notify the person it was escalated to (owner) plus anyone who can resolve
    // escalations. Idempotent per (customer_service, escalation id, complaint_escalated).
    const resolvers = await recipientsByPermission(tx, "serviceEscalations.resolve", {
      companyId: created.companyId,
    });
    await notify(tx, {
      recipientUserIds: [created.escalatedToUserId, ...resolvers].filter((id) => id !== req.authUser?.id),
      companyId: created.companyId,
      actorUserId: req.authUser?.id ?? null,
      category: "customer_service",
      eventType: "complaint_escalated",
      priority: Number(created.level) >= 2 ? "urgent" : "high",
      title: "تصعيد شكوى / Complaint escalated",
      body: `${created.code} · ${created.sourceType} · L${created.level}`,
      sourceModule: "customer_service",
      sourceId: created.id,
      sourceRef: created.code,
      link: "/service-escalations",
    });
    return created;
  });
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
  // The code belongs to the sequence that issued it, not to the editor.
  delete (update as Record<string, unknown>).code;
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

  const cnt = sql<number>`count(*)::int`;
  const [
    [{ count: customers }],
    [{ count: contracts }],
    [{ count: reservations }],
    [{ count: installmentPlans }],
    [{ count: installmentSchedules }],
    [{ count: complaints }],
    [{ count: followUps }],
    [{ count: leads }],
    [{ count: deliveredUnits }],
  ] = await Promise.all([
    db.select({ count: cnt }).from(customersTable).where(and(eq(customersTable.isDeleted, false), ...(companyId ? [eq(customersTable.companyId, companyId)] : []))),
    db.select({ count: cnt }).from(contractsTable).where(and(eq(contractsTable.isDeleted, false), ...(companyId ? [eq(contractsTable.companyId, companyId)] : []))),
    db.select({ count: cnt }).from(reservationsTable).where(and(eq(reservationsTable.isDeleted, false), ...(companyId ? [eq(reservationsTable.companyId, companyId)] : []))),
    db.select({ count: cnt }).from(installmentPlansTable).where(and(eq(installmentPlansTable.isDeleted, false), ...(companyId ? [eq(installmentPlansTable.companyId, companyId)] : []))),
    db.select({ count: cnt }).from(installmentSchedulesTable).where(and(eq(installmentSchedulesTable.isDeleted, false), ...(companyId ? [eq(installmentSchedulesTable.companyId, companyId)] : []))),
    db.select({ count: cnt }).from(complaintsTable).where(and(eq(complaintsTable.isDeleted, false), ...(companyId ? [eq(complaintsTable.companyId, companyId)] : []))),
    db.select({ count: cnt }).from(leadFollowUpsTable).where(and(eq(leadFollowUpsTable.isDeleted, false), ...(companyId ? [eq(leadFollowUpsTable.companyId, companyId)] : []))),
    db.select({ count: cnt }).from(leadsTable).where(and(eq(leadsTable.isDeleted, false), ...(companyId ? [eq(leadsTable.companyId, companyId)] : []))),
    db.select({ count: cnt }).from(handoverRequestsTable).where(and(eq(handoverRequestsTable.isDeleted, false), eq(handoverRequestsTable.status, "completed"), ...(companyId ? [eq(handoverRequestsTable.companyId, companyId)] : []))),
  ]);

  res.json(GetCustomerServiceDashboardResponse.parse({ totalEscalations: count, openEscalations, slaPolicies, customers, contracts, reservations, installmentPlans, installmentSchedules, deliveredUnits, complaints, followUps, leads, byStatus: byStatusRows.map((r) => ({ status: r.status, count: r.count })) }));
});

// ----- Customer Service operational entities (generic CRUD) -----
// Reuses the established pattern: soft-delete list with search/filters,
// create/get/patch/delete, each guarded by `${module}.${action}`, with
// best-effort audit. serializeRow converts Date->ISO; numeric stays string.

interface CrudSchema {
  parse: (v: unknown) => unknown;
  safeParse: (
    v: unknown,
  ) =>
    | { success: true; data: Record<string, unknown> }
    | { success: false; error: { message: string } };
}

import { registerCrud } from "../lib/register-crud";


registerCrud(router, {
  base: "/complaints",
  // Issued by the central sequence engine; the client cannot choose it.
  generatedCode: { documentType: "complaint" },
  module: "complaints",
  entity: "complaint",
  table: complaintsTable,
  searchCols: ["code", "subject"],
  filterCols: ["companyId", "customerId", "category", "status", "assignedToUserId"],
  listResp: ListCsComplaintsResponse,
  createBody: CreateCsComplaintBody,
  getResp: GetCsComplaintResponse,
  updateBody: UpdateCsComplaintBody,
});

registerCrud(router, {
  base: "/maintenance-requests",
  // Issued by the central sequence engine; the client cannot choose it.
  generatedCode: { documentType: "maintenanceRequest" },
  module: "maintenanceRequests",
  entity: "maintenanceRequest",
  table: maintenanceRequestsTable,
  searchCols: ["code", "subject"],
  filterCols: ["companyId", "customerId", "unitId", "category", "priority", "status", "assignedToUserId"],
  listResp: ListCsMaintenanceRequestsResponse,
  createBody: CreateCsMaintenanceRequestBody,
  getResp: GetCsMaintenanceRequestResponse,
  updateBody: UpdateCsMaintenanceRequestBody,
});

registerCrud(router, {
  base: "/support-tickets",
  // Issued by the central sequence engine; the client cannot choose it.
  generatedCode: { documentType: "supportTicket" },
  module: "supportTickets",
  entity: "supportTicket",
  table: supportTicketsTable,
  searchCols: ["code", "subject"],
  filterCols: ["companyId", "customerId", "category", "priority", "status", "assignedToUserId"],
  listResp: ListCsSupportTicketsResponse,
  createBody: CreateCsSupportTicketBody,
  getResp: GetCsSupportTicketResponse,
  updateBody: UpdateCsSupportTicketBody,
});

registerCrud(router, {
  base: "/call-logs",
  // Issued by the central sequence engine; the client cannot choose it.
  generatedCode: { documentType: "callLog" },
  module: "callLogs",
  entity: "callLog",
  table: callLogsTable,
  searchCols: ["code", "subject"],
  filterCols: ["companyId", "customerId", "direction", "channel", "callStatus", "agentUserId"],
  listResp: ListCallLogsResponse,
  createBody: CreateCallLogBody,
  getResp: GetCallLogResponse,
  updateBody: UpdateCallLogBody,
});

registerCrud(router, {
  base: "/work-orders",
  // Issued by the central sequence engine; the client cannot choose it.
  generatedCode: { documentType: "workOrder" },
  module: "workOrders",
  entity: "workOrder",
  table: workOrdersTable,
  searchCols: ["code", "title"],
  filterCols: ["companyId", "customerId", "unitId", "sourceType", "priority", "status", "assignedToUserId"],
  listResp: ListWorkOrdersResponse,
  createBody: CreateWorkOrderBody,
  getResp: GetWorkOrderResponse,
  updateBody: UpdateWorkOrderBody,
});

registerCrud(router, {
  base: "/customer-satisfaction-surveys",
  // Issued by the central sequence engine; the client cannot choose it.
  generatedCode: { documentType: "customerSatisfactionSurvey" },
  module: "customerSatisfactionSurveys",
  entity: "customerSatisfactionSurvey",
  table: customerSatisfactionSurveysTable,
  searchCols: ["code"],
  filterCols: ["companyId", "customerId", "channel", "status"],
  listResp: ListCustomerSatisfactionSurveysResponse,
  createBody: CreateCustomerSatisfactionSurveyBody,
  getResp: GetCustomerSatisfactionSurveyResponse,
  updateBody: UpdateCustomerSatisfactionSurveyBody,
});

export default router;
