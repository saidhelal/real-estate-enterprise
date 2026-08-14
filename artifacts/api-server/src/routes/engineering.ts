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

import { registerCrud, type CrudConfig } from "../lib/register-crud";


const resources: CrudConfig[] = [
  // Master Data
  { path: "engineering-disciplines", table: engineeringDisciplinesTable, module: "engineeringDisciplines", entity: "engineeringDiscipline",
    // Issued by the central sequence engine; the client cannot choose it.
    generatedCode: { documentType: "engineeringDiscipline" },
    createBody: CreateEngineeringDisciplineBody, updateBody: UpdateEngineeringDisciplineBody, listResponse: ListEngineeringDisciplinesResponse,
    search: ["code", "name", "nameAr"] },
  { path: "consultants", table: consultantsTable, module: "consultants", entity: "consultant",
    // Issued by the central sequence engine; the client cannot choose it.
    generatedCode: { documentType: "consultant" },
    createBody: CreateConsultantBody, updateBody: UpdateConsultantBody, listResponse: ListConsultantsResponse,
    search: ["code", "name", "nameAr", "email"] },
  { path: "design-packages", table: designPackagesTable, module: "designPackages", entity: "designPackage",
    generatedCode: { documentType: "designPackage" },
    createBody: CreateDesignPackageBody, updateBody: UpdateDesignPackageBody, listResponse: ListDesignPackagesResponse,
    search: ["code", "name", "nameAr"] },
  { path: "drawing-categories", table: drawingCategoriesTable, module: "drawingCategories", entity: "drawingCategory",
    // Issued by the central sequence engine; the client cannot choose it.
    generatedCode: { documentType: "drawingCategory" },
    createBody: CreateDrawingCategoryBody, updateBody: UpdateDrawingCategoryBody, listResponse: ListDrawingCategorysResponse,
    search: ["code", "name", "nameAr"] },
  { path: "technical-specifications", table: technicalSpecificationsTable, module: "technicalSpecifications", entity: "technicalSpecification",
    generatedCode: { documentType: "technicalSpecification" },
    createBody: CreateTechnicalSpecificationBody, updateBody: UpdateTechnicalSpecificationBody, listResponse: ListTechnicalSpecificationsResponse,
    search: ["code", "name", "nameAr"] },
  // Drawings
  { path: "drawings", table: drawingsTable, module: "drawings", entity: "drawing",
    generatedCode: { documentType: "drawing" },
    createBody: CreateDrawingBody, updateBody: UpdateDrawingBody, listResponse: ListDrawingsResponse,
    search: ["code", "title", "titleAr"] },
  { path: "drawing-revisions", table: drawingRevisionsTable, module: "drawingRevisions", entity: "drawingRevision",
    createBody: CreateDrawingRevisionBody, updateBody: UpdateDrawingRevisionBody, listResponse: ListDrawingRevisionsResponse,
    search: ["versionNumber", "revisedBy"] },
  // BOQ
  { path: "boqs", table: boqsTable, module: "boqs", entity: "boq",
    generatedCode: { documentType: "boq" },
    createBody: CreateBoqBody, updateBody: UpdateBoqBody, listResponse: ListBoqsResponse,
    search: ["code", "title", "titleAr"] },
  { path: "boq-items", table: boqItemsTable, module: "boqItems", entity: "boqItem",
    createBody: CreateBoqItemBody, updateBody: UpdateBoqItemBody, listResponse: ListBoqItemsResponse,
    search: ["itemCode", "description"] },
  { path: "boq-quantity-revisions", table: boqQuantityRevisionsTable, module: "boqQuantityRevisions", entity: "boqQuantityRevision",
    createBody: CreateBoqQuantityRevisionBody, updateBody: UpdateBoqQuantityRevisionBody, listResponse: ListBoqQuantityRevisionsResponse,
    search: ["reason"] },
  { path: "cost-estimates", table: costEstimatesTable, module: "costEstimates", entity: "costEstimate",
    generatedCode: { documentType: "costEstimate" },
    createBody: CreateCostEstimateBody, updateBody: UpdateCostEstimateBody, listResponse: ListCostEstimatesResponse,
    search: ["code", "title"] },
  // Site Inspection
  { path: "inspection-requests", table: inspectionRequestsTable, module: "inspectionRequests", entity: "inspectionRequest",
    generatedCode: { documentType: "inspectionRequest" },
    createBody: CreateInspectionRequestBody, updateBody: UpdateInspectionRequestBody, listResponse: ListInspectionRequestsResponse,
    search: ["code", "inspectionType", "requestedBy"] },
  { path: "inspection-reports", table: inspectionReportsTable, module: "inspectionReports", entity: "inspectionReport",
    generatedCode: { documentType: "inspectionReport" },
    createBody: CreateInspectionReportBody, updateBody: UpdateInspectionReportBody, listResponse: ListInspectionReportsResponse,
    search: ["code", "inspector"] },
  { path: "defects", table: defectsTable, module: "defects", entity: "defect",
    generatedCode: { documentType: "defect" },
    createBody: CreateDefectBody, updateBody: UpdateDefectBody, listResponse: ListDefectsResponse,
    search: ["code", "description"] },
  { path: "corrective-actions", table: correctiveActionsTable, module: "correctiveActions", entity: "correctiveAction",
    generatedCode: { documentType: "correctiveAction" },
    createBody: CreateCorrectiveActionBody, updateBody: UpdateCorrectiveActionBody, listResponse: ListCorrectiveActionsResponse,
    search: ["code", "action", "assignedTo"] },
  // Technical Requests
  { path: "rfis", table: rfisTable, module: "rfis", entity: "rfi",
    generatedCode: { documentType: "rfi" },
    createBody: CreateRfiBody, updateBody: UpdateRfiBody, listResponse: ListRfisResponse,
    search: ["code", "subject"] },
  { path: "technical-submittals", table: technicalSubmittalsTable, module: "technicalSubmittals", entity: "technicalSubmittal",
    generatedCode: { documentType: "technicalSubmittal" },
    createBody: CreateTechnicalSubmittalBody, updateBody: UpdateTechnicalSubmittalBody, listResponse: ListTechnicalSubmittalsResponse,
    search: ["code", "title"] },
  { path: "material-submittals", table: materialSubmittalsTable, module: "materialSubmittals", entity: "materialSubmittal",
    generatedCode: { documentType: "materialSubmittal" },
    createBody: CreateMaterialSubmittalBody, updateBody: UpdateMaterialSubmittalBody, listResponse: ListMaterialSubmittalsResponse,
    search: ["code", "materialName", "manufacturer"] },
  { path: "consultant-responses", table: consultantResponsesTable, module: "consultantResponses", entity: "consultantResponse",
    generatedCode: { documentType: "consultantResponse" },
    createBody: CreateConsultantResponseBody, updateBody: UpdateConsultantResponseBody, listResponse: ListConsultantResponsesResponse,
    search: ["code"] },
  // Project Integration
  { path: "engineering-progress", table: engineeringProgressTable, module: "engineeringProgress", entity: "engineeringProgress",
    generatedCode: { documentType: "engineeringProgress" },
    createBody: CreateEngineeringProgressBody, updateBody: UpdateEngineeringProgressBody, listResponse: ListEngineeringProgresssResponse,
    search: ["code", "notes"] },
];

for (const cfg of resources) registerCrud(router, cfg);

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
