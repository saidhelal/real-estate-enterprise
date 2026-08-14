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
/* Organizational Structure                                            */
/* ------------------------------------------------------------------ */

export const departmentsTable = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  parentId: uuid("parent_id"),
  managerEmployeeId: uuid("manager_employee_id"),
  costCenterId: uuid("cost_center_id"),
  description: text("description"),
  status: text("status").notNull().default("active"),
  ...audit,
});
export type DepartmentRow = typeof departmentsTable.$inferSelect;

export const sectionsTable = pgTable("sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  departmentId: uuid("department_id"),
  managerEmployeeId: uuid("manager_employee_id"),
  description: text("description"),
  status: text("status").notNull().default("active"),
  ...audit,
});
export type SectionRow = typeof sectionsTable.$inferSelect;

export const jobTitlesTable = pgTable("job_titles", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  departmentId: uuid("department_id"),
  grade: text("grade"),
  description: text("description"),
  status: text("status").notNull().default("active"),
  /**
   * Marks this job title as one of the company's institutional leadership
   * posts: `chairman` or `executive_director`.
   *
   * The post is the anchor, never a person. Nothing anywhere stores "user X is
   * the chairman" — the chairman is whoever currently holds the job title
   * carrying this flag, so a succession is a change to one employee's job
   * title and every routing rule, permission and correspondence destination
   * follows automatically. `null` for the ordinary titles, which is nearly all
   * of them.
   */
  leadershipRole: text("leadership_role"),
  ...audit,
});
export type JobTitleRow = typeof jobTitlesTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Employees                                                           */
/* ------------------------------------------------------------------ */

export const employeesTable = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  branchId: uuid("branch_id"),
  code: text("code").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  firstNameAr: text("first_name_ar"),
  lastNameAr: text("last_name_ar"),
  gender: text("gender"),
  dateOfBirth: date("date_of_birth"),
  nationality: text("nationality"),
  nationalId: text("national_id"),
  passportNumber: text("passport_number"),
  maritalStatus: text("marital_status"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  photoUrl: text("photo_url"),
  departmentId: uuid("department_id"),
  sectionId: uuid("section_id"),
  jobTitleId: uuid("job_title_id"),
  managerEmployeeId: uuid("manager_employee_id"),
  employmentType: text("employment_type").notNull().default("full_time"),
  hireDate: date("hire_date"),
  contractStartDate: date("contract_start_date"),
  contractEndDate: date("contract_end_date"),
  basicSalary: numeric("basic_salary", money).notNull().default("0"),
  bankName: text("bank_name"),
  bankAccountNumber: text("bank_account_number"),
  iban: text("iban"),
  status: text("status").notNull().default("active"),
  terminationDate: date("termination_date"),
  notes: text("notes"),
  ...audit,
});
export type EmployeeRow = typeof employeesTable.$inferSelect;

export const employeeDocumentsTable = pgTable("employee_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  employeeId: uuid("employee_id"),
  code: text("code"),
  documentType: text("document_type").notNull().default("other"),
  title: text("title").notNull(),
  documentNumber: text("document_number"),
  issueDate: date("issue_date"),
  expiryDate: date("expiry_date"),
  fileUrl: text("file_url"),
  notes: text("notes"),
  status: text("status").notNull().default("active"),
  ...audit,
});
export type EmployeeDocumentRow = typeof employeeDocumentsTable.$inferSelect;

export const employeeEmergencyContactsTable = pgTable("employee_emergency_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  employeeId: uuid("employee_id"),
  name: text("name").notNull(),
  relationship: text("relationship"),
  phone: text("phone"),
  altPhone: text("alt_phone"),
  address: text("address"),
  ...audit,
});
export type EmployeeEmergencyContactRow = typeof employeeEmergencyContactsTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Attendance & Time Tracking                                         */
/* ------------------------------------------------------------------ */

export const shiftsTable = pgTable("shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  breakMinutes: integer("break_minutes").notNull().default(0),
  workHours: numeric("work_hours", { precision: 6, scale: 2 }).notNull().default("8"),
  status: text("status").notNull().default("active"),
  ...audit,
});
export type ShiftRow = typeof shiftsTable.$inferSelect;

export const attendanceRecordsTable = pgTable("attendance_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  employeeId: uuid("employee_id"),
  shiftId: uuid("shift_id"),
  attendanceDate: date("attendance_date").notNull(),
  checkIn: timestamp("check_in", { withTimezone: true }),
  checkOut: timestamp("check_out", { withTimezone: true }),
  status: text("status").notNull().default("present"),
  lateMinutes: integer("late_minutes").notNull().default(0),
  overtimeHours: numeric("overtime_hours", { precision: 6, scale: 2 }).notNull().default("0"),
  workedHours: numeric("worked_hours", { precision: 6, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  ...audit,
});
export type AttendanceRecordRow = typeof attendanceRecordsTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Leave Management                                                    */
/* ------------------------------------------------------------------ */

export const leaveTypesTable = pgTable("leave_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  daysPerYear: numeric("days_per_year", { precision: 6, scale: 2 }).notNull().default("0"),
  isPaid: boolean("is_paid").notNull().default(true),
  carryForward: boolean("carry_forward").notNull().default(false),
  description: text("description"),
  status: text("status").notNull().default("active"),
  ...audit,
});
export type LeaveTypeRow = typeof leaveTypesTable.$inferSelect;

export const leaveBalancesTable = pgTable("leave_balances", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  employeeId: uuid("employee_id"),
  leaveTypeId: uuid("leave_type_id"),
  year: integer("year").notNull(),
  entitled: numeric("entitled", { precision: 6, scale: 2 }).notNull().default("0"),
  used: numeric("used", { precision: 6, scale: 2 }).notNull().default("0"),
  remaining: numeric("remaining", { precision: 6, scale: 2 }).notNull().default("0"),
  ...audit,
});
export type LeaveBalanceRow = typeof leaveBalancesTable.$inferSelect;

export const leaveRequestsTable = pgTable("leave_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  employeeId: uuid("employee_id"),
  leaveTypeId: uuid("leave_type_id"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  days: numeric("days", { precision: 6, scale: 2 }).notNull().default("0"),
  reason: text("reason"),
  status: text("status").notNull().default("draft"),
  approvedBy: uuid("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectedReason: text("rejected_reason"),
  notes: text("notes"),
  ...audit,
});
export type LeaveRequestRow = typeof leaveRequestsTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Payroll                                                             */
/* ------------------------------------------------------------------ */

export const salaryComponentsTable = pgTable("salary_components", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  componentType: text("component_type").notNull().default("earning"),
  calculationType: text("calculation_type").notNull().default("fixed"),
  amount: numeric("amount", money).notNull().default("0"),
  percentage: numeric("percentage", { precision: 7, scale: 4 }).notNull().default("0"),
  taxable: boolean("taxable").notNull().default(false),
  description: text("description"),
  status: text("status").notNull().default("active"),
  ...audit,
});
export type SalaryComponentRow = typeof salaryComponentsTable.$inferSelect;

export const payrollPeriodsTable = pgTable("payroll_periods", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull().default(1),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  payDate: date("pay_date"),
  status: text("status").notNull().default("open"),
  ...audit,
});
export type PayrollPeriodRow = typeof payrollPeriodsTable.$inferSelect;

export const payrollRunsTable = pgTable("payroll_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  branchId: uuid("branch_id"),
  code: text("code").notNull(),
  payrollPeriodId: uuid("payroll_period_id"),
  runDate: date("run_date").notNull(),
  description: text("description"),
  totalEarnings: numeric("total_earnings", money).notNull().default("0"),
  totalDeductions: numeric("total_deductions", money).notNull().default("0"),
  totalNet: numeric("total_net", money).notNull().default("0"),
  employeeCount: integer("employee_count").notNull().default(0),
  status: text("status").notNull().default("draft"),
  approvedBy: uuid("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  postedBy: uuid("posted_by"),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  reversedAt: timestamp("reversed_at", { withTimezone: true }),
  journalEntryId: uuid("journal_entry_id"),
  ...audit,
});
export type PayrollRunRow = typeof payrollRunsTable.$inferSelect;

export const payslipsTable = pgTable("payslips", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  payrollRunId: uuid("payroll_run_id"),
  employeeId: uuid("employee_id"),
  basicSalary: numeric("basic_salary", money).notNull().default("0"),
  totalEarnings: numeric("total_earnings", money).notNull().default("0"),
  totalDeductions: numeric("total_deductions", money).notNull().default("0"),
  netPay: numeric("net_pay", money).notNull().default("0"),
  status: text("status").notNull().default("draft"),
  paid: boolean("paid").notNull().default(false),
  notes: text("notes"),
  ...audit,
});
export type PayslipRow = typeof payslipsTable.$inferSelect;

export const payslipLinesTable = pgTable("payslip_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  payslipId: uuid("payslip_id"),
  salaryComponentId: uuid("salary_component_id"),
  componentType: text("component_type").notNull().default("earning"),
  description: text("description"),
  amount: numeric("amount", money).notNull().default("0"),
  ...audit,
});
export type PayslipLineRow = typeof payslipLinesTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Loans & Advances                                                   */
/* ------------------------------------------------------------------ */

export const employeeLoansTable = pgTable("employee_loans", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  employeeId: uuid("employee_id"),
  loanType: text("loan_type").notNull().default("personal"),
  amount: numeric("amount", money).notNull().default("0"),
  installmentAmount: numeric("installment_amount", money).notNull().default("0"),
  installmentsCount: integer("installments_count").notNull().default(1),
  startDate: date("start_date"),
  reason: text("reason"),
  status: text("status").notNull().default("draft"),
  outstandingAmount: numeric("outstanding_amount", money).notNull().default("0"),
  paymentMethod: text("payment_method").notNull().default("bank_transfer"),
  cashboxId: uuid("cashbox_id"),
  bankAccountId: uuid("bank_account_id"),
  approvedBy: uuid("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  disbursedAt: timestamp("disbursed_at", { withTimezone: true }),
  journalEntryId: uuid("journal_entry_id"),
  notes: text("notes"),
  ...audit,
});
export type EmployeeLoanRow = typeof employeeLoansTable.$inferSelect;

export const loanInstallmentsTable = pgTable("loan_installments", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  employeeLoanId: uuid("employee_loan_id"),
  employeeId: uuid("employee_id"),
  installmentNumber: integer("installment_number").notNull().default(1),
  dueDate: date("due_date"),
  amount: numeric("amount", money).notNull().default("0"),
  status: text("status").notNull().default("pending"),
  paidDate: date("paid_date"),
  payrollRunId: uuid("payroll_run_id"),
  ...audit,
});
export type LoanInstallmentRow = typeof loanInstallmentsTable.$inferSelect;

export const employeeAdvancesTable = pgTable("employee_advances", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  employeeId: uuid("employee_id"),
  amount: numeric("amount", money).notNull().default("0"),
  requestDate: date("request_date"),
  reason: text("reason"),
  status: text("status").notNull().default("draft"),
  recoveredAmount: numeric("recovered_amount", money).notNull().default("0"),
  paymentMethod: text("payment_method").notNull().default("bank_transfer"),
  cashboxId: uuid("cashbox_id"),
  bankAccountId: uuid("bank_account_id"),
  approvedBy: uuid("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  journalEntryId: uuid("journal_entry_id"),
  notes: text("notes"),
  ...audit,
});
export type EmployeeAdvanceRow = typeof employeeAdvancesTable.$inferSelect;

/* ------------------------------------------------------------------ */
/* Performance Management                                             */
/* ------------------------------------------------------------------ */

export const kpiTemplatesTable = pgTable("kpi_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  category: text("category"),
  weight: numeric("weight", { precision: 6, scale: 2 }).notNull().default("0"),
  maxScore: numeric("max_score", { precision: 6, scale: 2 }).notNull().default("100"),
  description: text("description"),
  status: text("status").notNull().default("active"),
  ...audit,
});
export type KpiTemplateRow = typeof kpiTemplatesTable.$inferSelect;

export const employeeEvaluationsTable = pgTable("employee_evaluations", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  employeeId: uuid("employee_id"),
  evaluatorEmployeeId: uuid("evaluator_employee_id"),
  evaluationPeriod: text("evaluation_period"),
  evaluationDate: date("evaluation_date"),
  totalScore: numeric("total_score", { precision: 6, scale: 2 }).notNull().default("0"),
  rating: text("rating"),
  strengths: text("strengths"),
  weaknesses: text("weaknesses"),
  recommendations: text("recommendations"),
  status: text("status").notNull().default("draft"),
  ...audit,
});
export type EmployeeEvaluationRow = typeof employeeEvaluationsTable.$inferSelect;

export const employeeEvaluationLinesTable = pgTable("employee_evaluation_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  evaluationId: uuid("evaluation_id"),
  kpiTemplateId: uuid("kpi_template_id"),
  description: text("description"),
  weight: numeric("weight", { precision: 6, scale: 2 }).notNull().default("0"),
  score: numeric("score", { precision: 6, scale: 2 }).notNull().default("0"),
  weightedScore: numeric("weighted_score", { precision: 6, scale: 2 }).notNull().default("0"),
  comments: text("comments"),
  ...audit,
});
export type EmployeeEvaluationLineRow = typeof employeeEvaluationLinesTable.$inferSelect;
