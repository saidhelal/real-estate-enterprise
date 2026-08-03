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
/* Contractors & Contracts                                            */
/* ------------------------------------------------------------------ */

export const contractorsTable = pgTable("contractors", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  classification: text("classification"),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  licenseNumber: text("license_number"),
  address: text("address"),
  status: text("status").notNull().default("active"),
  // Per-entity GL control accounts (override the mapping-engine default).
  payableAccountId: uuid("payable_account_id"),
  advanceAccountId: uuid("advance_account_id"),
  ...audit,
});
export type ContractorRow = typeof contractorsTable.$inferSelect;

export const contractorContractsTable = pgTable("contractor_contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  title: text("title").notNull(),
  titleAr: text("title_ar").notNull(),
  contractorId: uuid("contractor_id"),
  projectId: uuid("project_id"),
  phaseId: uuid("phase_id"),
  boqId: uuid("boq_id"),
  contractValue: numeric("contract_value"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  durationDays: integer("duration_days"),
  retentionPercent: numeric("retention_percent"),
  advancePercent: numeric("advance_percent"),
  status: text("status").notNull().default("draft"),
  description: text("description"),
  // Non-breaking back-link to the Legal Affairs master contract registry.
  legalContractId: uuid("legal_contract_id"),
  ...audit,
});
export type ContractorContractRow = typeof contractorContractsTable.$inferSelect;

export const contractBoqItemsTable = pgTable("contract_boq_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  contractId: uuid("contract_id"),
  boqItemId: uuid("boq_item_id"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  unit: text("unit"),
  contractQuantity: numeric("contract_quantity"),
  contractRate: numeric("contract_rate"),
  amount: numeric("amount"),
  ...audit,
});
export type ContractBoqItemRow = typeof contractBoqItemsTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Work Progress                                                       */
/* ------------------------------------------------------------------ */

export const workProgressUpdatesTable = pgTable("work_progress_updates", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  contractId: uuid("contract_id"),
  asOfDate: date("as_of_date"),
  progressPercent: integer("progress_percent"),
  description: text("description"),
  status: text("status").notNull().default("draft"),
  approvedBy: text("approved_by"),
  ...audit,
});
export type WorkProgressUpdateRow = typeof workProgressUpdatesTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Interim Payment Certificates (IPC)                                  */
/* ------------------------------------------------------------------ */

export const paymentCertificatesTable = pgTable("payment_certificates", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  contractId: uuid("contract_id"),
  projectId: uuid("project_id"),
  boqItemId: uuid("boq_item_id"),
  progressUpdateId: uuid("progress_update_id"),
  variationOrderId: uuid("variation_order_id"),
  retentionId: uuid("retention_id"),
  advanceRecoveryId: uuid("advance_recovery_id"),
  certificateNumber: text("certificate_number"),
  periodFrom: date("period_from"),
  periodTo: date("period_to"),
  grossAmount: numeric("gross_amount"),
  previousAmount: numeric("previous_amount"),
  currentAmount: numeric("current_amount"),
  retentionAmount: numeric("retention_amount"),
  advanceRecovery: numeric("advance_recovery"),
  deductionsAmount: numeric("deductions_amount"),
  additionsAmount: numeric("additions_amount"),
  netAmount: numeric("net_amount"),
  status: text("status").notNull().default("draft"),
  certificateDate: date("certificate_date"),
  notes: text("notes"),
  ...audit,
});
export type PaymentCertificateRow = typeof paymentCertificatesTable.$inferSelect;

export const certificateItemsTable = pgTable("certificate_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  certificateId: uuid("certificate_id"),
  boqItemId: uuid("boq_item_id"),
  description: text("description"),
  unit: text("unit"),
  contractQuantity: numeric("contract_quantity"),
  previousQuantity: numeric("previous_quantity"),
  currentQuantity: numeric("current_quantity"),
  cumulativeQuantity: numeric("cumulative_quantity"),
  rate: numeric("rate"),
  amount: numeric("amount"),
  ...audit,
});
export type CertificateItemRow = typeof certificateItemsTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Variations & Change Orders                                          */
/* ------------------------------------------------------------------ */

export const variationOrdersTable = pgTable("variation_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  contractId: uuid("contract_id"),
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  variationType: text("variation_type").notNull().default("addition"),
  description: text("description"),
  amount: numeric("amount"),
  status: text("status").notNull().default("draft"),
  requestDate: date("request_date"),
  approvedDate: date("approved_date"),
  ...audit,
});
export type VariationOrderRow = typeof variationOrdersTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Deductions & Additions                                              */
/* ------------------------------------------------------------------ */

export const contractorDeductionsTable = pgTable("contractor_deductions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  contractId: uuid("contract_id"),
  certificateId: uuid("certificate_id"),
  deductionType: text("deduction_type").notNull().default("other"),
  description: text("description"),
  amount: numeric("amount"),
  deductionDate: date("deduction_date"),
  status: text("status").notNull().default("draft"),
  ...audit,
});
export type ContractorDeductionRow = typeof contractorDeductionsTable.$inferSelect;

export const contractorAdditionsTable = pgTable("contractor_additions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  contractId: uuid("contract_id"),
  certificateId: uuid("certificate_id"),
  additionType: text("addition_type").notNull().default("extra_work"),
  description: text("description"),
  amount: numeric("amount"),
  additionDate: date("addition_date"),
  status: text("status").notNull().default("draft"),
  ...audit,
});
export type ContractorAdditionRow = typeof contractorAdditionsTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Retention & Advance Payments                                        */
/* ------------------------------------------------------------------ */

export const retentionsTable = pgTable("retentions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  contractId: uuid("contract_id"),
  certificateId: uuid("certificate_id"),
  retentionPercent: numeric("retention_percent"),
  retainedAmount: numeric("retained_amount"),
  releasedAmount: numeric("released_amount"),
  releaseDate: date("release_date"),
  status: text("status").notNull().default("held"),
  ...audit,
});
export type RetentionRow = typeof retentionsTable.$inferSelect;

export const advancePaymentsTable = pgTable("advance_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  contractId: uuid("contract_id"),
  amount: numeric("amount"),
  paymentDate: date("payment_date"),
  recoveryPercent: numeric("recovery_percent"),
  recoveredAmount: numeric("recovered_amount"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  ...audit,
});
export type AdvancePaymentRow = typeof advancePaymentsTable.$inferSelect;

export const advanceRecoveriesTable = pgTable("advance_recoveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  advanceId: uuid("advance_id"),
  certificateId: uuid("certificate_id"),
  amount: numeric("amount"),
  recoveryDate: date("recovery_date"),
  ...audit,
});
export type AdvanceRecoveryRow = typeof advanceRecoveriesTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Contractor Invoices                                                 */
/* ------------------------------------------------------------------ */

export const contractorInvoicesTable = pgTable("contractor_invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  contractId: uuid("contract_id"),
  certificateId: uuid("certificate_id"),
  invoiceNumber: text("invoice_number"),
  invoiceDate: date("invoice_date"),
  amount: numeric("amount"),
  status: text("status").notNull().default("registered"),
  verifiedBy: text("verified_by"),
  approvedBy: text("approved_by"),
  notes: text("notes"),
  ...audit,
});
export type ContractorInvoiceRow = typeof contractorInvoicesTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Engineering Approval Workflow                                       */
/* ------------------------------------------------------------------ */

export const contractApprovalsTable = pgTable("contract_approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  contractId: uuid("contract_id"),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  level: text("level").notNull().default("site_engineer"),
  status: text("status").notNull().default("pending"),
  approverName: text("approver_name"),
  approvalDate: date("approval_date"),
  comments: text("comments"),
  ...audit,
});
export type ContractApprovalRow = typeof contractApprovalsTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Payment Certificate Workflow (statuses, approvals, approval logs)   */
/* ------------------------------------------------------------------ */

export const certificateStatusesTable = pgTable("certificate_statuses", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  sequence: integer("sequence"),
  description: text("description"),
  status: text("status").notNull().default("active"),
  ...audit,
});
export type CertificateStatusRow = typeof certificateStatusesTable.$inferSelect;

export const certificateApprovalsTable = pgTable("certificate_approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  certificateId: uuid("certificate_id"),
  level: text("level").notNull().default("site_engineer"),
  status: text("status").notNull().default("pending"),
  approverName: text("approver_name"),
  approvalDate: date("approval_date"),
  comments: text("comments"),
  ...audit,
});
export type CertificateApprovalRow = typeof certificateApprovalsTable.$inferSelect;

export const certificateApprovalLogsTable = pgTable("certificate_approval_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  certificateId: uuid("certificate_id"),
  approvalId: uuid("approval_id"),
  action: text("action"),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  actorName: text("actor_name"),
  actionDate: date("action_date"),
  comments: text("comments"),
  ...audit,
});
export type CertificateApprovalLogRow = typeof certificateApprovalLogsTable.$inferSelect;
