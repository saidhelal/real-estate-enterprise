import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

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
/* Central Print Engine                                               */
/*                                                                    */
/* One engine shared by every module. A module surfaces it as its    */
/* "Forms & Printing" (النماذج والطباعة) sub-section by filtering on   */
/* moduleKey. There is no standalone printing module.                */
/* ------------------------------------------------------------------ */

// A printable form template, scoped to a single module (moduleKey) and
// company. The template is a stable container; its printable content lives
// in immutable versions. `currentVersionId` points at the single APPROVED
// version used for all printing — edits create new versions and never touch
// previously printed documents. Templates are never hard-deleted: `status`
// toggles active/disabled.
export const formTemplatesTable = pgTable("form_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  // Which module's "Forms & Printing" section owns this template
  // (e.g. customers, contracts, finance, procurement, hr, insurance, legal).
  moduleKey: text("module_key").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  description: text("description"),
  // Logical document kind within the module (contract, invoice, receipt,
  // certificate, letter, ...). Drives which binding-catalog entity is used.
  documentType: text("document_type").notNull().default("other"),
  // Origin of the latest content: html (designed in-system), word, pdf.
  sourceFormat: text("source_format").notNull().default("html"),
  // Template-level lifecycle: active | disabled. Never "deleted".
  status: text("status").notNull().default("active"),
  // The approved version currently used for printing (null until first approve).
  currentVersionId: uuid("current_version_id"),
  ...audit,
});
export type FormTemplateRow = typeof formTemplatesTable.$inferSelect;

// Immutable version history for a template. Every create/edit produces a new
// version. A version walks the approval cycle via `status`:
//   draft -> submitted (employee) -> endorsed (dept manager)
//         -> approved (Owner/Super Admin) | rejected
// When a newer version is approved the previous approved version becomes
// `superseded` (kept forever, revertable). Printing only ever uses the
// template's currentVersionId, so old documents never change.
export const formTemplateVersionsTable = pgTable("form_template_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  templateId: uuid("template_id").notNull(),
  versionNumber: integer("version_number").notNull().default(1),
  // Bilingual printable HTML with {{token}} placeholders resolved at print time.
  content: text("content"),
  contentAr: text("content_ar"),
  // Uploaded source (Word/PDF/HTML) kept in object storage as the import origin.
  fileObjectPath: text("file_object_path"),
  fileFormat: text("file_format"),
  // No-code field binding metadata: tokens used + render features
  // (logo / qr / barcode / signature / stamp / page settings / language).
  fieldBindings: jsonb("field_bindings"),
  settings: jsonb("settings"),
  // draft | submitted | endorsed | approved | rejected | superseded
  status: text("status").notNull().default("draft"),
  changeSummary: text("change_summary"),
  changeReason: text("change_reason"),
  submittedByUserId: uuid("submitted_by_user_id"),
  submittedByUserName: text("submitted_by_user_name"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  endorsedByUserId: uuid("endorsed_by_user_id"),
  endorsedByUserName: text("endorsed_by_user_name"),
  endorsedAt: timestamp("endorsed_at", { withTimezone: true }),
  approvedByUserId: uuid("approved_by_user_id"),
  approvedByUserName: text("approved_by_user_name"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectedByUserId: uuid("rejected_by_user_id"),
  rejectedByUserName: text("rejected_by_user_name"),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  rejectReason: text("reject_reason"),
  ...audit,
});
export type FormTemplateVersionRow = typeof formTemplateVersionsTable.$inferSelect;

// Print log. Every print/reprint of a document through the engine is recorded
// here with who/when, the pinned template version, copies, and (for reprints)
// the reason. Reprints are detected per (templateId, entityType, entityId):
// printSequence is the running ordinal, isReprint = sequence > 1.
export const printJobsTable = pgTable("print_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  moduleKey: text("module_key").notNull(),
  templateId: uuid("template_id").notNull(),
  templateVersionId: uuid("template_version_id").notNull(),
  // The source business record this document was rendered from (flexible).
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  documentNumber: text("document_number"),
  language: text("language").notNull().default("ar"),
  copies: integer("copies").notNull().default(1),
  printSequence: integer("print_sequence").notNull().default(1),
  isReprint: boolean("is_reprint").notNull().default(false),
  reprintReason: text("reprint_reason"),
  printedByUserId: uuid("printed_by_user_id"),
  printedByUserName: text("printed_by_user_name"),
  printedAt: timestamp("printed_at", { withTimezone: true }).notNull().defaultNow(),
  ...audit,
});
export type PrintJobRow = typeof printJobsTable.$inferSelect;
