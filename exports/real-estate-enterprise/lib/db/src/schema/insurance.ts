import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
  integer,
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

// === 1. Employee Insurance (تأمينات الموظفين) =============================

// Employee insurance enrollment: registration, insurance numbers, insured
// salary, subscription date and the live insurance status (الموقف التأميني).
// employeeId references the HR employee by uuid (no hard FK, repo convention).
export const employeeInsurancesTable = pgTable("employee_insurances", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  employeeId: uuid("employee_id").notNull(),
  insuranceNumber: text("insurance_number"),
  insuranceAuthority: text("insurance_authority"),
  insuranceType: text("insurance_type").notNull().default("comprehensive"),
  insuranceSalary: numeric("insurance_salary", { precision: 14, scale: 2 }),
  basicSalary: numeric("basic_salary", { precision: 14, scale: 2 }),
  subscriptionDate: date("subscription_date"),
  insuranceOffice: text("insurance_office"),
  insuranceStatus: text("insurance_status").notNull().default("active"),
  notes: text("notes"),
  ...audit,
});
export type EmployeeInsuranceRow = typeof employeeInsurancesTable.$inferSelect;

// === 2. Social Insurance (التأمينات الاجتماعية) ===========================

// Insurance forms registry (نماذج التأمينات): addition/exclusion/salary-update
// government forms with their submission lifecycle.
export const insuranceFormsTable = pgTable("insurance_forms", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  formType: text("form_type").notNull().default("addition"),
  formNumber: text("form_number"),
  employeeInsuranceId: uuid("employee_insurance_id"),
  employeeId: uuid("employee_id"),
  submissionDate: date("submission_date"),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  ...audit,
});
export type InsuranceFormRow = typeof insuranceFormsTable.$inferSelect;

// Employee additions to the insurance scheme (إضافات الموظفين).
export const insuranceAdditionsTable = pgTable("insurance_additions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  employeeId: uuid("employee_id").notNull(),
  employeeInsuranceId: uuid("employee_insurance_id"),
  additionDate: date("addition_date"),
  insuranceSalary: numeric("insurance_salary", { precision: 14, scale: 2 }),
  formNumber: text("form_number"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  ...audit,
});
export type InsuranceAdditionRow = typeof insuranceAdditionsTable.$inferSelect;

// Employee exclusions from the insurance scheme (استبعادات الموظفين).
export const insuranceExclusionsTable = pgTable("insurance_exclusions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  employeeId: uuid("employee_id").notNull(),
  employeeInsuranceId: uuid("employee_insurance_id"),
  exclusionDate: date("exclusion_date"),
  reason: text("reason").notNull().default("resignation"),
  formNumber: text("form_number"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  ...audit,
});
export type InsuranceExclusionRow = typeof insuranceExclusionsTable.$inferSelect;

// Insured-data amendments (تعديلات البيانات): salary/name/data corrections.
export const insuranceDataAmendmentsTable = pgTable("insurance_data_amendments", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  employeeId: uuid("employee_id").notNull(),
  employeeInsuranceId: uuid("employee_insurance_id"),
  amendmentType: text("amendment_type").notNull().default("salary"),
  fieldName: text("field_name"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  amendmentDate: date("amendment_date"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  ...audit,
});
export type InsuranceDataAmendmentRow = typeof insuranceDataAmendmentsTable.$inferSelect;

// === 3. Insurance Payments (سداد التأمينات) ===============================

// Monthly insurance subscriptions (الاشتراكات الشهرية). Auto-posts to the GL
// via event key `insurance.subscription` on create; reverses on delete.
export const insuranceSubscriptionsTable = pgTable("insurance_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  branchId: uuid("branch_id"),
  code: text("code").notNull(),
  period: text("period").notNull(),
  dueDate: date("due_date"),
  employerShare: numeric("employer_share", { precision: 14, scale: 2 }),
  employeeShare: numeric("employee_share", { precision: 14, scale: 2 }),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  employeeCount: integer("employee_count"),
  status: text("status").notNull().default("pending"),
  paymentDate: date("payment_date"),
  paymentMethod: text("payment_method"),
  reference: text("reference"),
  notes: text("notes"),
  ...audit,
});
export type InsuranceSubscriptionRow = typeof insuranceSubscriptionsTable.$inferSelect;

// Payment notices issued by the insurance authority (إشعارات السداد).
export const insurancePaymentNoticesTable = pgTable("insurance_payment_notices", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  noticeNumber: text("notice_number"),
  subscriptionId: uuid("subscription_id"),
  period: text("period"),
  amount: numeric("amount", { precision: 14, scale: 2 }),
  noticeDate: date("notice_date"),
  dueDate: date("due_date"),
  status: text("status").notNull().default("open"),
  notes: text("notes"),
  ...audit,
});
export type InsurancePaymentNoticeRow = typeof insurancePaymentNoticesTable.$inferSelect;

// Monthly reconciliations between expected and paid amounts (المطابقات الشهرية).
export const insuranceReconciliationsTable = pgTable("insurance_reconciliations", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  period: text("period").notNull(),
  expectedAmount: numeric("expected_amount", { precision: 14, scale: 2 }),
  actualAmount: numeric("actual_amount", { precision: 14, scale: 2 }),
  difference: numeric("difference", { precision: 14, scale: 2 }),
  status: text("status").notNull().default("pending"),
  reconciliationDate: date("reconciliation_date"),
  notes: text("notes"),
  ...audit,
});
export type InsuranceReconciliationRow = typeof insuranceReconciliationsTable.$inferSelect;

// Outstanding arrears (المتأخرات).
export const insuranceArrearsTable = pgTable("insurance_arrears", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  period: text("period"),
  subscriptionId: uuid("subscription_id"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
  dueDate: date("due_date"),
  daysOverdue: integer("days_overdue"),
  status: text("status").notNull().default("outstanding"),
  notes: text("notes"),
  ...audit,
});
export type InsuranceArrearRow = typeof insuranceArrearsTable.$inferSelect;

// Penalties / fines (الغرامات). Auto-posts to the GL via event key
// `insurance.penalty` on create; reverses on delete.
export const insurancePenaltiesTable = pgTable("insurance_penalties", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  branchId: uuid("branch_id"),
  code: text("code").notNull(),
  penaltyType: text("penalty_type").notNull().default("late_payment"),
  subscriptionId: uuid("subscription_id"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
  penaltyDate: date("penalty_date"),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  paymentDate: date("payment_date"),
  reference: text("reference"),
  notes: text("notes"),
  ...audit,
});
export type InsurancePenaltyRow = typeof insurancePenaltiesTable.$inferSelect;

// === 4. End of Service (إنهاء الخدمة) =====================================

// Service termination records (إنهاء الخدمة).
export const serviceTerminationsTable = pgTable("service_terminations", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  employeeId: uuid("employee_id").notNull(),
  employeeInsuranceId: uuid("employee_insurance_id"),
  terminationDate: date("termination_date"),
  reason: text("reason").notNull().default("resignation"),
  lastWorkingDay: date("last_working_day"),
  status: text("status").notNull().default("open"),
  notes: text("notes"),
  ...audit,
});
export type ServiceTerminationRow = typeof serviceTerminationsTable.$inferSelect;

// Insurance settlements on termination (التسويات التأمينية).
export const insuranceSettlementsTable = pgTable("insurance_settlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  serviceTerminationId: uuid("service_termination_id"),
  employeeId: uuid("employee_id").notNull(),
  settlementAmount: numeric("settlement_amount", { precision: 14, scale: 2 }),
  settlementDate: date("settlement_date"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  ...audit,
});
export type InsuranceSettlementRow = typeof insuranceSettlementsTable.$inferSelect;

// Final clearances (المخالصات).
export const insuranceClearancesTable = pgTable("insurance_clearances", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  employeeId: uuid("employee_id").notNull(),
  serviceTerminationId: uuid("service_termination_id"),
  clearanceDate: date("clearance_date"),
  amount: numeric("amount", { precision: 14, scale: 2 }),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  ...audit,
});
export type InsuranceClearanceRow = typeof insuranceClearancesTable.$inferSelect;

// === 5. Contractor & Temporary Labor Insurance ============================
//        (تأمينات المقاولين والعمالة المؤقتة)

// Subcontractor / temp-labor insurance with its live status (مقاولي الباطن +
// الموقف التأميني للمقاولين). projectId references a project by uuid (no FK).
export const subcontractorInsurancesTable = pgTable("subcontractor_insurances", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  contractorName: text("contractor_name").notNull(),
  contractorType: text("contractor_type").notNull().default("subcontractor"),
  insuranceNumber: text("insurance_number"),
  projectId: uuid("project_id"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  coverageAmount: numeric("coverage_amount", { precision: 14, scale: 2 }),
  insuranceStatus: text("insurance_status").notNull().default("active"),
  notes: text("notes"),
  ...audit,
});
export type SubcontractorInsuranceRow = typeof subcontractorInsurancesTable.$inferSelect;

// Project labor insurance (عمالة المشروعات).
export const projectLaborInsurancesTable = pgTable("project_labor_insurances", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  laborName: text("labor_name").notNull(),
  projectId: uuid("project_id"),
  subcontractorInsuranceId: uuid("subcontractor_insurance_id"),
  insuranceNumber: text("insurance_number"),
  workerCount: integer("worker_count"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  insuranceStatus: text("insurance_status").notNull().default("active"),
  notes: text("notes"),
  ...audit,
});
export type ProjectLaborInsuranceRow = typeof projectLaborInsurancesTable.$inferSelect;
