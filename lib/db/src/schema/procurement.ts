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
/* Supplier Management                                                 */
/* ------------------------------------------------------------------ */

export const supplierCategoriesTable = pgTable("supplier_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  ...audit,
});
export type SupplierCategoryRow = typeof supplierCategoriesTable.$inferSelect;

export const suppliersTable = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  categoryId: uuid("category_id"),
  classification: text("classification"),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  taxNumber: text("tax_number"),
  commercialReg: text("commercial_reg"),
  address: text("address"),
  paymentTerms: text("payment_terms"),
  rating: numeric("rating"),
  status: text("status").notNull().default("active"),
  ...audit,
});
export type SupplierRow = typeof suppliersTable.$inferSelect;

export const supplierContactsTable = pgTable("supplier_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  supplierId: uuid("supplier_id"),
  name: text("name").notNull(),
  position: text("position"),
  email: text("email"),
  phone: text("phone"),
  isPrimary: boolean("is_primary").notNull().default(false),
  notes: text("notes"),
  ...audit,
});
export type SupplierContactRow = typeof supplierContactsTable.$inferSelect;

export const supplierEvaluationsTable = pgTable("supplier_evaluations", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  supplierId: uuid("supplier_id"),
  evaluationDate: date("evaluation_date"),
  period: text("period"),
  qualityScore: numeric("quality_score"),
  deliveryScore: numeric("delivery_score"),
  priceScore: numeric("price_score"),
  serviceScore: numeric("service_score"),
  overallScore: numeric("overall_score"),
  evaluatedBy: text("evaluated_by"),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  ...audit,
});
export type SupplierEvaluationRow = typeof supplierEvaluationsTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Purchase Requests                                                   */
/* ------------------------------------------------------------------ */

export const purchaseRequestsTable = pgTable("purchase_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  title: text("title").notNull(),
  titleAr: text("title_ar").notNull(),
  department: text("department"),
  requestType: text("request_type").notNull().default("item"),
  requestDate: date("request_date"),
  requiredDate: date("required_date"),
  priority: text("priority").notNull().default("medium"),
  budgetAmount: numeric("budget_amount"),
  estimatedAmount: numeric("estimated_amount"),
  requestedBy: text("requested_by"),
  justification: text("justification"),
  status: text("status").notNull().default("draft"),
  ...audit,
});
export type PurchaseRequestRow = typeof purchaseRequestsTable.$inferSelect;

export const purchaseRequestItemsTable = pgTable("purchase_request_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  requestId: uuid("request_id"),
  itemCode: text("item_code"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  unit: text("unit"),
  quantity: numeric("quantity"),
  estimatedPrice: numeric("estimated_price"),
  amount: numeric("amount"),
  notes: text("notes"),
  ...audit,
});
export type PurchaseRequestItemRow = typeof purchaseRequestItemsTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Request for Quotation (RFQ)                                         */
/* ------------------------------------------------------------------ */

export const rfqsTable = pgTable("rfqs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  title: text("title").notNull(),
  titleAr: text("title_ar").notNull(),
  requestId: uuid("request_id"),
  issueDate: date("issue_date"),
  closeDate: date("close_date"),
  status: text("status").notNull().default("draft"),
  description: text("description"),
  ...audit,
});
export type RfqRow = typeof rfqsTable.$inferSelect;

export const rfqItemsTable = pgTable("rfq_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  rfqId: uuid("rfq_id"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  unit: text("unit"),
  quantity: numeric("quantity"),
  notes: text("notes"),
  ...audit,
});
export type RfqItemRow = typeof rfqItemsTable.$inferSelect;

export const rfqSuppliersTable = pgTable("rfq_suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  rfqId: uuid("rfq_id"),
  supplierId: uuid("supplier_id"),
  invitedDate: date("invited_date"),
  status: text("status").notNull().default("invited"),
  notes: text("notes"),
  ...audit,
});
export type RfqSupplierRow = typeof rfqSuppliersTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Supplier Quotations                                                 */
/* ------------------------------------------------------------------ */

export const supplierQuotationsTable = pgTable("supplier_quotations", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  rfqId: uuid("rfq_id"),
  supplierId: uuid("supplier_id"),
  quotationNumber: text("quotation_number"),
  quotationDate: date("quotation_date"),
  validUntil: date("valid_until"),
  totalAmount: numeric("total_amount"),
  technicalScore: numeric("technical_score"),
  commercialScore: numeric("commercial_score"),
  status: text("status").notNull().default("received"),
  notes: text("notes"),
  ...audit,
});
export type SupplierQuotationRow = typeof supplierQuotationsTable.$inferSelect;

export const quotationItemsTable = pgTable("quotation_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  quotationId: uuid("quotation_id"),
  description: text("description"),
  unit: text("unit"),
  quantity: numeric("quantity"),
  unitPrice: numeric("unit_price"),
  amount: numeric("amount"),
  notes: text("notes"),
  ...audit,
});
export type QuotationItemRow = typeof quotationItemsTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Purchase Orders                                                     */
/* ------------------------------------------------------------------ */

export const purchaseOrdersTable = pgTable("purchase_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  supplierId: uuid("supplier_id"),
  quotationId: uuid("quotation_id"),
  requestId: uuid("request_id"),
  orderDate: date("order_date"),
  expectedDate: date("expected_date"),
  totalAmount: numeric("total_amount"),
  deliveryTerms: text("delivery_terms"),
  paymentTerms: text("payment_terms"),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  ...audit,
});
export type PurchaseOrderRow = typeof purchaseOrdersTable.$inferSelect;

export const purchaseOrderItemsTable = pgTable("purchase_order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  poId: uuid("po_id"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  unit: text("unit"),
  quantity: numeric("quantity"),
  receivedQuantity: numeric("received_quantity"),
  unitPrice: numeric("unit_price"),
  amount: numeric("amount"),
  notes: text("notes"),
  ...audit,
});
export type PurchaseOrderItemRow = typeof purchaseOrderItemsTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Purchase Contracts                                                  */
/* ------------------------------------------------------------------ */

export const purchaseContractsTable = pgTable("purchase_contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  title: text("title").notNull(),
  titleAr: text("title_ar").notNull(),
  supplierId: uuid("supplier_id"),
  contractValue: numeric("contract_value"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  documentRef: text("document_ref"),
  status: text("status").notNull().default("draft"),
  description: text("description"),
  ...audit,
});
export type PurchaseContractRow = typeof purchaseContractsTable.$inferSelect;

export const purchaseContractAmendmentsTable = pgTable("purchase_contract_amendments", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  contractId: uuid("contract_id"),
  amendmentNumber: text("amendment_number"),
  amendmentDate: date("amendment_date"),
  amendmentValue: numeric("amendment_value"),
  description: text("description"),
  status: text("status").notNull().default("draft"),
  ...audit,
});
export type PurchaseContractAmendmentRow = typeof purchaseContractAmendmentsTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Goods Receipt Notes (GRN)                                           */
/* ------------------------------------------------------------------ */

export const goodsReceiptNotesTable = pgTable("goods_receipt_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  poId: uuid("po_id"),
  supplierId: uuid("supplier_id"),
  receiptDate: date("receipt_date"),
  receiptType: text("receipt_type").notNull().default("full"),
  warehouse: text("warehouse"),
  totalAmount: numeric("total_amount"),
  inspectionStatus: text("inspection_status").notNull().default("pending"),
  inspectedBy: text("inspected_by"),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  ...audit,
});
export type GoodsReceiptNoteRow = typeof goodsReceiptNotesTable.$inferSelect;

export const grnItemsTable = pgTable("grn_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  grnId: uuid("grn_id"),
  poItemId: uuid("po_item_id"),
  description: text("description"),
  unit: text("unit"),
  orderedQuantity: numeric("ordered_quantity"),
  receivedQuantity: numeric("received_quantity"),
  acceptedQuantity: numeric("accepted_quantity"),
  rejectedQuantity: numeric("rejected_quantity"),
  unitPrice: numeric("unit_price"),
  amount: numeric("amount"),
  notes: text("notes"),
  ...audit,
});
export type GrnItemRow = typeof grnItemsTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Purchase Returns                                                    */
/* ------------------------------------------------------------------ */

export const purchaseReturnsTable = pgTable("purchase_returns", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  grnId: uuid("grn_id"),
  supplierId: uuid("supplier_id"),
  returnDate: date("return_date"),
  reason: text("reason"),
  totalAmount: numeric("total_amount"),
  status: text("status").notNull().default("draft"),
  approvedBy: text("approved_by"),
  notes: text("notes"),
  ...audit,
});
export type PurchaseReturnRow = typeof purchaseReturnsTable.$inferSelect;

export const purchaseReturnItemsTable = pgTable("purchase_return_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  returnId: uuid("return_id"),
  description: text("description"),
  unit: text("unit"),
  quantity: numeric("quantity"),
  unitPrice: numeric("unit_price"),
  amount: numeric("amount"),
  reason: text("reason"),
  notes: text("notes"),
  ...audit,
});
export type PurchaseReturnItemRow = typeof purchaseReturnItemsTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Procurement Approval Workflow                                       */
/* ------------------------------------------------------------------ */

export const procurementApprovalsTable = pgTable("procurement_approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  level: text("level").notNull().default("department_head"),
  status: text("status").notNull().default("pending"),
  approverName: text("approver_name"),
  approvalDate: date("approval_date"),
  comments: text("comments"),
  ...audit,
});
export type ProcurementApprovalRow = typeof procurementApprovalsTable.$inferSelect;
