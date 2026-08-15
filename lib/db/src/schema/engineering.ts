import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  date,
  timestamp,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

const audit = {
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ------------------------------------------------------------------ */
/* Master Data                                                         */
/* ------------------------------------------------------------------ */

export const engineeringDisciplinesTable = pgTable("engineering_disciplines", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  description: text("description"),
  ...audit,
});
export type EngineeringDisciplineRow = typeof engineeringDisciplinesTable.$inferSelect;

export const consultantsTable = pgTable("consultants", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  disciplineId: uuid("discipline_id"),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  licenseNumber: text("license_number"),
  address: text("address"),
  ...audit,
});
export type ConsultantRow = typeof consultantsTable.$inferSelect;

export const designPackagesTable = pgTable("design_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  projectId: uuid("project_id"),
  disciplineId: uuid("discipline_id"),
  consultantId: uuid("consultant_id"),
  description: text("description"),
  status: text("status").notNull().default("draft"),
  ...audit,
});
export type DesignPackageRow = typeof designPackagesTable.$inferSelect;

export const drawingCategoriesTable = pgTable("drawing_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  disciplineId: uuid("discipline_id"),
  description: text("description"),
  ...audit,
});
export type DrawingCategoryRow = typeof drawingCategoriesTable.$inferSelect;

export const technicalSpecificationsTable = pgTable("technical_specifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  disciplineId: uuid("discipline_id"),
  section: text("section"),
  content: text("content"),
  version: text("version"),
  ...audit,
});
export type TechnicalSpecificationRow = typeof technicalSpecificationsTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Drawings Management                                                 */
/* ------------------------------------------------------------------ */

export const drawingsTable = pgTable("drawings", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  title: text("title").notNull(),
  titleAr: text("title_ar").notNull(),
  drawingType: text("drawing_type").notNull().default("architectural"),
  disciplineId: uuid("discipline_id"),
  categoryId: uuid("category_id"),
  consultantId: uuid("consultant_id"),
  projectId: uuid("project_id"),
  phaseId: uuid("phase_id"),
  buildingId: uuid("building_id"),
  floorId: uuid("floor_id"),
  currentVersion: text("current_version").notNull().default("A"),
  approvalStatus: text("approval_status").notNull().default("draft"),
  drawingDate: date("drawing_date"),
  description: text("description"),
  ...audit,
});
export type DrawingRow = typeof drawingsTable.$inferSelect;

export const drawingRevisionsTable = pgTable("drawing_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  drawingId: uuid("drawing_id").notNull(),
  versionNumber: text("version_number").notNull(),
  revisionDate: date("revision_date"),
  description: text("description"),
  status: text("status").notNull().default("submitted"),
  revisedBy: text("revised_by"),
  fileReference: text("file_reference"),
  ...audit,
});
export type DrawingRevisionRow = typeof drawingRevisionsTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* BOQ Management                                                      */
/* ------------------------------------------------------------------ */

export const boqsTable = pgTable("boqs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  title: text("title").notNull(),
  titleAr: text("title_ar").notNull(),
  projectId: uuid("project_id"),
  phaseId: uuid("phase_id"),
  status: text("status").notNull().default("draft"),
  totalAmount: numeric("total_amount", { precision: 16, scale: 2 }),
  boqDate: date("boq_date"),
  description: text("description"),
  ...audit,
});
export type BoqRow = typeof boqsTable.$inferSelect;

export const boqItemsTable = pgTable("boq_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  boqId: uuid("boq_id").notNull(),
  itemCode: text("item_code").notNull(),
  description: text("description").notNull(),
  descriptionAr: text("description_ar"),
  unit: text("unit"),
  quantity: numeric("quantity", { precision: 16, scale: 3 }),
  unitPrice: numeric("unit_price", { precision: 16, scale: 2 }),
  amount: numeric("amount", { precision: 16, scale: 2 }),
  ...audit,
});
export type BoqItemRow = typeof boqItemsTable.$inferSelect;

export const boqQuantityRevisionsTable = pgTable("boq_quantity_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  boqItemId: uuid("boq_item_id").notNull(),
  previousQuantity: numeric("previous_quantity", { precision: 16, scale: 3 }),
  newQuantity: numeric("new_quantity", { precision: 16, scale: 3 }),
  reason: text("reason"),
  revisionDate: date("revision_date"),
  ...audit,
});
export type BoqQuantityRevisionRow = typeof boqQuantityRevisionsTable.$inferSelect;

export const costEstimatesTable = pgTable("cost_estimates", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  projectId: uuid("project_id"),
  boqId: uuid("boq_id"),
  estimatedCost: numeric("estimated_cost", { precision: 16, scale: 2 }),
  estimateDate: date("estimate_date"),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  ...audit,
});
export type CostEstimateRow = typeof costEstimatesTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Site Inspection                                                     */
/* ------------------------------------------------------------------ */

export const inspectionRequestsTable = pgTable("inspection_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  projectId: uuid("project_id"),
  phaseId: uuid("phase_id"),
  buildingId: uuid("building_id"),
  inspectionType: text("inspection_type"),
  requestedBy: text("requested_by"),
  requestDate: date("request_date"),
  status: text("status").notNull().default("pending"),
  description: text("description"),
  ...audit,
});
export type InspectionRequestRow = typeof inspectionRequestsTable.$inferSelect;

export const inspectionReportsTable = pgTable("inspection_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  inspectionRequestId: uuid("inspection_request_id"),
  reportDate: date("report_date"),
  inspector: text("inspector"),
  result: text("result").notNull().default("pass"),
  notes: text("notes"),
  ...audit,
});
export type InspectionReportRow = typeof inspectionReportsTable.$inferSelect;

export const defectsTable = pgTable("defects", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  inspectionReportId: uuid("inspection_report_id"),
  projectId: uuid("project_id"),
  description: text("description").notNull(),
  severity: text("severity").notNull().default("medium"),
  status: text("status").notNull().default("open"),
  reportedDate: date("reported_date"),
  ...audit,
});
export type DefectRow = typeof defectsTable.$inferSelect;

/**
 * The one corrective-action register.
 *
 * It began as "what is being done about this construction defect" and is now
 * also "what is being done about this quality finding" — the same object with
 * a different parent. Exactly one of `defectId` and `nonconformityId` is set
 * on any given row; both are nullable so neither owner is privileged and
 * every pre-existing row stays valid.
 *
 * Quality management needs two things a defect action never did: a distinction
 * between fixing this instance and preventing recurrence (`actionType`), and
 * verification by someone other than the person who did the work. Those live
 * here rather than in a parallel table, so there is one place to look for
 * "what are we doing about this" whatever raised it.
 */
export const correctiveActionsTable = pgTable("corrective_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  defectId: uuid("defect_id"),
  action: text("action").notNull(),
  assignedTo: text("assigned_to"),
  dueDate: date("due_date"),
  completedDate: date("completed_date"),
  status: text("status").notNull().default("open"),

  /* ---- Quality management ------------------------------------------------ */
  /** The quality finding this action answers, when it came from one. */
  nonconformityId: uuid("nonconformity_id"),
  /** corrective (fix this) | preventive (stop it recurring) */
  actionType: text("action_type").notNull().default("corrective"),
  /** The owner as an employee, where the free-text `assignedTo` is not enough. */
  ownerEmployeeId: uuid("owner_employee_id"),
  progressPercent: integer("progress_percent").notNull().default(0),
  /** Confirmation that it actually worked — deliberately a different person
   *  from whoever completed it. */
  verifiedByEmployeeId: uuid("verified_by_employee_id"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verificationNotes: text("verification_notes"),
  /** The follow-up assignment, in the register that owns assignments. */
  taskId: uuid("task_id"),
  notes: text("notes"),
  ...audit,
});
export type CorrectiveActionRow = typeof correctiveActionsTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Technical Requests                                                  */
/* ------------------------------------------------------------------ */

export const rfisTable = pgTable("rfis", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  projectId: uuid("project_id"),
  subject: text("subject").notNull(),
  question: text("question"),
  raisedBy: text("raised_by"),
  consultantId: uuid("consultant_id"),
  status: text("status").notNull().default("open"),
  submittedDate: date("submitted_date"),
  responseDate: date("response_date"),
  response: text("response"),
  ...audit,
});
export type RfiRow = typeof rfisTable.$inferSelect;

export const technicalSubmittalsTable = pgTable("technical_submittals", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  projectId: uuid("project_id"),
  title: text("title").notNull(),
  submittalType: text("submittal_type"),
  submittedBy: text("submitted_by"),
  consultantId: uuid("consultant_id"),
  status: text("status").notNull().default("submitted"),
  submittedDate: date("submitted_date"),
  notes: text("notes"),
  ...audit,
});
export type TechnicalSubmittalRow = typeof technicalSubmittalsTable.$inferSelect;

export const materialSubmittalsTable = pgTable("material_submittals", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  projectId: uuid("project_id"),
  materialName: text("material_name").notNull(),
  manufacturer: text("manufacturer"),
  consultantId: uuid("consultant_id"),
  status: text("status").notNull().default("submitted"),
  submittedDate: date("submitted_date"),
  notes: text("notes"),
  ...audit,
});
export type MaterialSubmittalRow = typeof materialSubmittalsTable.$inferSelect;

export const consultantResponsesTable = pgTable("consultant_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  referenceType: text("reference_type").notNull().default("rfi"),
  referenceId: uuid("reference_id"),
  consultantId: uuid("consultant_id"),
  response: text("response"),
  decision: text("decision").notNull().default("approved"),
  responseDate: date("response_date"),
  ...audit,
});
export type ConsultantResponseRow = typeof consultantResponsesTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Project Integration / Progress                                     */
/* ------------------------------------------------------------------ */

export const engineeringProgressTable = pgTable("engineering_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  projectId: uuid("project_id"),
  phaseId: uuid("phase_id"),
  buildingId: uuid("building_id"),
  floorId: uuid("floor_id"),
  designPackageId: uuid("design_package_id"),
  progressPercent: integer("progress_percent").notNull().default(0),
  asOfDate: date("as_of_date"),
  notes: text("notes"),
  ...audit,
});
export type EngineeringProgressRow = typeof engineeringProgressTable.$inferSelect;
