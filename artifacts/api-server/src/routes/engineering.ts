import { Router, type IRouter } from "express";
import { and, eq, ne, or, ilike, inArray, sql, desc, type SQL } from "drizzle-orm";
import {
  db,
  engineeringDisciplinesTable,
  consultantsTable,
  designPackagesTable,
  drawingCategoriesTable,
  technicalSpecificationsTable,
  drawingsTable,
  drawingRevisionsTable,
  boqsTable,
  boqItemsTable,
  boqQuantityRevisionsTable,
  costEstimatesTable,
  inspectionRequestsTable,
  inspectionReportsTable,
  defectsTable,
  correctiveActionsTable,
  rfisTable,
  technicalSubmittalsTable,
  materialSubmittalsTable,
  consultantResponsesTable,
  engineeringProgressTable,
} from "@workspace/db";
import {
  CreateEngineeringDisciplineBody, UpdateEngineeringDisciplineBody, ListEngineeringDisciplinesResponse,
  CreateConsultantBody, UpdateConsultantBody, ListConsultantsResponse,
  CreateDesignPackageBody, UpdateDesignPackageBody, ListDesignPackagesResponse,
  CreateDrawingCategoryBody, UpdateDrawingCategoryBody, ListDrawingCategorysResponse,
  CreateTechnicalSpecificationBody, UpdateTechnicalSpecificationBody, ListTechnicalSpecificationsResponse,
  CreateDrawingBody, UpdateDrawingBody, ListDrawingsResponse,
  CreateDrawingRevisionBody, UpdateDrawingRevisionBody, ListDrawingRevisionsResponse,
  CreateBoqBody, UpdateBoqBody, ListBoqsResponse,
  CreateBoqItemBody, UpdateBoqItemBody, ListBoqItemsResponse,
  CreateBoqQuantityRevisionBody, UpdateBoqQuantityRevisionBody, ListBoqQuantityRevisionsResponse,
  CreateCostEstimateBody, UpdateCostEstimateBody, ListCostEstimatesResponse,
  CreateInspectionRequestBody, UpdateInspectionRequestBody, ListInspectionRequestsResponse,
  CreateInspectionReportBody, UpdateInspectionReportBody, ListInspectionReportsResponse,
  CreateDefectBody, UpdateDefectBody, ListDefectsResponse,
  CreateCorrectiveActionBody, UpdateCorrectiveActionBody, ListCorrectiveActionsResponse,
  CreateRfiBody, UpdateRfiBody, ListRfisResponse,
  CreateTechnicalSubmittalBody, UpdateTechnicalSubmittalBody, ListTechnicalSubmittalsResponse,
  CreateMaterialSubmittalBody, UpdateMaterialSubmittalBody, ListMaterialSubmittalsResponse,
  CreateConsultantResponseBody, UpdateConsultantResponseBody, ListConsultantResponsesResponse,
  CreateEngineeringProgressBody, UpdateEngineeringProgressBody, ListEngineeringProgresssResponse,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

interface CrudConfig {
  path: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any;
  module: string;
  entity: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createBody: { safeParse(v: unknown): any };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateBody: { safeParse(v: unknown): any };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listResponse: { parse(v: unknown): any };
  search: string[];
}

function registerCrud(cfg: CrudConfig): void {
  const t = cfg.table;

  router.get(`/${cfg.path}`, requirePermission(`${cfg.module}.view`), async (req, res): Promise<void> => {
    const query = req.query as Record<string, unknown>;
    const { page, pageSize, offset } = pageParams(query);
    const search = qStr(query, "search");
    const companyId = qStr(query, "companyId");
    const conds: SQL[] = [eq(t.isDeleted, false)];
    if (companyId) conds.push(eq(t.companyId, companyId));
    if (search && cfg.search.length) {
      const like = `%${search}%`;
      const ors = cfg.search.map((c) => ilike(t[c], like));
      const combined = or(...ors);
      if (combined) conds.push(combined);
    }
    const where = and(...conds);
    const rows = (await db
      .select()
      .from(t)
      .where(where)
      .orderBy(desc(t.createdAt))
      .limit(pageSize)
      .offset(offset)) as Record<string, unknown>[];
    const countRows = (await db
      .select({ count: sql<number>`count(*)::int` })
      .from(t)
      .where(where)) as { count: number }[];
    const count = countRows[0].count;
    res.json(cfg.listResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
  });

  router.post(`/${cfg.path}`, requirePermission(`${cfg.module}.create`), async (req, res): Promise<void> => {
    const parsed = cfg.createBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const inserted = (await db.insert(t).values(parsed.data).returning()) as Record<string, unknown>[];
    const row = inserted[0];
    await recordAudit(req, { action: "create", entity: cfg.entity, entityId: row.id as string, newValue: row });
    res.status(201).json(serializeRow(row));
  });

  router.patch(`/${cfg.path}/:id`, requirePermission(`${cfg.module}.update`), async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const parsed = cfg.updateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const existingRows = (await db
      .select()
      .from(t)
      .where(and(eq(t.id, id), eq(t.isDeleted, false)))) as Record<string, unknown>[];
    const existing = existingRows[0];
    if (!existing) {
      res.status(404).json({ error: `${cfg.entity} not found` });
      return;
    }
    const update: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed.data as Record<string, unknown>)) {
      if (v !== undefined) update[k] = v;
    }
    let row = existing;
    if (Object.keys(update).length) {
      const updated = (await db.update(t).set(update).where(eq(t.id, id)).returning()) as Record<string, unknown>[];
      row = updated[0];
    }
    await recordAudit(req, {
      action: "update",
      entity: cfg.entity,
      entityId: id,
      oldValue: existing,
      newValue: row,
    });
    res.json(serializeRow(row));
  });

  router.delete(`/${cfg.path}/:id`, requirePermission(`${cfg.module}.delete`), async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const deleted = (await db
      .update(t)
      .set({ isDeleted: true, isActive: false })
      .where(and(eq(t.id, id), eq(t.isDeleted, false)))
      .returning()) as Record<string, unknown>[];
    const row = deleted[0];
    if (!row) {
      res.status(404).json({ error: `${cfg.entity} not found` });
      return;
    }
    await recordAudit(req, { action: "delete", entity: cfg.entity, entityId: id });
    res.json({ success: true });
  });
}

const resources: CrudConfig[] = [
  // Master Data
  { path: "engineering-disciplines", table: engineeringDisciplinesTable, module: "engineeringDisciplines", entity: "engineeringDiscipline",
    createBody: CreateEngineeringDisciplineBody, updateBody: UpdateEngineeringDisciplineBody, listResponse: ListEngineeringDisciplinesResponse,
    search: ["code", "name", "nameAr"] },
  { path: "consultants", table: consultantsTable, module: "consultants", entity: "consultant",
    createBody: CreateConsultantBody, updateBody: UpdateConsultantBody, listResponse: ListConsultantsResponse,
    search: ["code", "name", "nameAr", "email"] },
  { path: "design-packages", table: designPackagesTable, module: "designPackages", entity: "designPackage",
    createBody: CreateDesignPackageBody, updateBody: UpdateDesignPackageBody, listResponse: ListDesignPackagesResponse,
    search: ["code", "name", "nameAr"] },
  { path: "drawing-categories", table: drawingCategoriesTable, module: "drawingCategories", entity: "drawingCategory",
    createBody: CreateDrawingCategoryBody, updateBody: UpdateDrawingCategoryBody, listResponse: ListDrawingCategorysResponse,
    search: ["code", "name", "nameAr"] },
  { path: "technical-specifications", table: technicalSpecificationsTable, module: "technicalSpecifications", entity: "technicalSpecification",
    createBody: CreateTechnicalSpecificationBody, updateBody: UpdateTechnicalSpecificationBody, listResponse: ListTechnicalSpecificationsResponse,
    search: ["code", "name", "nameAr"] },
  // Drawings
  { path: "drawings", table: drawingsTable, module: "drawings", entity: "drawing",
    createBody: CreateDrawingBody, updateBody: UpdateDrawingBody, listResponse: ListDrawingsResponse,
    search: ["code", "title", "titleAr"] },
  { path: "drawing-revisions", table: drawingRevisionsTable, module: "drawingRevisions", entity: "drawingRevision",
    createBody: CreateDrawingRevisionBody, updateBody: UpdateDrawingRevisionBody, listResponse: ListDrawingRevisionsResponse,
    search: ["versionNumber", "revisedBy"] },
  // BOQ
  { path: "boqs", table: boqsTable, module: "boqs", entity: "boq",
    createBody: CreateBoqBody, updateBody: UpdateBoqBody, listResponse: ListBoqsResponse,
    search: ["code", "title", "titleAr"] },
  { path: "boq-items", table: boqItemsTable, module: "boqItems", entity: "boqItem",
    createBody: CreateBoqItemBody, updateBody: UpdateBoqItemBody, listResponse: ListBoqItemsResponse,
    search: ["itemCode", "description"] },
  { path: "boq-quantity-revisions", table: boqQuantityRevisionsTable, module: "boqQuantityRevisions", entity: "boqQuantityRevision",
    createBody: CreateBoqQuantityRevisionBody, updateBody: UpdateBoqQuantityRevisionBody, listResponse: ListBoqQuantityRevisionsResponse,
    search: ["reason"] },
  { path: "cost-estimates", table: costEstimatesTable, module: "costEstimates", entity: "costEstimate",
    createBody: CreateCostEstimateBody, updateBody: UpdateCostEstimateBody, listResponse: ListCostEstimatesResponse,
    search: ["code", "title"] },
  // Site Inspection
  { path: "inspection-requests", table: inspectionRequestsTable, module: "inspectionRequests", entity: "inspectionRequest",
    createBody: CreateInspectionRequestBody, updateBody: UpdateInspectionRequestBody, listResponse: ListInspectionRequestsResponse,
    search: ["code", "inspectionType", "requestedBy"] },
  { path: "inspection-reports", table: inspectionReportsTable, module: "inspectionReports", entity: "inspectionReport",
    createBody: CreateInspectionReportBody, updateBody: UpdateInspectionReportBody, listResponse: ListInspectionReportsResponse,
    search: ["code", "inspector"] },
  { path: "defects", table: defectsTable, module: "defects", entity: "defect",
    createBody: CreateDefectBody, updateBody: UpdateDefectBody, listResponse: ListDefectsResponse,
    search: ["code", "description"] },
  { path: "corrective-actions", table: correctiveActionsTable, module: "correctiveActions", entity: "correctiveAction",
    createBody: CreateCorrectiveActionBody, updateBody: UpdateCorrectiveActionBody, listResponse: ListCorrectiveActionsResponse,
    search: ["code", "action", "assignedTo"] },
  // Technical Requests
  { path: "rfis", table: rfisTable, module: "rfis", entity: "rfi",
    createBody: CreateRfiBody, updateBody: UpdateRfiBody, listResponse: ListRfisResponse,
    search: ["code", "subject"] },
  { path: "technical-submittals", table: technicalSubmittalsTable, module: "technicalSubmittals", entity: "technicalSubmittal",
    createBody: CreateTechnicalSubmittalBody, updateBody: UpdateTechnicalSubmittalBody, listResponse: ListTechnicalSubmittalsResponse,
    search: ["code", "title"] },
  { path: "material-submittals", table: materialSubmittalsTable, module: "materialSubmittals", entity: "materialSubmittal",
    createBody: CreateMaterialSubmittalBody, updateBody: UpdateMaterialSubmittalBody, listResponse: ListMaterialSubmittalsResponse,
    search: ["code", "materialName", "manufacturer"] },
  { path: "consultant-responses", table: consultantResponsesTable, module: "consultantResponses", entity: "consultantResponse",
    createBody: CreateConsultantResponseBody, updateBody: UpdateConsultantResponseBody, listResponse: ListConsultantResponsesResponse,
    search: ["code"] },
  // Project Integration
  { path: "engineering-progress", table: engineeringProgressTable, module: "engineeringProgress", entity: "engineeringProgress",
    createBody: CreateEngineeringProgressBody, updateBody: UpdateEngineeringProgressBody, listResponse: ListEngineeringProgresssResponse,
    search: ["code", "notes"] },
];

for (const cfg of resources) registerCrud(cfg);

/* ------------------------------------------------------------------ */
/* Dashboard KPIs                                                      */
/* ------------------------------------------------------------------ */

router.get("/engineering/dashboard", async (req, res): Promise<void> => {
  const companyId = qStr(req.query as Record<string, unknown>, "companyId");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const company = (t: any): SQL | undefined => (companyId ? eq(t.companyId, companyId) : undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countWhere = async (t: any, extra?: SQL): Promise<number> => {
    const conds: SQL[] = [eq(t.isDeleted, false)];
    const c = company(t);
    if (c) conds.push(c);
    if (extra) conds.push(extra);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(t).where(and(...conds));
    return count;
  };

  const [
    drawingsCount,
    pendingDrawingApprovals,
    boqCount,
    openRfis,
    openDefects,
    openInspections,
    consultantsCount,
  ] = await Promise.all([
    countWhere(drawingsTable),
    countWhere(drawingsTable, inArray(drawingsTable.approvalStatus, ["draft", "submitted"])),
    countWhere(boqsTable),
    countWhere(rfisTable, eq(rfisTable.status, "open")),
    countWhere(defectsTable, ne(defectsTable.status, "closed")),
    countWhere(inspectionRequestsTable, eq(inspectionRequestsTable.status, "pending")),
    countWhere(consultantsTable),
  ]);

  const boqConds: SQL[] = [eq(boqsTable.isDeleted, false)];
  const bc = company(boqsTable);
  if (bc) boqConds.push(bc);
  const boqTotalRows = await db
    .select({ total: sql<string>`coalesce(sum(${boqsTable.totalAmount}), 0)::text` })
    .from(boqsTable)
    .where(and(...boqConds));
  const totalBoqValue = boqTotalRows[0].total;

  const drawingStatusConds: SQL[] = [eq(drawingsTable.isDeleted, false)];
  const dc = company(drawingsTable);
  if (dc) drawingStatusConds.push(dc);
  const drawingsByStatus = await db
    .select({ status: drawingsTable.approvalStatus, count: sql<number>`count(*)::int` })
    .from(drawingsTable)
    .where(and(...drawingStatusConds))
    .groupBy(drawingsTable.approvalStatus);

  const defectSeverityConds: SQL[] = [eq(defectsTable.isDeleted, false)];
  const fc = company(defectsTable);
  if (fc) defectSeverityConds.push(fc);
  const defectsBySeverity = await db
    .select({ severity: defectsTable.severity, count: sql<number>`count(*)::int` })
    .from(defectsTable)
    .where(and(...defectSeverityConds))
    .groupBy(defectsTable.severity);

  res.json({
    drawingsCount,
    pendingDrawingApprovals,
    boqCount,
    totalBoqValue,
    openRfis,
    openDefects,
    openInspections,
    consultantsCount,
    drawingsByStatus,
    defectsBySeverity,
  });
});

export default router;
