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

const money = { precision: 14, scale: 2 } as const;

/* ------------------------------------------------------------------ */
/* Contract Governance (master registry + lifecycle)                  */
/* ------------------------------------------------------------------ */

// Master contract registry. Polymorphically links to existing domain
// contracts (sourceModule + sourceId) without repointing their FKs, and
// also hosts native legal/other contracts. All lifecycle/governance hangs
// off this table.
export const legalContractsTable = pgTable("legal_contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  branchId: uuid("branch_id"),
  code: text("code").notNull(),
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  contractType: text("contract_type").notNull().default("other"),
  // sales | construction | procurement | legal | other
  sourceModule: text("source_module").notNull().default("legal"),
  sourceId: uuid("source_id"),
  templateId: uuid("template_id"),
  // customer | contractor | supplier | employee | other
  counterpartyType: text("counterparty_type"),
  counterpartyId: uuid("counterparty_id"),
  counterpartyName: text("counterparty_name"),
  // draft | under_review | approved | active | suspended | expired | terminated | renewed | cancelled
  status: text("status").notNull().default("draft"),
  contractDate: date("contract_date"),
  effectiveDate: date("effective_date"),
  expiryDate: date("expiry_date"),
  renewalDate: date("renewal_date"),
  autoRenew: boolean("auto_renew").notNull().default(false),
  value: numeric("value", money).notNull().default("0"),
  currencyId: uuid("currency_id"),
  governingLaw: text("governing_law"),
  responsibleEmployeeId: uuid("responsible_employee_id"),
  advisorId: uuid("advisor_id"),
  currentVersion: integer("current_version").notNull().default(1),
  reviewedBy: uuid("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  approvedBy: uuid("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  terminatedAt: timestamp("terminated_at", { withTimezone: true }),
  terminationReason: text("termination_reason"),
  description: text("description"),
  notes: text("notes"),
  ...audit,
});
export type LegalContractRow = typeof legalContractsTable.$inferSelect;

export const contractTemplatesTable = pgTable("contract_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  contractType: text("contract_type").notNull().default("other"),
  content: text("content"),
  contentAr: text("content_ar"),
  description: text("description"),
  status: text("status").notNull().default("active"),
  ...audit,
});
export type ContractTemplateRow = typeof contractTemplatesTable.$inferSelect;

export const contractVersionsTable = pgTable("contract_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  legalContractId: uuid("legal_contract_id"),
  versionNumber: integer("version_number").notNull().default(1),
  content: text("content"),
  changeSummary: text("change_summary"),
  createdByEmployeeId: uuid("created_by_employee_id"),
  status: text("status").notNull().default("draft"),
  ...audit,
});
export type ContractVersionRow = typeof contractVersionsTable.$inferSelect;

// Named "legal_contract_amendments" to avoid colliding with the existing
// sales "contract_amendments" and procurement "purchase_contract_amendments".
export const legalContractAmendmentsTable = pgTable("legal_contract_amendments", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  legalContractId: uuid("legal_contract_id"),
  code: text("code"),
  amendmentDate: date("amendment_date"),
  description: text("description").notNull(),
  descriptionAr: text("description_ar"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  valueChange: numeric("value_change", money).notNull().default("0"),
  status: text("status").notNull().default("draft"),
  approvedBy: uuid("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  ...audit,
});
export type LegalContractAmendmentRow = typeof legalContractAmendmentsTable.$inferSelect;

export const contractAddendumsTable = pgTable("contract_addendums", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  legalContractId: uuid("legal_contract_id"),
  code: text("code"),
  title: text("title").notNull(),
  addendumDate: date("addendum_date"),
  content: text("content"),
  status: text("status").notNull().default("draft"),
  ...audit,
});
export type ContractAddendumRow = typeof contractAddendumsTable.$inferSelect;

export const legalContractAttachmentsTable = pgTable("legal_contract_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  legalContractId: uuid("legal_contract_id"),
  title: text("title").notNull(),
  documentType: text("document_type").notNull().default("other"),
  fileUrl: text("file_url"),
  notes: text("notes"),
  status: text("status").notNull().default("active"),
  ...audit,
});
export type LegalContractAttachmentRow = typeof legalContractAttachmentsTable.$inferSelect;

// Immutable-ish lifecycle event log for a legal contract.
export const contractEventsTable = pgTable("contract_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  legalContractId: uuid("legal_contract_id"),
  eventType: text("event_type").notNull().default("note"),
  description: text("description"),
  performedBy: uuid("performed_by"),
  eventDate: timestamp("event_date", { withTimezone: true }).notNull().defaultNow(),
  ...audit,
});
export type ContractEventRow = typeof contractEventsTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Litigation & Advisory                                              */
/* ------------------------------------------------------------------ */

export const lawFirmsTable = pgTable("law_firms", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  specialization: text("specialization"),
  notes: text("notes"),
  status: text("status").notNull().default("active"),
  ...audit,
});
export type LawFirmRow = typeof lawFirmsTable.$inferSelect;

export const legalAdvisorsTable = pgTable("legal_advisors", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  // internal | external
  advisorType: text("advisor_type").notNull().default("internal"),
  lawFirmId: uuid("law_firm_id"),
  employeeId: uuid("employee_id"),
  phone: text("phone"),
  email: text("email"),
  specialization: text("specialization"),
  barNumber: text("bar_number"),
  notes: text("notes"),
  status: text("status").notNull().default("active"),
  ...audit,
});
export type LegalAdvisorRow = typeof legalAdvisorsTable.$inferSelect;

export const legalCasesTable = pgTable("legal_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  branchId: uuid("branch_id"),
  code: text("code").notNull(),
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  // civil | commercial | labor | criminal | administrative | arbitration | other
  caseType: text("case_type").notNull().default("civil"),
  // plaintiff | defendant | third_party
  role: text("role").notNull().default("plaintiff"),
  // open | under_review | in_progress | won | lost | settled | appealed | closed
  status: text("status").notNull().default("open"),
  courtName: text("court_name"),
  courtCaseNumber: text("court_case_number"),
  filingDate: date("filing_date"),
  opponentName: text("opponent_name"),
  claimAmount: numeric("claim_amount", money).notNull().default("0"),
  currencyId: uuid("currency_id"),
  advisorId: uuid("advisor_id"),
  lawFirmId: uuid("law_firm_id"),
  responsibleEmployeeId: uuid("responsible_employee_id"),
  // customer | contractor | supplier | employee | other
  counterpartyType: text("counterparty_type"),
  counterpartyId: uuid("counterparty_id"),
  legalContractId: uuid("legal_contract_id"),
  projectId: uuid("project_id"),
  outcome: text("outcome"),
  outcomeAmount: numeric("outcome_amount", money).notNull().default("0"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  description: text("description"),
  notes: text("notes"),
  ...audit,
});
export type LegalCaseRow = typeof legalCasesTable.$inferSelect;

export const legalHearingsTable = pgTable("legal_hearings", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  legalCaseId: uuid("legal_case_id"),
  code: text("code"),
  hearingDate: date("hearing_date"),
  hearingTime: text("hearing_time"),
  location: text("location"),
  courtRoom: text("court_room"),
  // scheduled | held | adjourned | cancelled
  status: text("status").notNull().default("scheduled"),
  summary: text("summary"),
  decision: text("decision"),
  nextHearingDate: date("next_hearing_date"),
  ...audit,
});
export type LegalHearingRow = typeof legalHearingsTable.$inferSelect;

export const legalClaimsTable = pgTable("legal_claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  legalCaseId: uuid("legal_case_id"),
  code: text("code").notNull(),
  // financial | contractual | damages | other
  claimType: text("claim_type").notNull().default("financial"),
  // by_company | against_company
  direction: text("direction").notNull().default("by_company"),
  amount: numeric("amount", money).notNull().default("0"),
  currencyId: uuid("currency_id"),
  // draft | submitted | under_review | accepted | rejected | settled
  status: text("status").notNull().default("draft"),
  claimDate: date("claim_date"),
  description: text("description"),
  ...audit,
});
export type LegalClaimRow = typeof legalClaimsTable.$inferSelect;

export const legalNoticesTable = pgTable("legal_notices", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  // warning | demand | termination | legal | other
  noticeType: text("notice_type").notNull().default("legal"),
  legalCaseId: uuid("legal_case_id"),
  legalContractId: uuid("legal_contract_id"),
  // customer | contractor | supplier | employee | other
  recipientType: text("recipient_type"),
  recipientId: uuid("recipient_id"),
  recipientName: text("recipient_name"),
  subject: text("subject").notNull(),
  body: text("body"),
  noticeDate: date("notice_date"),
  dueDate: date("due_date"),
  deliveryMethod: text("delivery_method"),
  // draft | sent | acknowledged | responded | expired
  status: text("status").notNull().default("draft"),
  ...audit,
});
export type LegalNoticeRow = typeof legalNoticesTable.$inferSelect;

// Generic junction linking a case to any other module record.
export const legalCaseLinksTable = pgTable("legal_case_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  legalCaseId: uuid("legal_case_id"),
  // customer | contractor | supplier | employee | project | contract | reservation | other
  linkedModule: text("linked_module").notNull().default("other"),
  linkedId: uuid("linked_id"),
  linkedName: text("linked_name"),
  notes: text("notes"),
  ...audit,
});
export type LegalCaseLinkRow = typeof legalCaseLinksTable.$inferSelect;
