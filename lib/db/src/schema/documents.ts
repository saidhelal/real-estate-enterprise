import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  bigint,
  date,
  jsonb,
  timestamp,
  index,
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
/* Electronic Document Management System (EDMS)                       */
/* إدارة الأرشيف الإلكتروني وإدارة المستندات                          */
/*                                                                    */
/* The single official repository for every company document. A      */
/* document is a stable container; its files live in immutable        */
/* versions (currentVersionId points at the live one). Documents link */
/* polymorphically to any module's record via moduleKey + sourceId    */
/* (same pattern as legal_contracts.sourceModule/sourceId and         */
/* print_jobs.moduleKey/entityId) — never via hard cross-domain FKs.  */
/* Files reuse the existing object-storage flow; an immutable owner   */
/* mapping (document_object_owners) authorizes every serve/preview.   */
/* Nothing is ever hard-deleted: archive/restore only, and an actual  */
/* delete is an Owner/Super-Admin-approved soft delete.               */
/* ------------------------------------------------------------------ */

// A document: the stable metadata record. The physical file content is held in
// document_versions; `currentVersionId` points at the version served/previewed.
// Lifecycle status walks: draft -> review -> approved -> active -> archived ->
// expired (mirrors the Print Engine approval gating). Scope columns
// (branchId/departmentId/projectId + ownerUserId) drive scoped visibility.
export const documentsTable = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  // Auto-generated human document number (DOC-000001).
  documentNumber: text("document_number").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  description: text("description"),
  // Logical kind (contract/invoice/deed/license/drawing/report/...). Centralized
  // in the enum-labels file (DOCUMENT_TYPES).
  documentType: text("document_type").notNull().default("other"),
  // Confidentiality classification: public | internal | confidential | restricted.
  classification: text("classification").notNull().default("internal"),
  // Polymorphic primary link: owning module + source record id (both optional;
  // a document can be general/unlinked). sourceRef holds the human reference.
  moduleKey: text("module_key"),
  sourceId: text("source_id"),
  sourceRef: text("source_ref"),
  // Optional denormalized display/search scope handles (not enforced FKs).
  projectId: uuid("project_id"),
  customerId: uuid("customer_id"),
  unitId: uuid("unit_id"),
  departmentId: uuid("department_id"),
  branchId: uuid("branch_id"),
  // draft | review | approved | active | archived | expired
  status: text("status").notNull().default("draft"),
  // The live version served/previewed (null until the first version exists).
  currentVersionId: uuid("current_version_id"),
  // Calendar dates (YYYY-MM-DD strings): document creation + optional expiry.
  creationDate: date("creation_date"),
  expiryDate: date("expiry_date"),
  // Free-text keywords/tags used by advanced search.
  tags: jsonb("tags"),
  // QR / barcode payloads (generated from the document number; rendered client-side).
  qrValue: text("qr_value"),
  barcodeValue: text("barcode_value"),
  // Signature / stamp images + signer/stamp metadata (image-based, not PKI).
  signatureObjectPath: text("signature_object_path"),
  signerName: text("signer_name"),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  stampObjectPath: text("stamp_object_path"),
  stampLabel: text("stamp_label"),
  // Ownership / authorship for scoped visibility and display.
  ownerUserId: uuid("owner_user_id"),
  createdByUserId: uuid("created_by_user_id"),
  createdByUserName: text("created_by_user_name"),
  lastEditedByUserId: uuid("last_edited_by_user_id"),
  lastEditedByUserName: text("last_edited_by_user_name"),
  // Approval workflow stamps (submit -> endorse -> approve | reject).
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
  // Archive / delete-approval bookkeeping (no hard delete).
  archivedByUserId: uuid("archived_by_user_id"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  deleteRequestedByUserId: uuid("delete_requested_by_user_id"),
  deleteRequestedAt: timestamp("delete_requested_at", { withTimezone: true }),
  deleteReason: text("delete_reason"),
  ...audit,
});
export type DocumentRow = typeof documentsTable.$inferSelect;

// Immutable file version history. Every upload of a new file to a document
// creates a new version; versions are never deleted, and any prior version can
// be made current again ("revert"). Files live in object storage at
// fileObjectPath (an internal /objects/... path).
export const documentVersionsTable = pgTable("document_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  documentId: uuid("document_id").notNull(),
  versionNumber: integer("version_number").notNull().default(1),
  fileObjectPath: text("file_object_path").notNull(),
  fileName: text("file_name"),
  // Normalized extension/category (pdf, docx, xlsx, pptx, image, dwg, dxf, zip,
  // rar, other) used to drive inline-preview vs download.
  fileFormat: text("file_format"),
  mimeType: text("mime_type"),
  fileSize: bigint("file_size", { mode: "number" }),
  changeSummary: text("change_summary"),
  changeReason: text("change_reason"),
  uploadedByUserId: uuid("uploaded_by_user_id"),
  uploadedByUserName: text("uploaded_by_user_name"),
  ...audit,
});
export type DocumentVersionRow = typeof documentVersionsTable.$inferSelect;

// Polymorphic cross-module associations. The document's own moduleKey/sourceId
// is the primary link; this table holds ADDITIONAL links so a single document
// can surface inside several records (e.g. a contract attached to its customer
// and its unit). The reusable Documents panel queries this table (UNION the
// primary link) by moduleKey + sourceId.
export const documentLinksTable = pgTable("document_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  documentId: uuid("document_id").notNull(),
  moduleKey: text("module_key").notNull(),
  sourceId: text("source_id").notNull(),
  sourceRef: text("source_ref"),
  linkedByUserId: uuid("linked_by_user_id"),
  linkedByUserName: text("linked_by_user_name"),
  ...audit,
});
export type DocumentLinkRow = typeof documentLinksTable.$inferSelect;

// Immutable ownership mapping for uploaded object paths (IDOR guard, exactly
// like the portal pattern): serve/preview/download authorize against THIS
// mapping + the owning document's scope, never against a forgeable client ref.
// One row per uploaded object path (version files, signatures, stamps).
export const documentObjectOwnersTable = pgTable("document_object_owners", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companiesTable.id, { onDelete: "restrict" }),
  objectPath: text("object_path").notNull().unique(),
  documentId: uuid("document_id"),
  // What this object is for: version | signature | stamp.
  purpose: text("purpose").notNull().default("version"),
  uploadedByUserId: uuid("uploaded_by_user_id"),
  ...audit,
});
export type DocumentObjectOwnerRow = typeof documentObjectOwnersTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Internal Document Transfer ("Send Document")                       */
/* تحويل / إرسال المستندات داخلياً                                     */
/*                                                                    */
/* Extends the central EDMS into an internal document-communication   */
/* layer. A "transfer" is an envelope: one sender routes an EXISTING  */
/* document (referenced by documentId — never copied) to one or more  */
/* recipients (specific users and/or whole departments). Each         */
/* resolved recipient gets its own row in document_transfer_recipients*/
/* so delivery is tracked per person (sent -> received -> viewed).    */
/* Recipients are notified through the shared Notification Center with */
/* a direct link; opening the actual file still goes through the       */
/* permission-guarded documents endpoints (no access backdoor).       */
/* ------------------------------------------------------------------ */

// The send envelope: one row per "send" action. Holds the sender, the routed
// document, the optional subject/note, and a denormalized recipient summary for
// quick list rendering. The file itself is NOT duplicated — documentId points at
// the single central document.
export const documentTransfersTable = pgTable(
  "document_transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
    documentId: uuid("document_id").notNull(),
    senderUserId: uuid("sender_user_id").notNull(),
    senderUserName: text("sender_user_name"),
    subject: text("subject"),
    note: text("note"),
    // normal | medium | high | urgent (mirrors the notification priority scale).
    priority: text("priority").notNull().default("normal"),
    // Denormalized human list of recipients (names / department names) for list views.
    recipientSummary: text("recipient_summary"),
    // Count of resolved recipients at send time (display convenience).
    recipientCount: integer("recipient_count").notNull().default(0),
    ...audit,
  },
  (t) => [
    index("document_transfers_company_idx").on(t.companyId, t.isDeleted),
    index("document_transfers_sender_idx").on(t.senderUserId, t.isDeleted),
    index("document_transfers_document_idx").on(t.documentId),
  ],
);
export type DocumentTransferRow = typeof documentTransfersTable.$inferSelect;

// One row per resolved recipient user. Status walks sent -> received -> viewed.
// `viaDepartmentId` records the department targeted that put this user on the
// list (null when the user was addressed directly). documentId is denormalized
// so a recipient's inbox can be queried without joining the envelope.
export const documentTransferRecipientsTable = pgTable(
  "document_transfer_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
    transferId: uuid("transfer_id").notNull(),
    documentId: uuid("document_id").notNull(),
    recipientUserId: uuid("recipient_user_id").notNull(),
    recipientUserName: text("recipient_user_name"),
    // Set when the user was reached because a department was targeted (fan-out).
    viaDepartmentId: uuid("via_department_id"),
    viaDepartmentName: text("via_department_name"),
    // sent | received | viewed
    status: text("status").notNull().default("sent"),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    ...audit,
  },
  (t) => [
    index("document_transfer_recipients_recipient_idx").on(
      t.recipientUserId,
      t.isDeleted,
    ),
    index("document_transfer_recipients_transfer_idx").on(t.transferId),
    index("document_transfer_recipients_document_idx").on(t.documentId),
  ],
);
export type DocumentTransferRecipientRow =
  typeof documentTransferRecipientsTable.$inferSelect;
