import { Router, type IRouter } from "express";
import { and, eq, ne, or, ilike, sql, desc, type SQL } from "drizzle-orm";
import {
  db,
  contractorsTable,
  contractorContractsTable,
  contractBoqItemsTable,
  workProgressUpdatesTable,
  paymentCertificatesTable,
  certificateItemsTable,
  variationOrdersTable,
  contractorDeductionsTable,
  contractorAdditionsTable,
  retentionsTable,
  advancePaymentsTable,
  advanceRecoveriesTable,
  contractorInvoicesTable,
  contractApprovalsTable,
  certificateStatusesTable,
  certificateApprovalsTable,
  certificateApprovalLogsTable,
} from "@workspace/db";
import {
  CreateContractorBody, UpdateContractorBody, ListContractorsResponse,
  CreateContractorContractBody, UpdateContractorContractBody, ListContractorContractsResponse,
  CreateContractBoqItemBody, UpdateContractBoqItemBody, ListContractBoqItemsResponse,
  CreateWorkProgressUpdateBody, UpdateWorkProgressUpdateBody, ListWorkProgressUpdatesResponse,
  CreatePaymentCertificateBody, UpdatePaymentCertificateBody, ListPaymentCertificatesResponse,
  CreateCertificateItemBody, UpdateCertificateItemBody, ListCertificateItemsResponse,
  CreateVariationOrderBody, UpdateVariationOrderBody, ListVariationOrdersResponse,
  CreateContractorDeductionBody, UpdateContractorDeductionBody, ListContractorDeductionsResponse,
  CreateContractorAdditionBody, UpdateContractorAdditionBody, ListContractorAdditionsResponse,
  CreateRetentionBody, UpdateRetentionBody, ListRetentionsResponse,
  CreateAdvancePaymentBody, UpdateAdvancePaymentBody, ListAdvancePaymentsResponse,
  CreateAdvanceRecoveryBody, UpdateAdvanceRecoveryBody, ListAdvanceRecoverysResponse,
  CreateContractorInvoiceBody, UpdateContractorInvoiceBody, ListContractorInvoicesResponse,
  CreateContractApprovalBody, UpdateContractApprovalBody, ListContractApprovalsResponse,
  CreateCertificateStatusBody, UpdateCertificateStatusBody, ListCertificateStatussResponse,
  CreateCertificateApprovalBody, UpdateCertificateApprovalBody, ListCertificateApprovalsResponse,
  CreateCertificateApprovalLogBody, UpdateCertificateApprovalLogBody, ListCertificateApprovalLogsResponse,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";
import { postAutomaticEntry, reverseAutomaticEntriesForSource } from "../lib/posting";

const router: IRouter = Router();
router.use(requireAuth);

/**
 * Optional accounting/treasury integration for money-moving resources.
 * On create, post an automatic journal entry (best-effort: skips cleanly when
 * the company has no account_mappings for the event key). On delete, reverse
 * any automatic entries for the source. Idempotent per (sourceType, sourceId).
 */
interface FinancialConfig {
  eventKey: string;
  amountField: string;
  dateField?: string;
  // When set, the automatic entry is posted only when the row reaches this
  // status (on create if already at it, or on the patch that transitions into
  // it) rather than on every create. The amount also stays mutable until the
  // row is posted, so derived totals can change while the certificate is still
  // a draft/under review.
  postOnStatus?: string;
  // Component columns that feed the derived total. Once the row is posted these
  // are frozen alongside the amount field so the breakdown can never drift away
  // from the ledger-backed total.
  componentFields?: string[];
}

// A workflow log captures each status transition into a dedicated log table.
interface WorkflowConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  logTable: any;
  sourceField: string;
}

interface CrudConfig {
  path: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any;
  module: string;
  entity: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createBody: { safeParse(v: unknown): any };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateBody: { safeParse(v: unknown): any };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listResponse: { parse(v: unknown): any };
  search: string[];
  financial?: FinancialConfig;
  workflow?: WorkflowConfig;
  // Recompute derived fields (e.g. net payable) from component columns.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  derive?: (row: Record<string, unknown>) => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Statuses at/after which a certificate's financial total is frozen because it
// has driven (or will drive) a ledger entry.
const POSTED_STATUSES = new Set(["posted", "paid", "closed"]);

function moneyToCents(v: unknown): number {
  if (typeof v !== "string" || v.trim() === "") return 0;
  const n = Math.round(parseFloat(v) * 100);
  return Number.isFinite(n) ? n : 0;
}

// Net payable = current certified + additions - retention - advance recovery
// - deductions. Integer-cent math (no float drift), mirrors lib/posting.ts.
function computeCertificateNet(row: Record<string, unknown>): void {
  const net =
    moneyToCents(row.currentAmount) +
    moneyToCents(row.additionsAmount) -
    moneyToCents(row.retentionAmount) -
    moneyToCents(row.advanceRecovery) -
    moneyToCents(row.deductionsAmount);
  row.netAmount = (net / 100).toFixed(2);
}

function registerCrud(cfg: CrudConfig): void {
  const t = cfg.table;

  router.get(`/${cfg.path}`, requirePermission(`${cfg.module}.view`), async (req, res): Promise<void> => {
    const query = req.query as Record<string, unknown>;
    const { page, pageSize, offset } = pageParams(query);
    const search = qStr(query, "search");
    const companyId = qStr(query, "companyId");
    const conds: SQL[] = [eq(t.isDeleted, false)];
    if (companyId) conds.push(eq(t.companyId, companyId));
    if (search && cfg.search.length) {
      const like = `%${search}%`;
      const ors = cfg.search.map((c) => ilike(t[c], like));
      const combined = or(...ors);
      if (combined) conds.push(combined);
    }
    const where = and(...conds);
    const rows = (await db
      .select()
      .from(t)
      .where(where)
      .orderBy(desc(t.createdAt))
      .limit(pageSize)
      .offset(offset)) as Record<string, unknown>[];
    const countRows = (await db
      .select({ count: sql<number>`count(*)::int` })
      .from(t)
      .where(where)) as { count: number }[];
    const count = countRows[0].count;
    res.json(cfg.listResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
  });

  router.post(`/${cfg.path}`, requirePermission(`${cfg.module}.create`), async (req, res): Promise<void> => {
    const parsed = cfg.createBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const data = parsed.data as Record<string, unknown>;
    if (cfg.derive) cfg.derive(data);
    const fin = cfg.financial;
    const row = await db.transaction(async (tx) => {
      const inserted = (await tx.insert(t).values(data).returning()) as Record<string, unknown>[];
      const created = inserted[0];
      const shouldPost = fin && (!fin.postOnStatus || created.status === fin.postOnStatus);
      if (fin && shouldPost) {
        const amount = created[fin.amountField];
        if (typeof amount === "string" && amount.trim() !== "") {
          const entryDate = (fin.dateField && typeof created[fin.dateField] === "string"
            ? (created[fin.dateField] as string)
            : null) ?? today();
          await postAutomaticEntry(tx, {
            companyId: created.companyId as string,
            eventKey: fin.eventKey,
            amount,
            entryDate,
            description: `${cfg.entity} ${created.code ?? created.id}`,
            sourceType: cfg.entity,
            sourceId: created.id as string,
            userId: req.authUser?.id ?? null,
          });
        }
      }
      return created;
    });
    await recordAudit(req, { action: "create", entity: cfg.entity, entityId: row.id as string, newValue: row });
    res.status(201).json(serializeRow(row));
  });

  router.get(`/${cfg.path}/:id`, requirePermission(`${cfg.module}.view`), async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const rows = (await db
      .select()
      .from(t)
      .where(and(eq(t.id, id), eq(t.isDeleted, false)))) as Record<string, unknown>[];
    const row = rows[0];
    if (!row) {
      res.status(404).json({ error: `${cfg.entity} not found` });
      return;
    }
    res.json(serializeRow(row));
  });

  router.patch(`/${cfg.path}/:id`, requirePermission(`${cfg.module}.update`), async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const parsed = cfg.updateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const existingRows = (await db
      .select()
      .from(t)
      .where(and(eq(t.id, id), eq(t.isDeleted, false)))) as Record<string, unknown>[];
    const existing = existingRows[0];
    if (!existing) {
      res.status(404).json({ error: `${cfg.entity} not found` });
      return;
    }
    const update: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed.data as Record<string, unknown>)) {
      if (v !== undefined) update[k] = v;
    }
    const fin = cfg.financial;
    const alreadyPosted = fin?.postOnStatus
      ? POSTED_STATUSES.has(existing.status as string)
      : Boolean(fin);
    if (fin) {
      if (cfg.derive && !alreadyPosted) {
        // Recompute the derived total from the merged components while the row
        // is still mutable (draft/under review).
        const merged = { ...existing, ...update };
        cfg.derive(merged);
        update[fin.amountField] = merged[fin.amountField];
      } else {
        // Once the row has driven (or will drive) a ledger entry, both the
        // posted amount and the components that derive it are immutable.
        delete update[fin.amountField];
        for (const f of fin.componentFields ?? []) delete update[f];
      }
    }
    const newStatus = update.status as string | undefined;
    const statusChanged = newStatus !== undefined && newStatus !== existing.status;
    const transitionsToPosted =
      fin?.postOnStatus !== undefined &&
      newStatus === fin.postOnStatus &&
      existing.status !== fin.postOnStatus;

    const row = await db.transaction(async (tx) => {
      let updated = existing;
      if (Object.keys(update).length) {
        const rows = (await tx.update(t).set(update).where(eq(t.id, id)).returning()) as Record<string, unknown>[];
        updated = rows[0];
      }
      if (fin && transitionsToPosted) {
        const amount = updated[fin.amountField];
        if (typeof amount === "string" && amount.trim() !== "") {
          const entryDate = (fin.dateField && typeof updated[fin.dateField] === "string"
            ? (updated[fin.dateField] as string)
            : null) ?? today();
          await postAutomaticEntry(tx, {
            companyId: updated.companyId as string,
            eventKey: fin.eventKey,
            amount,
            entryDate,
            description: `${cfg.entity} ${updated.code ?? updated.id}`,
            sourceType: cfg.entity,
            sourceId: updated.id as string,
            userId: req.authUser?.id ?? null,
          });
        }
      }
      if (cfg.workflow && statusChanged) {
        await tx.insert(cfg.workflow.logTable).values({
          companyId: updated.companyId as string,
          code: `CAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          [cfg.workflow.sourceField]: id,
          action: newStatus,
          fromStatus: (existing.status as string) ?? null,
          toStatus: newStatus,
          actorName: req.authUser?.username ?? req.authUser?.id ?? null,
          actionDate: today(),
        });
      }
      return updated;
    });
    await recordAudit(req, {
      action: "update",
      entity: cfg.entity,
      entityId: id,
      oldValue: existing,
      newValue: row,
    });
    res.json(serializeRow(row));
  });

  router.delete(`/${cfg.path}/:id`, requirePermission(`${cfg.module}.delete`), async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const fin = cfg.financial;
    const row = await db.transaction(async (tx) => {
      const existingRows = (await tx
        .select()
        .from(t)
        .where(and(eq(t.id, id), eq(t.isDeleted, false)))) as Record<string, unknown>[];
      const existing = existingRows[0];
      if (!existing) return null;
      await tx.update(t).set({ isDeleted: true, isActive: false }).where(eq(t.id, id));
      if (fin) {
        await reverseAutomaticEntriesForSource(tx, cfg.entity, id, req.authUser?.id ?? null);
      }
      return existing;
    });
    if (!row) {
      res.status(404).json({ error: `${cfg.entity} not found` });
      return;
    }
    await recordAudit(req, { action: "delete", entity: cfg.entity, entityId: id, oldValue: row });
    res.json({ success: true });
  });
}

const resources: CrudConfig[] = [
  // Contractors & contracts
  { path: "contractors", table: contractorsTable, module: "contractors", entity: "contractor",
    createBody: CreateContractorBody, updateBody: UpdateContractorBody, listResponse: ListContractorsResponse,
    search: ["code", "name", "nameAr", "email"] },
  { path: "contractor-contracts", table: contractorContractsTable, module: "contractorContracts", entity: "contractorContract",
    createBody: CreateContractorContractBody, updateBody: UpdateContractorContractBody, listResponse: ListContractorContractsResponse,
    search: ["code", "title", "titleAr"] },
  { path: "contract-boq-items", table: contractBoqItemsTable, module: "contractBoqItems", entity: "contractBoqItem",
    createBody: CreateContractBoqItemBody, updateBody: UpdateContractBoqItemBody, listResponse: ListContractBoqItemsResponse,
    search: ["description", "unit"] },
  // Work progress
  { path: "work-progress-updates", table: workProgressUpdatesTable, module: "workProgressUpdates", entity: "workProgressUpdate",
    createBody: CreateWorkProgressUpdateBody, updateBody: UpdateWorkProgressUpdateBody, listResponse: ListWorkProgressUpdatesResponse,
    search: ["code", "description"] },
  // IPC (مستخلصات المقاولين): net payable is derived from its components,
  // posting is gated on the `posted` status, and each status transition is
  // logged to certificate_approval_logs.
  { path: "payment-certificates", table: paymentCertificatesTable, module: "paymentCertificates", entity: "paymentCertificate",
    createBody: CreatePaymentCertificateBody, updateBody: UpdatePaymentCertificateBody, listResponse: ListPaymentCertificatesResponse,
    search: ["code", "certificateNumber"],
    financial: { eventKey: "engineering.payment_certificate", amountField: "netAmount", dateField: "certificateDate", postOnStatus: "posted",
      componentFields: ["currentAmount", "additionsAmount", "retentionAmount", "advanceRecovery", "deductionsAmount"] },
    derive: computeCertificateNet,
    workflow: { logTable: certificateApprovalLogsTable, sourceField: "certificateId" } },
  { path: "certificate-items", table: certificateItemsTable, module: "certificateItems", entity: "certificateItem",
    createBody: CreateCertificateItemBody, updateBody: UpdateCertificateItemBody, listResponse: ListCertificateItemsResponse,
    search: ["description", "unit"] },
  // Variations
  { path: "variation-orders", table: variationOrdersTable, module: "variationOrders", entity: "variationOrder",
    createBody: CreateVariationOrderBody, updateBody: UpdateVariationOrderBody, listResponse: ListVariationOrdersResponse,
    search: ["code", "title", "titleAr"] },
  // Deductions / additions
  { path: "contractor-deductions", table: contractorDeductionsTable, module: "contractorDeductions", entity: "contractorDeduction",
    createBody: CreateContractorDeductionBody, updateBody: UpdateContractorDeductionBody, listResponse: ListContractorDeductionsResponse,
    search: ["code", "description"] },
  { path: "contractor-additions", table: contractorAdditionsTable, module: "contractorAdditions", entity: "contractorAddition",
    createBody: CreateContractorAdditionBody, updateBody: UpdateContractorAdditionBody, listResponse: ListContractorAdditionsResponse,
    search: ["code", "description"] },
  // Retention / advance
  { path: "retentions", table: retentionsTable, module: "retentions", entity: "retention",
    createBody: CreateRetentionBody, updateBody: UpdateRetentionBody, listResponse: ListRetentionsResponse,
    search: ["code"] },
  { path: "advance-payments", table: advancePaymentsTable, module: "advancePayments", entity: "advancePayment",
    createBody: CreateAdvancePaymentBody, updateBody: UpdateAdvancePaymentBody, listResponse: ListAdvancePaymentsResponse,
    search: ["code"],
    financial: { eventKey: "engineering.advance_payment", amountField: "amount", dateField: "paymentDate" } },
  { path: "advance-recoveries", table: advanceRecoveriesTable, module: "advanceRecoveries", entity: "advanceRecovery",
    createBody: CreateAdvanceRecoveryBody, updateBody: UpdateAdvanceRecoveryBody, listResponse: ListAdvanceRecoverysResponse,
    search: ["code"] },
  // Invoices
  { path: "contractor-invoices", table: contractorInvoicesTable, module: "contractorInvoices", entity: "contractorInvoice",
    createBody: CreateContractorInvoiceBody, updateBody: UpdateContractorInvoiceBody, listResponse: ListContractorInvoicesResponse,
    search: ["code", "invoiceNumber"],
    financial: { eventKey: "engineering.contractor_invoice", amountField: "amount", dateField: "invoiceDate" } },
  // Approval workflow
  { path: "contract-approvals", table: contractApprovalsTable, module: "contractApprovals", entity: "contractApproval",
    createBody: CreateContractApprovalBody, updateBody: UpdateContractApprovalBody, listResponse: ListContractApprovalsResponse,
    search: ["code", "approverName"] },
  // Certificate workflow (Module #13): statuses, approvals, transition log
  { path: "certificate-statuses", table: certificateStatusesTable, module: "certificateStatuses", entity: "certificateStatus",
    createBody: CreateCertificateStatusBody, updateBody: UpdateCertificateStatusBody, listResponse: ListCertificateStatussResponse,
    search: ["code", "name", "nameAr"] },
  { path: "certificate-approvals", table: certificateApprovalsTable, module: "certificateApprovals", entity: "certificateApproval",
    createBody: CreateCertificateApprovalBody, updateBody: UpdateCertificateApprovalBody, listResponse: ListCertificateApprovalsResponse,
    search: ["code", "approverName"] },
  { path: "certificate-approval-logs", table: certificateApprovalLogsTable, module: "certificateApprovalLogs", entity: "certificateApprovalLog",
    createBody: CreateCertificateApprovalLogBody, updateBody: UpdateCertificateApprovalLogBody, listResponse: ListCertificateApprovalLogsResponse,
    search: ["code", "action"] },
];

for (const cfg of resources) registerCrud(cfg);

/* ------------------------------------------------------------------ */
/* Construction execution dashboard KPIs                               */
/* ------------------------------------------------------------------ */

router.get("/construction/dashboard", async (req, res): Promise<void> => {
  const companyId = qStr(req.query as Record<string, unknown>, "companyId");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const company = (t: any): SQL | undefined => (companyId ? eq(t.companyId, companyId) : undefined);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countWhere = async (t: any, extra?: SQL): Promise<number> => {
    const conds: SQL[] = [eq(t.isDeleted, false)];
    const c = company(t);
    if (c) conds.push(c);
    if (extra) conds.push(extra);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(t).where(and(...conds));
    return count;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sumWhere = async (t: any, col: any, extra?: SQL): Promise<string> => {
    const conds: SQL[] = [eq(t.isDeleted, false)];
    const c = company(t);
    if (c) conds.push(c);
    if (extra) conds.push(extra);
    const [{ total }] = await db
      .select({ total: sql<string>`coalesce(sum(${col}), 0)::text` })
      .from(t)
      .where(and(...conds));
    return total;
  };

  const [
    contractsCount,
    activeContracts,
    openVariations,
    pendingApprovals,
    pendingInvoices,
  ] = await Promise.all([
    countWhere(contractorContractsTable),
    countWhere(contractorContractsTable, eq(contractorContractsTable.status, "active")),
    countWhere(variationOrdersTable, ne(variationOrdersTable.status, "approved")),
    countWhere(contractApprovalsTable, eq(contractApprovalsTable.status, "pending")),
    countWhere(contractorInvoicesTable, ne(contractorInvoicesTable.status, "paid")),
  ]);

  const [
    totalContractValue,
    totalCertified,
    totalDeductions,
    totalAdditions,
    retentionHeld,
  ] = await Promise.all([
    sumWhere(contractorContractsTable, contractorContractsTable.contractValue),
    sumWhere(paymentCertificatesTable, paymentCertificatesTable.netAmount),
    sumWhere(contractorDeductionsTable, contractorDeductionsTable.amount),
    sumWhere(contractorAdditionsTable, contractorAdditionsTable.amount),
    sumWhere(retentionsTable, retentionsTable.retainedAmount),
  ]);

  const contractStatusConds: SQL[] = [eq(contractorContractsTable.isDeleted, false)];
  const cc = company(contractorContractsTable);
  if (cc) contractStatusConds.push(cc);
  const contractsByStatus = await db
    .select({ status: contractorContractsTable.status, count: sql<number>`count(*)::int` })
    .from(contractorContractsTable)
    .where(and(...contractStatusConds))
    .groupBy(contractorContractsTable.status);

  const certStatusConds: SQL[] = [eq(paymentCertificatesTable.isDeleted, false)];
  const pc = company(paymentCertificatesTable);
  if (pc) certStatusConds.push(pc);
  const certificatesByStatus = await db
    .select({ status: paymentCertificatesTable.status, count: sql<number>`count(*)::int` })
    .from(paymentCertificatesTable)
    .where(and(...certStatusConds))
    .groupBy(paymentCertificatesTable.status);

  res.json({
    contractsCount,
    activeContracts,
    totalContractValue,
    totalCertified,
    totalDeductions,
    totalAdditions,
    retentionHeld,
    openVariations,
    pendingApprovals,
    pendingInvoices,
    contractsByStatus,
    certificatesByStatus,
  });
});

export default router;
