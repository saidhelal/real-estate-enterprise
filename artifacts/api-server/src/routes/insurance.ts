import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import {
  db,
  employeeInsurancesTable,
  insuranceFormsTable,
  insuranceAdditionsTable,
  insuranceExclusionsTable,
  insuranceDataAmendmentsTable,
  insuranceSubscriptionsTable,
  insurancePaymentNoticesTable,
  insuranceReconciliationsTable,
  insuranceArrearsTable,
  insurancePenaltiesTable,
  serviceTerminationsTable,
  insuranceSettlementsTable,
  insuranceClearancesTable,
  subcontractorInsurancesTable,
  projectLaborInsurancesTable,
} from "@workspace/db";
import {
  ListEmployeeInsurancesResponse,
  CreateEmployeeInsuranceBody,
  GetEmployeeInsuranceResponse,
  UpdateEmployeeInsuranceBody,
  ListInsuranceFormsResponse,
  CreateInsuranceFormBody,
  GetInsuranceFormResponse,
  UpdateInsuranceFormBody,
  ListInsuranceAdditionsResponse,
  CreateInsuranceAdditionBody,
  GetInsuranceAdditionResponse,
  UpdateInsuranceAdditionBody,
  ListInsuranceExclusionsResponse,
  CreateInsuranceExclusionBody,
  GetInsuranceExclusionResponse,
  UpdateInsuranceExclusionBody,
  ListInsuranceDataAmendmentsResponse,
  CreateInsuranceDataAmendmentBody,
  GetInsuranceDataAmendmentResponse,
  UpdateInsuranceDataAmendmentBody,
  ListInsuranceSubscriptionsResponse,
  CreateInsuranceSubscriptionBody,
  GetInsuranceSubscriptionResponse,
  UpdateInsuranceSubscriptionBody,
  ListInsurancePaymentNoticesResponse,
  CreateInsurancePaymentNoticeBody,
  GetInsurancePaymentNoticeResponse,
  UpdateInsurancePaymentNoticeBody,
  ListInsuranceReconciliationsResponse,
  CreateInsuranceReconciliationBody,
  GetInsuranceReconciliationResponse,
  UpdateInsuranceReconciliationBody,
  ListInsuranceArrearsResponse,
  CreateInsuranceArrearBody,
  GetInsuranceArrearResponse,
  UpdateInsuranceArrearBody,
  ListInsurancePenaltiesResponse,
  CreateInsurancePenaltyBody,
  GetInsurancePenaltyResponse,
  UpdateInsurancePenaltyBody,
  ListServiceTerminationsResponse,
  CreateServiceTerminationBody,
  GetServiceTerminationResponse,
  UpdateServiceTerminationBody,
  ListInsuranceSettlementsResponse,
  CreateInsuranceSettlementBody,
  GetInsuranceSettlementResponse,
  UpdateInsuranceSettlementBody,
  ListInsuranceClearancesResponse,
  CreateInsuranceClearanceBody,
  GetInsuranceClearanceResponse,
  UpdateInsuranceClearanceBody,
  ListSubcontractorInsurancesResponse,
  CreateSubcontractorInsuranceBody,
  GetSubcontractorInsuranceResponse,
  UpdateSubcontractorInsuranceBody,
  ListProjectLaborInsurancesResponse,
  CreateProjectLaborInsuranceBody,
  GetProjectLaborInsuranceResponse,
  UpdateProjectLaborInsuranceBody,
  GetInsuranceDashboardResponse,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";
import { postAutomaticEntry, reverseAutomaticEntriesForSource } from "../lib/posting";

const router: IRouter = Router();
router.use(requireAuth);

// Insurance Management (إدارة التأمينات): standalone module (independent of HR
// and General Administration). Employees are referenced by plain employeeId uuid
// (no FK), mirroring the GA convention. Subscriptions and penalties auto-post to
// Accounting via postAutomaticEntry on create / reverseAutomaticEntriesForSource
// on delete (best-effort, idempotent per (sourceType, sourceId); skips cleanly
// when accounting is not configured). serializeRow converts Date->ISO; numeric
// stays string.

interface CrudSchema {
  parse: (v: unknown) => unknown;
  safeParse: (
    v: unknown,
  ) =>
    | { success: true; data: Record<string, unknown> }
    | { success: false; error: { message: string } };
}

interface PostConfig {
  eventKey: string;
  sourceType: string;
  amountField: string;
  dateField: string;
  label: string;
}

import { registerCrud, type Tx } from "../lib/register-crud";

/**
 * Insurance keeps ownership of its GL posting. The shared factory supplies the
 * transaction only; the event key, amount source and reversal target are
 * decided here, exactly as before.
 */
function postingHooks(post: PostConfig | undefined) {
  if (!post) return {};
  return {
    inCreateTx: async (tx: Tx, created: Record<string, unknown>, req: import("express").Request) => {
      const entryDate =
        (created[post.dateField] as string | null) || new Date().toISOString().slice(0, 10);
      await postAutomaticEntry(tx, {
        companyId: String(created.companyId),
        eventKey: post.eventKey,
        amount: (created[post.amountField] as string | null) ?? "0",
        entryDate,
        description: created.code ? `${post.label} ${String(created.code)}` : post.label,
        reference: (created.code as string | null) ?? null,
        sourceType: post.sourceType,
        sourceId: String(created.id),
        userId: req.authUser?.id ?? null,
      });
    },
    inDeleteTx: async (tx: Tx, row: Record<string, unknown>, req: import("express").Request) => {
      // Reversal targets post.sourceType, not the entity name — preserved verbatim.
      await reverseAutomaticEntriesForSource(tx, post.sourceType, String(row.id), req.authUser?.id ?? null);
    },
  };
}


registerCrud(router, {
  base: "/employee-insurances",
  // Issued by the central sequence engine; the client cannot choose it.
  generatedCode: { documentType: "employeeInsurance" },
  module: "employeeInsurances",
  entity: "employeeInsurance",
  table: employeeInsurancesTable,
  searchCols: ["code","insuranceNumber"],
  filterCols: ["companyId","employeeId","insuranceType","insuranceStatus"],
  listResp: ListEmployeeInsurancesResponse,
  createBody: CreateEmployeeInsuranceBody,
  getResp: GetEmployeeInsuranceResponse,
  updateBody: UpdateEmployeeInsuranceBody,
  notFoundMessage: "Not found",
});

registerCrud(router, {
  base: "/insurance-forms",
  // Issued by the central sequence engine; the client cannot choose it.
  generatedCode: { documentType: "insuranceForm" },
  module: "insuranceForms",
  entity: "insuranceForm",
  table: insuranceFormsTable,
  searchCols: ["code","formNumber"],
  filterCols: ["companyId","formType","status","employeeId"],
  listResp: ListInsuranceFormsResponse,
  createBody: CreateInsuranceFormBody,
  getResp: GetInsuranceFormResponse,
  updateBody: UpdateInsuranceFormBody,
  notFoundMessage: "Not found",
});

registerCrud(router, {
  base: "/insurance-additions",
  // Issued by the central sequence engine; the client cannot choose it.
  generatedCode: { documentType: "insuranceAddition" },
  module: "insuranceAdditions",
  entity: "insuranceAddition",
  table: insuranceAdditionsTable,
  searchCols: ["code","formNumber"],
  filterCols: ["companyId","status","employeeId"],
  listResp: ListInsuranceAdditionsResponse,
  createBody: CreateInsuranceAdditionBody,
  getResp: GetInsuranceAdditionResponse,
  updateBody: UpdateInsuranceAdditionBody,
  notFoundMessage: "Not found",
});

registerCrud(router, {
  base: "/insurance-exclusions",
  // Issued by the central sequence engine; the client cannot choose it.
  generatedCode: { documentType: "insuranceExclusion" },
  module: "insuranceExclusions",
  entity: "insuranceExclusion",
  table: insuranceExclusionsTable,
  searchCols: ["code","formNumber"],
  filterCols: ["companyId","reason","status","employeeId"],
  listResp: ListInsuranceExclusionsResponse,
  createBody: CreateInsuranceExclusionBody,
  getResp: GetInsuranceExclusionResponse,
  updateBody: UpdateInsuranceExclusionBody,
  notFoundMessage: "Not found",
});

registerCrud(router, {
  base: "/insurance-data-amendments",
  // Issued by the central sequence engine; the client cannot choose it.
  generatedCode: { documentType: "insuranceDataAmendment" },
  module: "insuranceDataAmendments",
  entity: "insuranceDataAmendment",
  table: insuranceDataAmendmentsTable,
  searchCols: ["code","fieldName"],
  filterCols: ["companyId","amendmentType","status","employeeId"],
  listResp: ListInsuranceDataAmendmentsResponse,
  createBody: CreateInsuranceDataAmendmentBody,
  getResp: GetInsuranceDataAmendmentResponse,
  updateBody: UpdateInsuranceDataAmendmentBody,
  notFoundMessage: "Not found",
});

registerCrud(router, {
  base: "/insurance-subscriptions",
  // Issued by the central sequence engine; the client cannot choose it.
  generatedCode: { documentType: "insuranceSubscription" },
  module: "insuranceSubscriptions",
  entity: "insuranceSubscription",
  table: insuranceSubscriptionsTable,
  searchCols: ["code","period"],
  filterCols: ["companyId","branchId","period","status"],
  listResp: ListInsuranceSubscriptionsResponse,
  createBody: CreateInsuranceSubscriptionBody,
  getResp: GetInsuranceSubscriptionResponse,
  updateBody: UpdateInsuranceSubscriptionBody,
  notFoundMessage: "Not found",
  hooks: postingHooks({ eventKey: "insurance.subscription", sourceType: "insuranceSubscription", amountField: "totalAmount", dateField: "dueDate", label: "Insurance subscription" }),
});

registerCrud(router, {
  base: "/insurance-payment-notices",
  // Issued by the central sequence engine; the client cannot choose it.
  generatedCode: { documentType: "insurancePaymentNotice" },
  module: "insurancePaymentNotices",
  entity: "insurancePaymentNotice",
  table: insurancePaymentNoticesTable,
  searchCols: ["code","noticeNumber"],
  filterCols: ["companyId","status","subscriptionId"],
  listResp: ListInsurancePaymentNoticesResponse,
  createBody: CreateInsurancePaymentNoticeBody,
  getResp: GetInsurancePaymentNoticeResponse,
  updateBody: UpdateInsurancePaymentNoticeBody,
  notFoundMessage: "Not found",
});

registerCrud(router, {
  base: "/insurance-reconciliations",
  // Issued by the central sequence engine; the client cannot choose it.
  generatedCode: { documentType: "insuranceReconciliation" },
  module: "insuranceReconciliations",
  entity: "insuranceReconciliation",
  table: insuranceReconciliationsTable,
  searchCols: ["code","period"],
  filterCols: ["companyId","period","status"],
  listResp: ListInsuranceReconciliationsResponse,
  createBody: CreateInsuranceReconciliationBody,
  getResp: GetInsuranceReconciliationResponse,
  updateBody: UpdateInsuranceReconciliationBody,
  notFoundMessage: "Not found",
});

registerCrud(router, {
  base: "/insurance-arrears",
  // Issued by the central sequence engine; the client cannot choose it.
  generatedCode: { documentType: "insuranceArrear" },
  module: "insuranceArrears",
  entity: "insuranceArrear",
  table: insuranceArrearsTable,
  searchCols: ["code","period"],
  filterCols: ["companyId","period","status","subscriptionId"],
  listResp: ListInsuranceArrearsResponse,
  createBody: CreateInsuranceArrearBody,
  getResp: GetInsuranceArrearResponse,
  updateBody: UpdateInsuranceArrearBody,
  notFoundMessage: "Not found",
});

registerCrud(router, {
  base: "/insurance-penalties",
  // Issued by the central sequence engine; the client cannot choose it.
  generatedCode: { documentType: "insurancePenalty" },
  module: "insurancePenalties",
  entity: "insurancePenalty",
  table: insurancePenaltiesTable,
  searchCols: ["code","reason"],
  filterCols: ["companyId","penaltyType","status","subscriptionId"],
  listResp: ListInsurancePenaltiesResponse,
  createBody: CreateInsurancePenaltyBody,
  getResp: GetInsurancePenaltyResponse,
  updateBody: UpdateInsurancePenaltyBody,
  notFoundMessage: "Not found",
  hooks: postingHooks({ eventKey: "insurance.penalty", sourceType: "insurancePenalty", amountField: "amount", dateField: "penaltyDate", label: "Insurance penalty" }),
});

registerCrud(router, {
  base: "/service-terminations",
  // Issued by the central sequence engine; the client cannot choose it.
  generatedCode: { documentType: "serviceTermination" },
  module: "serviceTerminations",
  entity: "serviceTermination",
  table: serviceTerminationsTable,
  searchCols: ["code"],
  filterCols: ["companyId","reason","status","employeeId"],
  listResp: ListServiceTerminationsResponse,
  createBody: CreateServiceTerminationBody,
  getResp: GetServiceTerminationResponse,
  updateBody: UpdateServiceTerminationBody,
  notFoundMessage: "Not found",
});

registerCrud(router, {
  base: "/insurance-settlements",
  // Issued by the central sequence engine; the client cannot choose it.
  generatedCode: { documentType: "insuranceSettlement" },
  module: "insuranceSettlements",
  entity: "insuranceSettlement",
  table: insuranceSettlementsTable,
  searchCols: ["code"],
  filterCols: ["companyId","status","employeeId","serviceTerminationId"],
  listResp: ListInsuranceSettlementsResponse,
  createBody: CreateInsuranceSettlementBody,
  getResp: GetInsuranceSettlementResponse,
  updateBody: UpdateInsuranceSettlementBody,
  notFoundMessage: "Not found",
});

registerCrud(router, {
  base: "/insurance-clearances",
  // Issued by the central sequence engine; the client cannot choose it.
  generatedCode: { documentType: "insuranceClearance" },
  module: "insuranceClearances",
  entity: "insuranceClearance",
  table: insuranceClearancesTable,
  searchCols: ["code"],
  filterCols: ["companyId","status","employeeId","serviceTerminationId"],
  listResp: ListInsuranceClearancesResponse,
  createBody: CreateInsuranceClearanceBody,
  getResp: GetInsuranceClearanceResponse,
  updateBody: UpdateInsuranceClearanceBody,
  notFoundMessage: "Not found",
});

registerCrud(router, {
  base: "/subcontractor-insurances",
  // Issued by the central sequence engine; the client cannot choose it.
  generatedCode: { documentType: "subcontractorInsurance" },
  module: "subcontractorInsurances",
  entity: "subcontractorInsurance",
  table: subcontractorInsurancesTable,
  searchCols: ["code","contractorName"],
  filterCols: ["companyId","contractorType","insuranceStatus","projectId"],
  listResp: ListSubcontractorInsurancesResponse,
  createBody: CreateSubcontractorInsuranceBody,
  getResp: GetSubcontractorInsuranceResponse,
  updateBody: UpdateSubcontractorInsuranceBody,
  notFoundMessage: "Not found",
});

registerCrud(router, {
  base: "/project-labor-insurances",
  // Issued by the central sequence engine; the client cannot choose it.
  generatedCode: { documentType: "projectLaborInsurance" },
  module: "projectLaborInsurances",
  entity: "projectLaborInsurance",
  table: projectLaborInsurancesTable,
  searchCols: ["code","laborName"],
  filterCols: ["companyId","insuranceStatus","projectId","subcontractorInsuranceId"],
  listResp: ListProjectLaborInsurancesResponse,
  createBody: CreateProjectLaborInsuranceBody,
  getResp: GetProjectLaborInsuranceResponse,
  updateBody: UpdateProjectLaborInsuranceBody,
  notFoundMessage: "Not found",
});

// Dashboard: auth-only by the top-level *-dashboard convention (mirrors other
// module dashboards), gated by employeeInsurances.view.
router.get("/insurance-dashboard", requirePermission("employeeInsurances.view"), async (req, res): Promise<void> => {
  const companyId = qStr(req.query as Record<string, unknown>, "companyId");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countWhere = (table: any, extra?: SQL): SQL => {
    const f: SQL[] = [eq(table.isDeleted, false)];
    if (companyId) f.push(eq(table.companyId, companyId));
    if (extra) f.push(extra);
    return and(...f) as SQL;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countOf = async (table: any, extra?: SQL): Promise<number> => {
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(table).where(countWhere(table, extra));
    return count;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sumOf = async (table: any, col: any, extra?: SQL): Promise<string> => {
    const [{ total }] = await db.select({ total: sql<string>`coalesce(sum(${col}), 0)::text` }).from(table).where(countWhere(table, extra));
    return total;
  };
  const [insuredCount, suspendedCount, subscriptionsTotal, arrearsTotal, penaltiesTotal, arrearsAlerts, penaltyAlerts] =
    await Promise.all([
      countOf(employeeInsurancesTable, eq(employeeInsurancesTable.insuranceStatus, "active")),
      countOf(employeeInsurancesTable, eq(employeeInsurancesTable.insuranceStatus, "suspended")),
      sumOf(insuranceSubscriptionsTable, insuranceSubscriptionsTable.totalAmount),
      sumOf(insuranceArrearsTable, insuranceArrearsTable.amount, eq(insuranceArrearsTable.status, "outstanding")),
      sumOf(insurancePenaltiesTable, insurancePenaltiesTable.amount),
      countOf(insuranceArrearsTable, eq(insuranceArrearsTable.status, "outstanding")),
      countOf(insurancePenaltiesTable, eq(insurancePenaltiesTable.status, "pending")),
    ]);
  res.json(
    GetInsuranceDashboardResponse.parse({
      insuredCount,
      suspendedCount,
      subscriptionsTotal,
      arrearsTotal,
      penaltiesTotal,
      alertsCount: arrearsAlerts + penaltyAlerts,
    }),
  );
});

export default router;
