import { Router, type IRouter } from "express";
import { and, eq, ne, or, ilike, sql, desc, gte, lte, type SQL } from "drizzle-orm";
import {
  db,
  departmentsTable,
  sectionsTable,
  jobTitlesTable,
  employeesTable,
  employeeDocumentsTable,
  employeeEmergencyContactsTable,
  shiftsTable,
  attendanceRecordsTable,
  leaveTypesTable,
  leaveBalancesTable,
  leaveRequestsTable,
  salaryComponentsTable,
  payrollPeriodsTable,
  payrollRunsTable,
  payslipsTable,
  payslipLinesTable,
  employeeLoansTable,
  loanInstallmentsTable,
  employeeAdvancesTable,
  kpiTemplatesTable,
  employeeEvaluationsTable,
  employeeEvaluationLinesTable,
} from "@workspace/db";
import {
  CreateDepartmentBody, UpdateDepartmentBody, ListDepartmentsResponse,
  CreateSectionBody, UpdateSectionBody, ListSectionsResponse,
  CreateJobTitleBody, UpdateJobTitleBody, ListJobTitlesResponse,
  CreateEmployeeBody, UpdateEmployeeBody, ListEmployeesResponse,
  CreateEmployeeDocumentBody, UpdateEmployeeDocumentBody, ListEmployeeDocumentsResponse,
  CreateEmployeeEmergencyContactBody, UpdateEmployeeEmergencyContactBody, ListEmployeeEmergencyContactsResponse,
  CreateShiftBody, UpdateShiftBody, ListShiftsResponse,
  CreateAttendanceRecordBody, UpdateAttendanceRecordBody, ListAttendanceRecordsResponse,
  CreateLeaveTypeBody, UpdateLeaveTypeBody, ListLeaveTypesResponse,
  CreateLeaveBalanceBody, UpdateLeaveBalanceBody, ListLeaveBalancesResponse,
  CreateLeaveRequestBody, UpdateLeaveRequestBody, ListLeaveRequestsResponse,
  CreateSalaryComponentBody, UpdateSalaryComponentBody, ListSalaryComponentsResponse,
  CreatePayrollPeriodBody, UpdatePayrollPeriodBody, ListPayrollPeriodsResponse,
  CreatePayrollRunBody, UpdatePayrollRunBody, ListPayrollRunsResponse,
  CreatePayslipBody, UpdatePayslipBody, ListPayslipsResponse,
  CreatePayslipLineBody, UpdatePayslipLineBody, ListPayslipLinesResponse,
  CreateEmployeeLoanBody, UpdateEmployeeLoanBody, ListEmployeeLoansResponse,
  CreateLoanInstallmentBody, UpdateLoanInstallmentBody, ListLoanInstallmentsResponse,
  CreateEmployeeAdvanceBody, UpdateEmployeeAdvanceBody, ListEmployeeAdvancesResponse,
  CreateKpiTemplateBody, UpdateKpiTemplateBody, ListKpiTemplatesResponse,
  CreateEmployeeEvaluationBody, UpdateEmployeeEvaluationBody, ListEmployeeEvaluationsResponse,
  CreateEmployeeEvaluationLineBody, UpdateEmployeeEvaluationLineBody, ListEmployeeEvaluationLinesResponse,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";
import {
  postAutomaticEntry,
  postAutomaticLines,
  reverseAutomaticEntriesForSource,
  getCompanyMapping,
  PostingError,
  type Tx,
  type EntryLineInput,
} from "../lib/posting";

const router: IRouter = Router();
router.use(requireAuth);

import { registerCrud, type CrudConfig } from "../lib/register-crud";

// HR-local helper, unrelated to CRUD infrastructure — it sat next to the old
// factory and stays here, used by the leave/attendance handlers below.
function today(): string {
  return new Date().toISOString().slice(0, 10);
}


const resources: CrudConfig[] = [
  { path: "departments", table: departmentsTable, module: "departments", entity: "department",
    createBody: CreateDepartmentBody, updateBody: UpdateDepartmentBody, listResponse: ListDepartmentsResponse,
    search: ["code", "name", "nameAr"] },
  { path: "sections", table: sectionsTable, module: "sections", entity: "section",
    createBody: CreateSectionBody, updateBody: UpdateSectionBody, listResponse: ListSectionsResponse,
    search: ["code", "name", "nameAr"] },
  { path: "job-titles", table: jobTitlesTable, module: "jobTitles", entity: "jobTitle",
    // Issued by the central sequence engine; the client cannot choose it.
    generatedCode: { documentType: "jobTitle" },
    createBody: CreateJobTitleBody, updateBody: UpdateJobTitleBody, listResponse: ListJobTitlesResponse,
    search: ["code", "name", "nameAr"] },
  { path: "employees", table: employeesTable, module: "employees", entity: "employee",
    generatedCode: { documentType: "employee" },
    createBody: CreateEmployeeBody, updateBody: UpdateEmployeeBody, listResponse: ListEmployeesResponse,
    search: ["code", "firstName", "lastName", "email", "phone", "nationalId"] },
  { path: "employee-documents", table: employeeDocumentsTable, module: "employeeDocuments", entity: "employeeDocument",
    generatedCode: { documentType: "employeeDocument" },
    createBody: CreateEmployeeDocumentBody, updateBody: UpdateEmployeeDocumentBody, listResponse: ListEmployeeDocumentsResponse,
    search: ["code", "title", "documentNumber"] },
  { path: "employee-emergency-contacts", table: employeeEmergencyContactsTable, module: "employeeEmergencyContacts", entity: "employeeEmergencyContact",
    createBody: CreateEmployeeEmergencyContactBody, updateBody: UpdateEmployeeEmergencyContactBody, listResponse: ListEmployeeEmergencyContactsResponse,
    search: ["name", "phone"] },
  { path: "shifts", table: shiftsTable, module: "shifts", entity: "shift",
    // Issued by the central sequence engine; the client cannot choose it.
    generatedCode: { documentType: "shift" },
    createBody: CreateShiftBody, updateBody: UpdateShiftBody, listResponse: ListShiftsResponse,
    search: ["code", "name", "nameAr"] },
  { path: "attendance-records", table: attendanceRecordsTable, module: "attendanceRecords", entity: "attendanceRecord",
    createBody: CreateAttendanceRecordBody, updateBody: UpdateAttendanceRecordBody, listResponse: ListAttendanceRecordsResponse,
    search: ["status", "notes"] },
  { path: "leave-types", table: leaveTypesTable, module: "leaveTypes", entity: "leaveType",
    // Issued by the central sequence engine; the client cannot choose it.
    generatedCode: { documentType: "leaveType" },
    createBody: CreateLeaveTypeBody, updateBody: UpdateLeaveTypeBody, listResponse: ListLeaveTypesResponse,
    search: ["code", "name", "nameAr"] },
  { path: "leave-balances", table: leaveBalancesTable, module: "leaveBalances", entity: "leaveBalance",
    createBody: CreateLeaveBalanceBody, updateBody: UpdateLeaveBalanceBody, listResponse: ListLeaveBalancesResponse,
    search: [] },
  { path: "leave-requests", table: leaveRequestsTable, module: "leaveRequests", entity: "leaveRequest",
    generatedCode: { documentType: "leaveRequest" },
    createBody: CreateLeaveRequestBody, updateBody: UpdateLeaveRequestBody, listResponse: ListLeaveRequestsResponse,
    search: ["code", "reason"] },
  { path: "salary-components", table: salaryComponentsTable, module: "salaryComponents", entity: "salaryComponent",
    // Issued by the central sequence engine; the client cannot choose it.
    generatedCode: { documentType: "salaryComponent" },
    createBody: CreateSalaryComponentBody, updateBody: UpdateSalaryComponentBody, listResponse: ListSalaryComponentsResponse,
    search: ["code", "name", "nameAr"] },
  { path: "payroll-periods", table: payrollPeriodsTable, module: "payrollPeriods", entity: "payrollPeriod",
    generatedCode: { documentType: "payrollPeriod" },
    createBody: CreatePayrollPeriodBody, updateBody: UpdatePayrollPeriodBody, listResponse: ListPayrollPeriodsResponse,
    search: ["code", "name"] },
  { path: "payroll-runs", table: payrollRunsTable, module: "payrollRuns", entity: "payrollRun",
    generatedCode: { documentType: "payrollRun" },
    createBody: CreatePayrollRunBody, updateBody: UpdatePayrollRunBody, listResponse: ListPayrollRunsResponse,
    search: ["code", "description"] },
  { path: "payslips", table: payslipsTable, module: "payslips", entity: "payslip",
    generatedCode: { documentType: "payslip" },
    createBody: CreatePayslipBody, updateBody: UpdatePayslipBody, listResponse: ListPayslipsResponse,
    search: ["code"] },
  { path: "payslip-lines", table: payslipLinesTable, module: "payslipLines", entity: "payslipLine",
    createBody: CreatePayslipLineBody, updateBody: UpdatePayslipLineBody, listResponse: ListPayslipLinesResponse,
    search: ["description"] },
  { path: "employee-loans", table: employeeLoansTable, module: "employeeLoans", entity: "employeeLoan",
    generatedCode: { documentType: "employeeLoan" },
    createBody: CreateEmployeeLoanBody, updateBody: UpdateEmployeeLoanBody, listResponse: ListEmployeeLoansResponse,
    search: ["code", "reason"] },
  { path: "loan-installments", table: loanInstallmentsTable, module: "loanInstallments", entity: "loanInstallment",
    createBody: CreateLoanInstallmentBody, updateBody: UpdateLoanInstallmentBody, listResponse: ListLoanInstallmentsResponse,
    search: ["status"] },
  { path: "employee-advances", table: employeeAdvancesTable, module: "employeeAdvances", entity: "employeeAdvance",
    generatedCode: { documentType: "employeeAdvance" },
    createBody: CreateEmployeeAdvanceBody, updateBody: UpdateEmployeeAdvanceBody, listResponse: ListEmployeeAdvancesResponse,
    search: ["code", "reason"] },
  { path: "kpi-templates", table: kpiTemplatesTable, module: "kpiTemplates", entity: "kpiTemplate",
    createBody: CreateKpiTemplateBody, updateBody: UpdateKpiTemplateBody, listResponse: ListKpiTemplatesResponse,
    search: ["code", "name", "nameAr"] },
  { path: "employee-evaluations", table: employeeEvaluationsTable, module: "employeeEvaluations", entity: "employeeEvaluation",
    generatedCode: { documentType: "employeeEvaluation" },
    createBody: CreateEmployeeEvaluationBody, updateBody: UpdateEmployeeEvaluationBody, listResponse: ListEmployeeEvaluationsResponse,
    search: ["code", "evaluationPeriod"] },
  { path: "employee-evaluation-lines", table: employeeEvaluationLinesTable, module: "employeeEvaluationLines", entity: "employeeEvaluationLine",
    createBody: CreateEmployeeEvaluationLineBody, updateBody: UpdateEmployeeEvaluationLineBody, listResponse: ListEmployeeEvaluationLinesResponse,
    search: ["description"] },
];

for (const cfg of resources) registerCrud(router, cfg);

/* ------------------------------------------------------------------ */
/* Lifecycle action helpers                                            */
/* ------------------------------------------------------------------ */

function mapPostingError(res: import("express").Response, err: unknown): boolean {
  if (err instanceof PostingError) {
    res.status(err.status).json({ error: err.message });
    return true;
  }
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadForUpdate(tx: Tx, table: any, id: string): Promise<Record<string, unknown> | null> {
  const rows = (await tx
    .select()
    .from(table)
    .where(and(eq(table.id, id), eq(table.isDeleted, false)))
    .for("update")) as Record<string, unknown>[];
  return rows[0] ?? null;
}

/* ----------------------------- Leave requests -------------------------- */

router.post("/leave-requests/:id/submit", requirePermission("leaveRequests.submit"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  try {
    const row = await db.transaction(async (tx) => {
      const lr = await loadForUpdate(tx, leaveRequestsTable, id);
      if (!lr) return null;
      if (lr.status !== "draft") throw new PostingError(409, "Only a draft leave request can be submitted");
      const [updated] = await tx.update(leaveRequestsTable).set({ status: "submitted" }).where(eq(leaveRequestsTable.id, id)).returning();
      return updated;
    });
    if (!row) { res.status(404).json({ error: "leaveRequest not found" }); return; }
    await recordAudit(req, { action: "submit", entity: "leaveRequest", entityId: id, newValue: row });
    res.json(serializeRow(row as Record<string, unknown>));
  } catch (err) {
    if (mapPostingError(res, err)) return;
    throw err;
  }
});

router.post("/leave-requests/:id/approve", requirePermission("leaveRequests.approve"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const userId = req.authUser?.id ?? null;
  try {
    const row = await db.transaction(async (tx) => {
      const lr = await loadForUpdate(tx, leaveRequestsTable, id);
      if (!lr) return null;
      if (lr.status === "approved") throw new PostingError(409, "Leave request is already approved");
      if (lr.status === "rejected") throw new PostingError(409, "Leave request was rejected");
      const [updated] = await tx
        .update(leaveRequestsTable)
        .set({ status: "approved", approvedBy: userId, approvedAt: new Date() })
        .where(eq(leaveRequestsTable.id, id))
        .returning();
      // Best-effort balance update for the employee/leaveType in the request year.
      if (lr.employeeId && lr.leaveTypeId) {
        const year = new Date(String(lr.startDate)).getUTCFullYear();
        const [bal] = await tx
          .select()
          .from(leaveBalancesTable)
          .where(
            and(
              eq(leaveBalancesTable.employeeId, lr.employeeId as string),
              eq(leaveBalancesTable.leaveTypeId, lr.leaveTypeId as string),
              eq(leaveBalancesTable.year, year),
              eq(leaveBalancesTable.isDeleted, false),
            ),
          )
          .for("update");
        if (bal) {
          const used = Number(bal.used ?? 0) + Number(lr.days ?? 0);
          const remaining = Number(bal.entitled ?? 0) - used;
          await tx
            .update(leaveBalancesTable)
            .set({ used: used.toFixed(2), remaining: remaining.toFixed(2) })
            .where(eq(leaveBalancesTable.id, bal.id));
        }
      }
      return updated;
    });
    if (!row) { res.status(404).json({ error: "leaveRequest not found" }); return; }
    await recordAudit(req, { action: "approve", entity: "leaveRequest", entityId: id, newValue: row });
    res.json(serializeRow(row as Record<string, unknown>));
  } catch (err) {
    if (mapPostingError(res, err)) return;
    throw err;
  }
});

router.post("/leave-requests/:id/reject", requirePermission("leaveRequests.reject"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const reason = typeof (req.body as Record<string, unknown>)?.rejectedReason === "string"
    ? ((req.body as Record<string, unknown>).rejectedReason as string)
    : null;
  try {
    const row = await db.transaction(async (tx) => {
      const lr = await loadForUpdate(tx, leaveRequestsTable, id);
      if (!lr) return null;
      if (lr.status === "approved") throw new PostingError(409, "Cannot reject an approved leave request");
      const [updated] = await tx
        .update(leaveRequestsTable)
        .set({ status: "rejected", rejectedReason: reason })
        .where(eq(leaveRequestsTable.id, id))
        .returning();
      return updated;
    });
    if (!row) { res.status(404).json({ error: "leaveRequest not found" }); return; }
    await recordAudit(req, { action: "reject", entity: "leaveRequest", entityId: id, newValue: row });
    res.json(serializeRow(row as Record<string, unknown>));
  } catch (err) {
    if (mapPostingError(res, err)) return;
    throw err;
  }
});

/* ----------------------------- Payroll runs ---------------------------- */

router.post("/payroll-runs/:id/approve", requirePermission("payrollRuns.approve"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const userId = req.authUser?.id ?? null;
  try {
    const row = await db.transaction(async (tx) => {
      const run = await loadForUpdate(tx, payrollRunsTable, id);
      if (!run) return null;
      if (run.status !== "draft") throw new PostingError(409, "Only a draft payroll run can be approved");
      const [updated] = await tx
        .update(payrollRunsTable)
        .set({ status: "approved", approvedBy: userId, approvedAt: new Date() })
        .where(eq(payrollRunsTable.id, id))
        .returning();
      return updated;
    });
    if (!row) { res.status(404).json({ error: "payrollRun not found" }); return; }
    await recordAudit(req, { action: "approve", entity: "payrollRun", entityId: id, newValue: row });
    res.json(serializeRow(row as Record<string, unknown>));
  } catch (err) {
    if (mapPostingError(res, err)) return;
    throw err;
  }
});

router.post("/payroll-runs/:id/post", requirePermission("payrollRuns.post"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const userId = req.authUser?.id ?? null;
  try {
    const row = await db.transaction(async (tx) => {
      const run = await loadForUpdate(tx, payrollRunsTable, id);
      if (!run) return null;
      if (run.status === "posted") throw new PostingError(409, "Payroll run is already posted");
      if (run.status !== "approved") throw new PostingError(409, "Only an approved payroll run can be posted");
      const companyId = run.companyId as string;
      const earnings = String(run.totalEarnings ?? "0");
      const deductions = String(run.totalDeductions ?? "0");
      const net = String(run.totalNet ?? "0");
      if (Number(earnings) <= 0) {
        throw new PostingError(409, "Payroll run has no amounts to post (add payslips first)");
      }
      const salaries = await getCompanyMapping(tx, companyId, "payroll.salaries");
      if (!salaries || !salaries.debitAccountId || !salaries.creditAccountId) {
        throw new PostingError(409, "Payroll accounting is not configured (payroll.salaries mapping missing)");
      }
      const lines: EntryLineInput[] = [
        { accountId: salaries.debitAccountId, debit: earnings, credit: "0" },
      ];
      if (Number(deductions) > 0) {
        const deductionsMapping = await getCompanyMapping(tx, companyId, "payroll.deductions");
        if (!deductionsMapping?.creditAccountId) {
          throw new PostingError(409, "Payroll deductions accounting is not configured (payroll.deductions mapping missing)");
        }
        lines.push({ accountId: salaries.creditAccountId, debit: "0", credit: net });
        lines.push({ accountId: deductionsMapping.creditAccountId, debit: "0", credit: deductions });
      } else {
        lines.push({ accountId: salaries.creditAccountId, debit: "0", credit: earnings });
      }
      const entry = await postAutomaticLines(tx, {
        companyId,
        branchId: (run.branchId as string | null) ?? null,
        entryDate: (run.runDate as string | null) ?? today(),
        description: `Payroll ${run.code ?? id}`,
        reference: (run.code as string | null) ?? null,
        sourceType: "payrollRun",
        sourceId: id,
        userId,
        lines,
      });
      const [updated] = await tx
        .update(payrollRunsTable)
        .set({ status: "posted", postedBy: userId, postedAt: new Date(), journalEntryId: entry.id })
        .where(eq(payrollRunsTable.id, id))
        .returning();
      return updated;
    });
    if (!row) { res.status(404).json({ error: "payrollRun not found" }); return; }
    await recordAudit(req, { action: "post", entity: "payrollRun", entityId: id, newValue: row });
    res.json(serializeRow(row as Record<string, unknown>));
  } catch (err) {
    if (mapPostingError(res, err)) return;
    throw err;
  }
});

router.post("/payroll-runs/:id/reverse", requirePermission("payrollRuns.reverse"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const userId = req.authUser?.id ?? null;
  try {
    const row = await db.transaction(async (tx) => {
      const run = await loadForUpdate(tx, payrollRunsTable, id);
      if (!run) return null;
      if (run.status !== "posted") throw new PostingError(409, "Only a posted payroll run can be reversed");
      await reverseAutomaticEntriesForSource(tx, "payrollRun", id, userId);
      const [updated] = await tx
        .update(payrollRunsTable)
        .set({ status: "reversed", reversedAt: new Date() })
        .where(eq(payrollRunsTable.id, id))
        .returning();
      return updated;
    });
    if (!row) { res.status(404).json({ error: "payrollRun not found" }); return; }
    await recordAudit(req, { action: "reverse", entity: "payrollRun", entityId: id, newValue: row });
    res.json(serializeRow(row as Record<string, unknown>));
  } catch (err) {
    if (mapPostingError(res, err)) return;
    throw err;
  }
});

/* ----------------------------- Employee loans -------------------------- */

router.post("/employee-loans/:id/approve", requirePermission("employeeLoans.approve"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const userId = req.authUser?.id ?? null;
  try {
    const row = await db.transaction(async (tx) => {
      const loan = await loadForUpdate(tx, employeeLoansTable, id);
      if (!loan) return null;
      if (loan.status !== "draft") throw new PostingError(409, "Only a draft loan can be approved");
      const [updated] = await tx
        .update(employeeLoansTable)
        .set({ status: "approved", approvedBy: userId, approvedAt: new Date(), outstandingAmount: String(loan.amount ?? "0") })
        .where(eq(employeeLoansTable.id, id))
        .returning();
      return updated;
    });
    if (!row) { res.status(404).json({ error: "employeeLoan not found" }); return; }
    await recordAudit(req, { action: "approve", entity: "employeeLoan", entityId: id, newValue: row });
    res.json(serializeRow(row as Record<string, unknown>));
  } catch (err) {
    if (mapPostingError(res, err)) return;
    throw err;
  }
});

router.post("/employee-loans/:id/disburse", requirePermission("employeeLoans.disburse"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const userId = req.authUser?.id ?? null;
  try {
    const row = await db.transaction(async (tx) => {
      const loan = await loadForUpdate(tx, employeeLoansTable, id);
      if (!loan) return null;
      if (loan.status === "disbursed") throw new PostingError(409, "Loan is already disbursed");
      if (loan.status !== "approved") throw new PostingError(409, "Only an approved loan can be disbursed");
      const entry = await postAutomaticEntry(tx, {
        companyId: loan.companyId as string,
        eventKey: "loan.disbursement",
        amount: String(loan.amount ?? "0"),
        entryDate: (loan.startDate as string | null) ?? today(),
        description: `Employee loan ${loan.code ?? id}`,
        reference: (loan.code as string | null) ?? null,
        sourceType: "employeeLoan",
        sourceId: id,
        userId,
      });
      const [updated] = await tx
        .update(employeeLoansTable)
        .set({
          status: "disbursed",
          disbursedAt: new Date(),
          outstandingAmount: String(loan.amount ?? "0"),
          journalEntryId: entry?.id ?? null,
        })
        .where(eq(employeeLoansTable.id, id))
        .returning();
      return updated;
    });
    if (!row) { res.status(404).json({ error: "employeeLoan not found" }); return; }
    await recordAudit(req, { action: "disburse", entity: "employeeLoan", entityId: id, newValue: row });
    res.json(serializeRow(row as Record<string, unknown>));
  } catch (err) {
    if (mapPostingError(res, err)) return;
    throw err;
  }
});

/* ----------------------------- Employee advances ----------------------- */

router.post("/employee-advances/:id/approve", requirePermission("employeeAdvances.approve"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const userId = req.authUser?.id ?? null;
  try {
    const row = await db.transaction(async (tx) => {
      const adv = await loadForUpdate(tx, employeeAdvancesTable, id);
      if (!adv) return null;
      if (adv.status !== "draft") throw new PostingError(409, "Only a draft advance can be approved");
      const [updated] = await tx
        .update(employeeAdvancesTable)
        .set({ status: "approved", approvedBy: userId, approvedAt: new Date() })
        .where(eq(employeeAdvancesTable.id, id))
        .returning();
      return updated;
    });
    if (!row) { res.status(404).json({ error: "employeeAdvance not found" }); return; }
    await recordAudit(req, { action: "approve", entity: "employeeAdvance", entityId: id, newValue: row });
    res.json(serializeRow(row as Record<string, unknown>));
  } catch (err) {
    if (mapPostingError(res, err)) return;
    throw err;
  }
});

router.post("/employee-advances/:id/pay", requirePermission("employeeAdvances.pay"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const userId = req.authUser?.id ?? null;
  try {
    const row = await db.transaction(async (tx) => {
      const adv = await loadForUpdate(tx, employeeAdvancesTable, id);
      if (!adv) return null;
      if (adv.status === "paid") throw new PostingError(409, "Advance is already paid");
      if (adv.status !== "approved") throw new PostingError(409, "Only an approved advance can be paid");
      const entry = await postAutomaticEntry(tx, {
        companyId: adv.companyId as string,
        eventKey: "advance.payment",
        amount: String(adv.amount ?? "0"),
        entryDate: (adv.requestDate as string | null) ?? today(),
        description: `Employee advance ${adv.code ?? id}`,
        reference: (adv.code as string | null) ?? null,
        sourceType: "employeeAdvance",
        sourceId: id,
        userId,
      });
      const [updated] = await tx
        .update(employeeAdvancesTable)
        .set({ status: "paid", paidAt: new Date(), journalEntryId: entry?.id ?? null })
        .where(eq(employeeAdvancesTable.id, id))
        .returning();
      return updated;
    });
    if (!row) { res.status(404).json({ error: "employeeAdvance not found" }); return; }
    await recordAudit(req, { action: "pay", entity: "employeeAdvance", entityId: id, newValue: row });
    res.json(serializeRow(row as Record<string, unknown>));
  } catch (err) {
    if (mapPostingError(res, err)) return;
    throw err;
  }
});

/* ------------------------------------------------------------------ */
/* HR dashboard + reports                                              */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function companyCond(t: any, companyId: string | undefined): SQL | undefined {
  return companyId ? eq(t.companyId, companyId) : undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function countWhere(t: any, companyId: string | undefined, extra?: SQL): Promise<number> {
  const conds: SQL[] = [eq(t.isDeleted, false)];
  const c = companyCond(t, companyId);
  if (c) conds.push(c);
  if (extra) conds.push(extra);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(t).where(and(...conds));
  return count;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sumWhere(t: any, col: any, companyId: string | undefined, extra?: SQL): Promise<string> {
  const conds: SQL[] = [eq(t.isDeleted, false)];
  const c = companyCond(t, companyId);
  if (c) conds.push(c);
  if (extra) conds.push(extra);
  const [{ total }] = await db.select({ total: sql<string>`coalesce(sum(${col}), 0)::text` }).from(t).where(and(...conds));
  return total;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function groupCount(t: any, col: any, companyId: string | undefined): Promise<{ key: string; count: number }[]> {
  const conds: SQL[] = [eq(t.isDeleted, false)];
  const c = companyCond(t, companyId);
  if (c) conds.push(c);
  const rows = await db
    .select({ key: col, count: sql<number>`count(*)::int` })
    .from(t)
    .where(and(...conds))
    .groupBy(col);
  return rows as { key: string; count: number }[];
}

router.get("/hr/dashboard", async (req, res): Promise<void> => {
  const companyId = qStr(req.query as Record<string, unknown>, "companyId");
  const [
    employeesCount,
    activeEmployees,
    departmentsCount,
    pendingLeaveRequests,
    openLoans,
    pendingPayrollRuns,
  ] = await Promise.all([
    countWhere(employeesTable, companyId),
    countWhere(employeesTable, companyId, eq(employeesTable.status, "active")),
    countWhere(departmentsTable, companyId),
    countWhere(leaveRequestsTable, companyId, eq(leaveRequestsTable.status, "submitted")),
    countWhere(employeeLoansTable, companyId, eq(employeeLoansTable.status, "disbursed")),
    countWhere(payrollRunsTable, companyId, ne(payrollRunsTable.status, "posted")),
  ]);
  const [payrollPosted, loanOutstanding] = await Promise.all([
    sumWhere(payrollRunsTable, payrollRunsTable.totalNet, companyId, eq(payrollRunsTable.status, "posted")),
    sumWhere(employeeLoansTable, employeeLoansTable.outstandingAmount, companyId, eq(employeeLoansTable.status, "disbursed")),
  ]);
  const [employeesByStatus, employeesByDepartment, employeesByType] = await Promise.all([
    groupCount(employeesTable, employeesTable.status, companyId),
    groupCount(employeesTable, employeesTable.departmentId, companyId),
    groupCount(employeesTable, employeesTable.employmentType, companyId),
  ]);
  res.json({
    employeesCount,
    activeEmployees,
    departmentsCount,
    pendingLeaveRequests,
    openLoans,
    pendingPayrollRuns,
    payrollPosted,
    loanOutstanding,
    employeesByStatus,
    employeesByDepartment,
    employeesByType,
  });
});

function dateRange(query: Record<string, unknown>): { from?: string; to?: string } {
  return { from: qStr(query, "from"), to: qStr(query, "to") };
}

router.get("/hr/reports/attendance", async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const companyId = qStr(q, "companyId");
  const { from, to } = dateRange(q);
  const conds: SQL[] = [eq(attendanceRecordsTable.isDeleted, false)];
  const c = companyCond(attendanceRecordsTable, companyId);
  if (c) conds.push(c);
  if (from) conds.push(gte(attendanceRecordsTable.attendanceDate, from));
  if (to) conds.push(lte(attendanceRecordsTable.attendanceDate, to));
  const byStatus = await db
    .select({ key: attendanceRecordsTable.status, count: sql<number>`count(*)::int` })
    .from(attendanceRecordsTable)
    .where(and(...conds))
    .groupBy(attendanceRecordsTable.status);
  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      lateMinutes: sql<string>`coalesce(sum(${attendanceRecordsTable.lateMinutes}), 0)::text`,
      overtimeHours: sql<string>`coalesce(sum(${attendanceRecordsTable.overtimeHours}), 0)::text`,
      workedHours: sql<string>`coalesce(sum(${attendanceRecordsTable.workedHours}), 0)::text`,
    })
    .from(attendanceRecordsTable)
    .where(and(...conds));
  res.json({ byStatus, ...totals });
});

router.get("/hr/reports/leave", async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const companyId = qStr(q, "companyId");
  const byStatus = await groupCount(leaveRequestsTable, leaveRequestsTable.status, companyId);
  const byType = await groupCount(leaveRequestsTable, leaveRequestsTable.leaveTypeId, companyId);
  const approvedDays = await sumWhere(leaveRequestsTable, leaveRequestsTable.days, companyId, eq(leaveRequestsTable.status, "approved"));
  res.json({ byStatus, byType, approvedDays });
});

router.get("/hr/reports/payroll", async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const companyId = qStr(q, "companyId");
  const byStatus = await groupCount(payrollRunsTable, payrollRunsTable.status, companyId);
  const [totals] = await db
    .select({
      totalEarnings: sql<string>`coalesce(sum(${payrollRunsTable.totalEarnings}), 0)::text`,
      totalDeductions: sql<string>`coalesce(sum(${payrollRunsTable.totalDeductions}), 0)::text`,
      totalNet: sql<string>`coalesce(sum(${payrollRunsTable.totalNet}), 0)::text`,
    })
    .from(payrollRunsTable)
    .where(and(
      eq(payrollRunsTable.isDeleted, false),
      eq(payrollRunsTable.status, "posted"),
      ...(companyId ? [eq(payrollRunsTable.companyId, companyId)] : []),
    ));
  res.json({ byStatus, ...totals });
});

router.get("/hr/reports/employees", async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const companyId = qStr(q, "companyId");
  const [byStatus, byDepartment, byType] = await Promise.all([
    groupCount(employeesTable, employeesTable.status, companyId),
    groupCount(employeesTable, employeesTable.departmentId, companyId),
    groupCount(employeesTable, employeesTable.employmentType, companyId),
  ]);
  const headcount = await countWhere(employeesTable, companyId);
  res.json({ headcount, byStatus, byDepartment, byType });
});

router.get("/hr/reports/turnover", async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const companyId = qStr(q, "companyId");
  const { from, to } = dateRange(q);
  const hireConds: SQL[] = [eq(employeesTable.isDeleted, false)];
  const tConds: SQL[] = [eq(employeesTable.isDeleted, false), eq(employeesTable.status, "terminated")];
  const c = companyCond(employeesTable, companyId);
  if (c) { hireConds.push(c); tConds.push(c); }
  if (from) { hireConds.push(gte(employeesTable.hireDate, from)); tConds.push(gte(employeesTable.terminationDate, from)); }
  if (to) { hireConds.push(lte(employeesTable.hireDate, to)); tConds.push(lte(employeesTable.terminationDate, to)); }
  const [{ hires }] = await db.select({ hires: sql<number>`count(*)::int` }).from(employeesTable).where(and(...hireConds));
  const [{ terminations }] = await db.select({ terminations: sql<number>`count(*)::int` }).from(employeesTable).where(and(...tConds));
  const active = await countWhere(employeesTable, companyId, eq(employeesTable.status, "active"));
  res.json({ hires, terminations, active });
});

export default router;
