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

function registerCrud(opts: {
  base: string;
  module: string;
  entity: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any;
  searchCols: string[];
  filterCols: string[];
  listResp: CrudSchema;
  createBody: CrudSchema;
  getResp: CrudSchema;
  updateBody: CrudSchema;
  post?: PostConfig;
}): void {
  const { base, module, entity, table, searchCols, filterCols, listResp, createBody, getResp, updateBody, post } = opts;
  type Row = Record<string, unknown>;

  router.get(base, requirePermission(`${module}.view`), async (req, res): Promise<void> => {
    const q = req.query as Record<string, unknown>;
    const { page, pageSize, offset } = pageParams(q);
    const filters: SQL[] = [eq(table.isDeleted, false)];
    const search = qStr(q, "search");
    if (search) {
      const s = or(...searchCols.map((c) => ilike(table[c], `%${search}%`)));
      if (s) filters.push(s);
    }
    for (const c of filterCols) {
      const v = qStr(q, c);
      if (v) filters.push(eq(table[c], v));
    }
    const where = and(...filters);
    const countRes = (await db.select({ count: sql<number>`count(*)::int` }).from(table).where(where)) as { count: number }[];
    const rows = (await db.select().from(table).where(where).orderBy(desc(table.createdAt)).limit(pageSize).offset(offset)) as Row[];
    res.json(listResp.parse({ data: rows.map(serializeRow), total: countRes[0].count, page, pageSize }));
  });

  router.post(base, requirePermission(`${module}.create`), async (req, res): Promise<void> => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
    let row: Row;
    if (post) {
      row = await db.transaction(async (tx) => {
        const inserted = (await tx.insert(table).values({ ...parsed.data }).returning()) as Row[];
        const created = inserted[0];
        const entryDate = (created[post.dateField] as string | null) || new Date().toISOString().slice(0, 10);
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
        return created;
      });
    } else {
      const inserted = (await db.insert(table).values({ ...parsed.data }).returning()) as Row[];
      row = inserted[0];
    }
    await recordAudit(req, { action: "create", entity, entityId: String(row.id), newValue: row });
    res.status(201).json(getResp.parse(serializeRow(row)));
  });

  router.get(`${base}/:id`, requirePermission(`${module}.view`), async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const found = (await db.select().from(table).where(and(eq(table.id, id), eq(table.isDeleted, false)))) as Row[];
    const row = found[0];
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(getResp.parse(serializeRow(row)));
  });

  router.patch(`${base}/:id`, requirePermission(`${module}.update`), async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const parsed = updateBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
    const found = (await db.select().from(table).where(and(eq(table.id, id), eq(table.isDeleted, false)))) as Row[];
    const existing = found[0];
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    const update = { ...parsed.data };
    const row = Object.keys(update).length
      ? ((await db.update(table).set(update).where(eq(table.id, id)).returning()) as Row[])[0]
      : existing;
    await recordAudit(req, { action: "update", entity, entityId: id, oldValue: existing, newValue: row });
    res.json(getResp.parse(serializeRow(row)));
  });

  router.delete(`${base}/:id`, requirePermission(`${module}.delete`), async (req, res): Promise<void> => {
    const id = String(req.params.id);
    let ok = false;
    if (post) {
      ok = await db.transaction(async (tx) => {
        const updated = (await tx.update(table).set({ isDeleted: true, isActive: false }).where(and(eq(table.id, id), eq(table.isDeleted, false))).returning()) as Row[];
        if (!updated[0]) return false;
        await reverseAutomaticEntriesForSource(tx, post.sourceType, id, req.authUser?.id ?? null);
        return true;
      });
    } else {
      const updated = (await db.update(table).set({ isDeleted: true, isActive: false }).where(and(eq(table.id, id), eq(table.isDeleted, false))).returning()) as Row[];
      ok = !!updated[0];
    }
    if (!ok) { res.status(404).json({ error: "Not found" }); return; }
    await recordAudit(req, { action: "delete", entity, entityId: id });
    res.json({ success: true });
  });
}

registerCrud({
  base: "/employee-insurances",
  module: "employeeInsurances",
  entity: "employeeInsurance",
  table: employeeInsurancesTable,
  searchCols: ["code","insuranceNumber"],
  filterCols: ["companyId","employeeId","insuranceType","insuranceStatus"],
  listResp: ListEmployeeInsurancesResponse,
  createBody: CreateEmployeeInsuranceBody,
  getResp: GetEmployeeInsuranceResponse,
  updateBody: UpdateEmployeeInsuranceBody,
});

registerCrud({
  base: "/insurance-forms",
  module: "insuranceForms",
  entity: "insuranceForm",
  table: insuranceFormsTable,
  searchCols: ["code","formNumber"],
  filterCols: ["companyId","formType","status","employeeId"],
  listResp: ListInsuranceFormsResponse,
  createBody: CreateInsuranceFormBody,
  getResp: GetInsuranceFormResponse,
  updateBody: UpdateInsuranceFormBody,
});

registerCrud({
  base: "/insurance-additions",
  module: "insuranceAdditions",
  entity: "insuranceAddition",
  table: insuranceAdditionsTable,
  searchCols: ["code","formNumber"],
  filterCols: ["companyId","status","employeeId"],
  listResp: ListInsuranceAdditionsResponse,
  createBody: CreateInsuranceAdditionBody,
  getResp: GetInsuranceAdditionResponse,
  updateBody: UpdateInsuranceAdditionBody,
});

registerCrud({
  base: "/insurance-exclusions",
  module: "insuranceExclusions",
  entity: "insuranceExclusion",
  table: insuranceExclusionsTable,
  searchCols: ["code","formNumber"],
  filterCols: ["companyId","reason","status","employeeId"],
  listResp: ListInsuranceExclusionsResponse,
  createBody: CreateInsuranceExclusionBody,
  getResp: GetInsuranceExclusionResponse,
  updateBody: UpdateInsuranceExclusionBody,
});

registerCrud({
  base: "/insurance-data-amendments",
  module: "insuranceDataAmendments",
  entity: "insuranceDataAmendment",
  table: insuranceDataAmendmentsTable,
  searchCols: ["code","fieldName"],
  filterCols: ["companyId","amendmentType","status","employeeId"],
  listResp: ListInsuranceDataAmendmentsResponse,
  createBody: CreateInsuranceDataAmendmentBody,
  getResp: GetInsuranceDataAmendmentResponse,
  updateBody: UpdateInsuranceDataAmendmentBody,
});

registerCrud({
  base: "/insurance-subscriptions",
  module: "insuranceSubscriptions",
  entity: "insuranceSubscription",
  table: insuranceSubscriptionsTable,
  searchCols: ["code","period"],
  filterCols: ["companyId","branchId","period","status"],
  listResp: ListInsuranceSubscriptionsResponse,
  createBody: CreateInsuranceSubscriptionBody,
  getResp: GetInsuranceSubscriptionResponse,
  updateBody: UpdateInsuranceSubscriptionBody,
  post: { eventKey: "insurance.subscription", sourceType: "insuranceSubscription", amountField: "totalAmount", dateField: "dueDate", label: "Insurance subscription" },
});

registerCrud({
  base: "/insurance-payment-notices",
  module: "insurancePaymentNotices",
  entity: "insurancePaymentNotice",
  table: insurancePaymentNoticesTable,
  searchCols: ["code","noticeNumber"],
  filterCols: ["companyId","status","subscriptionId"],
  listResp: ListInsurancePaymentNoticesResponse,
  createBody: CreateInsurancePaymentNoticeBody,
  getResp: GetInsurancePaymentNoticeResponse,
  updateBody: UpdateInsurancePaymentNoticeBody,
});

registerCrud({
  base: "/insurance-reconciliations",
  module: "insuranceReconciliations",
  entity: "insuranceReconciliation",
  table: insuranceReconciliationsTable,
  searchCols: ["code","period"],
  filterCols: ["companyId","period","status"],
  listResp: ListInsuranceReconciliationsResponse,
  createBody: CreateInsuranceReconciliationBody,
  getResp: GetInsuranceReconciliationResponse,
  updateBody: UpdateInsuranceReconciliationBody,
});

registerCrud({
  base: "/insurance-arrears",
  module: "insuranceArrears",
  entity: "insuranceArrear",
  table: insuranceArrearsTable,
  searchCols: ["code","period"],
  filterCols: ["companyId","period","status","subscriptionId"],
  listResp: ListInsuranceArrearsResponse,
  createBody: CreateInsuranceArrearBody,
  getResp: GetInsuranceArrearResponse,
  updateBody: UpdateInsuranceArrearBody,
});

registerCrud({
  base: "/insurance-penalties",
  module: "insurancePenalties",
  entity: "insurancePenalty",
  table: insurancePenaltiesTable,
  searchCols: ["code","reason"],
  filterCols: ["companyId","penaltyType","status","subscriptionId"],
  listResp: ListInsurancePenaltiesResponse,
  createBody: CreateInsurancePenaltyBody,
  getResp: GetInsurancePenaltyResponse,
  updateBody: UpdateInsurancePenaltyBody,
  post: { eventKey: "insurance.penalty", sourceType: "insurancePenalty", amountField: "amount", dateField: "penaltyDate", label: "Insurance penalty" },
});

registerCrud({
  base: "/service-terminations",
  module: "serviceTerminations",
  entity: "serviceTermination",
  table: serviceTerminationsTable,
  searchCols: ["code"],
  filterCols: ["companyId","reason","status","employeeId"],
  listResp: ListServiceTerminationsResponse,
  createBody: CreateServiceTerminationBody,
  getResp: GetServiceTerminationResponse,
  updateBody: UpdateServiceTerminationBody,
});

registerCrud({
  base: "/insurance-settlements",
  module: "insuranceSettlements",
  entity: "insuranceSettlement",
  table: insuranceSettlementsTable,
  searchCols: ["code"],
  filterCols: ["companyId","status","employeeId","serviceTerminationId"],
  listResp: ListInsuranceSettlementsResponse,
  createBody: CreateInsuranceSettlementBody,
  getResp: GetInsuranceSettlementResponse,
  updateBody: UpdateInsuranceSettlementBody,
});

registerCrud({
  base: "/insurance-clearances",
  module: "insuranceClearances",
  entity: "insuranceClearance",
  table: insuranceClearancesTable,
  searchCols: ["code"],
  filterCols: ["companyId","status","employeeId","serviceTerminationId"],
  listResp: ListInsuranceClearancesResponse,
  createBody: CreateInsuranceClearanceBody,
  getResp: GetInsuranceClearanceResponse,
  updateBody: UpdateInsuranceClearanceBody,
});

registerCrud({
  base: "/subcontractor-insurances",
  module: "subcontractorInsurances",
  entity: "subcontractorInsurance",
  table: subcontractorInsurancesTable,
  searchCols: ["code","contractorName"],
  filterCols: ["companyId","contractorType","insuranceStatus","projectId"],
  listResp: ListSubcontractorInsurancesResponse,
  createBody: CreateSubcontractorInsuranceBody,
  getResp: GetSubcontractorInsuranceResponse,
  updateBody: UpdateSubcontractorInsuranceBody,
});

registerCrud({
  base: "/project-labor-insurances",
  module: "projectLaborInsurances",
  entity: "projectLaborInsurance",
  table: projectLaborInsurancesTable,
  searchCols: ["code","laborName"],
  filterCols: ["companyId","insuranceStatus","projectId","subcontractorInsuranceId"],
  listResp: ListProjectLaborInsurancesResponse,
  createBody: CreateProjectLaborInsuranceBody,
  getResp: GetProjectLaborInsuranceResponse,
  updateBody: UpdateProjectLaborInsuranceBody,
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
