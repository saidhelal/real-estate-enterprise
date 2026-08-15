import { nextNumber } from "../lib/doc-number";
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

import { registerCrud, CrudRefused, type CrudConfig as SharedCrudConfig, type Tx } from "../lib/register-crud";
import { assertCertificateApproved } from "../lib/construction-approval";
import { applyCertificateTotals, applyItemTotals } from "../lib/certificate-amounts";
import { PostingError } from "../lib/posting";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Registers whose rows are components of a payment certificate.
 *
 * Each carries a certificate id, and the certificate's deduction, addition,
 * retention and advance-recovery totals are derived from them. Changing one
 * therefore changes the certificate's net, so the parent is recomputed
 * whenever a component is written or removed — otherwise the money a
 * contractor is paid would depend on the order someone happened to save in.
 */
const CERTIFICATE_COMPONENTS = new Set([
  "contractorDeduction",
  "contractorAddition",
  "retention",
  "advanceRecovery",
]);

const POSTED_STATUSES = new Set(["posted", "paid", "closed"]);

function moneyToCents(v: unknown): number {
  if (typeof v !== "string" || v.trim() === "") return 0;
  const n = Math.round(parseFloat(v) * 100);
  return Number.isFinite(n) ? n : 0;
}

function computeCertificateNet(row: Record<string, unknown>): void {
  const net =
    moneyToCents(row.currentAmount) +
    moneyToCents(row.additionsAmount) -
    moneyToCents(row.retentionAmount) -
    moneyToCents(row.advanceRecovery) -
    moneyToCents(row.deductionsAmount);
  row.netAmount = (net / 100).toFixed(2);
}

/**
 * Construction keeps every rule below. The shared factory supplies the CRUD
 * routes and the transaction; what may change, what gets posted and what is
 * logged stays here.
 */
type CrudConfig = SharedCrudConfig & {
  financial?: FinancialConfig;
  workflow?: WorkflowConfig;
  derive?: (row: Record<string, unknown>) => void;
};


const resources: CrudConfig[] = [
  // Contractors & contracts
  { path: "contractors", table: contractorsTable, module: "contractors", entity: "contractor",
    // Issued by the central sequence engine; the client cannot choose it.
    generatedCode: { documentType: "contractor" },
    createBody: CreateContractorBody, updateBody: UpdateContractorBody, listResponse: ListContractorsResponse,
    search: ["code", "name", "nameAr", "email"] },
  { path: "contractor-contracts", table: contractorContractsTable, module: "contractorContracts", entity: "contractorContract",
    generatedCode: { documentType: "contractorContract" },
    createBody: CreateContractorContractBody, updateBody: UpdateContractorContractBody, listResponse: ListContractorContractsResponse,
    search: ["code", "title", "titleAr"] },
  { path: "contract-boq-items", table: contractBoqItemsTable, module: "contractBoqItems", entity: "contractBoqItem",
    createBody: CreateContractBoqItemBody, updateBody: UpdateContractBoqItemBody, listResponse: ListContractBoqItemsResponse,
    search: ["description", "unit"] },
  // Work progress
  { path: "work-progress-updates", table: workProgressUpdatesTable, module: "workProgressUpdates", entity: "workProgressUpdate",
    generatedCode: { documentType: "workProgressUpdate" },
    createBody: CreateWorkProgressUpdateBody, updateBody: UpdateWorkProgressUpdateBody, listResponse: ListWorkProgressUpdatesResponse,
    search: ["code", "description"] },
  // IPC (مستخلصات المقاولين): net payable is derived from its components,
  // posting is gated on the `posted` status, and each status transition is
  // logged to certificate_approval_logs.
  { path: "payment-certificates", table: paymentCertificatesTable, module: "paymentCertificates", entity: "paymentCertificate",
    generatedCode: { documentType: "paymentCertificate" },
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
    generatedCode: { documentType: "variationOrder" },
    createBody: CreateVariationOrderBody, updateBody: UpdateVariationOrderBody, listResponse: ListVariationOrdersResponse,
    search: ["code", "title", "titleAr"] },
  // Deductions / additions
  { path: "contractor-deductions", table: contractorDeductionsTable, module: "contractorDeductions", entity: "contractorDeduction",
    generatedCode: { documentType: "contractorDeduction" },
    createBody: CreateContractorDeductionBody, updateBody: UpdateContractorDeductionBody, listResponse: ListContractorDeductionsResponse,
    search: ["code", "description"] },
  { path: "contractor-additions", table: contractorAdditionsTable, module: "contractorAdditions", entity: "contractorAddition",
    generatedCode: { documentType: "contractorAddition" },
    createBody: CreateContractorAdditionBody, updateBody: UpdateContractorAdditionBody, listResponse: ListContractorAdditionsResponse,
    search: ["code", "description"] },
  // Retention / advance
  { path: "retentions", table: retentionsTable, module: "retentions", entity: "retention",
    generatedCode: { documentType: "retention" },
    createBody: CreateRetentionBody, updateBody: UpdateRetentionBody, listResponse: ListRetentionsResponse,
    search: ["code"] },
  { path: "advance-payments", table: advancePaymentsTable, module: "advancePayments", entity: "advancePayment",
    generatedCode: { documentType: "advancePayment" },
    createBody: CreateAdvancePaymentBody, updateBody: UpdateAdvancePaymentBody, listResponse: ListAdvancePaymentsResponse,
    search: ["code"],
    financial: { eventKey: "engineering.advance_payment", amountField: "amount", dateField: "paymentDate" } },
  { path: "advance-recoveries", table: advanceRecoveriesTable, module: "advanceRecoveries", entity: "advanceRecovery",
    generatedCode: { documentType: "advanceRecovery" },
    createBody: CreateAdvanceRecoveryBody, updateBody: UpdateAdvanceRecoveryBody, listResponse: ListAdvanceRecoverysResponse,
    search: ["code"] },
  // Invoices
  { path: "contractor-invoices", table: contractorInvoicesTable, module: "contractorInvoices", entity: "contractorInvoice",
    generatedCode: { documentType: "contractorInvoice" },
    createBody: CreateContractorInvoiceBody, updateBody: UpdateContractorInvoiceBody, listResponse: ListContractorInvoicesResponse,
    search: ["code", "invoiceNumber"],
    financial: { eventKey: "engineering.contractor_invoice", amountField: "amount", dateField: "invoiceDate" } },
  // Approval workflow
  { path: "contract-approvals", table: contractApprovalsTable, module: "contractApprovals", entity: "contractApproval",
    generatedCode: { documentType: "contractApproval" },
    createBody: CreateContractApprovalBody, updateBody: UpdateContractApprovalBody, listResponse: ListContractApprovalsResponse,
    search: ["code", "approverName"] },
  // Certificate workflow (Module #13): statuses, approvals, transition log
  { path: "certificate-statuses", table: certificateStatusesTable, module: "certificateStatuses", entity: "certificateStatus",
    // Issued by the central sequence engine; the client cannot choose it.
    generatedCode: { documentType: "certificateStatus" },
    createBody: CreateCertificateStatusBody, updateBody: UpdateCertificateStatusBody, listResponse: ListCertificateStatussResponse,
    search: ["code", "name", "nameAr"] },
  { path: "certificate-approvals", table: certificateApprovalsTable, module: "certificateApprovals", entity: "certificateApproval",
    generatedCode: { documentType: "certificateApproval" },
    createBody: CreateCertificateApprovalBody, updateBody: UpdateCertificateApprovalBody, listResponse: ListCertificateApprovalsResponse,
    search: ["code", "approverName"] },
  { path: "certificate-approval-logs", table: certificateApprovalLogsTable, module: "certificateApprovalLogs", entity: "certificateApprovalLog",
    generatedCode: { documentType: "certificateApprovalLog" },
    createBody: CreateCertificateApprovalLogBody, updateBody: UpdateCertificateApprovalLogBody, listResponse: ListCertificateApprovalLogsResponse,
    search: ["code", "action"] },
];

/**
 * Construction-owned rules, expressed as the shared factory's generic hooks.
 * Copied verbatim from the module's previous CRUD body — no accounting or
 * workflow semantics were changed.
 */
function constructionHooks(cfg: CrudConfig) {
  const fin = cfg.financial;
  const wf = cfg.workflow;
  return {
    derive: cfg.derive,
    prepareUpdate: (update: Record<string, unknown>, existing: Record<string, unknown>) => {
      if (!fin) return;
      const alreadyPosted = fin.postOnStatus
        ? POSTED_STATUSES.has(existing.status as string)
        : Boolean(fin);
      if (cfg.derive && !alreadyPosted) {
        const merged = { ...existing, ...update };
        cfg.derive(merged);
        update[fin.amountField] = merged[fin.amountField];
      } else {
        delete update[fin.amountField];
        for (const f of fin.componentFields ?? []) delete update[f];
      }
    },
    inCreateTx: async (tx: Tx, created: Record<string, unknown>, req: import("express").Request) => {
      // Derived cumulative figures, computed before anything reads them.
      if (cfg.entity === "paymentCertificate") await applyCertificateTotals(tx, String(created.id));
      if (CERTIFICATE_COMPONENTS.has(cfg.entity) && created.certificateId) {
        await applyCertificateTotals(tx, String(created.certificateId));
      }
      if (cfg.entity === "certificateItem") await applyItemTotals(tx, String(created.id));
      if (!fin || fin.postOnStatus) return;
      const amount = created[fin.amountField];
      if (typeof amount !== "string" || amount.trim() === "") return;
      const entryDate =
        (fin.dateField && typeof created[fin.dateField] === "string"
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
    },
    inUpdateTx: async (
      tx: Tx,
      updated: Record<string, unknown>,
      existing: Record<string, unknown>,
      req: import("express").Request,
    ) => {
      const newStatus = updated.status as string | undefined;
      const statusChanged = newStatus !== undefined && newStatus !== existing.status;
      const transitionsToPosted =
        fin?.postOnStatus !== undefined &&
        newStatus === fin.postOnStatus &&
        existing.status !== fin.postOnStatus;

      // A payment certificate pays a contractor the moment it posts. The
      // approval levels recorded against it are the control on that money, and
      // nothing consulted them: anyone holding `paymentCertificates.update`
      // could PATCH the status to `posted` with every approval still pending.
      //
      // Refused here, inside the transaction, so the status change and the
      // ledger entry roll back together.
      if (transitionsToPosted && cfg.entity === "paymentCertificate") {
        try {
          await assertCertificateApproved(tx, String(updated.id), String(updated.code ?? ""));
        } catch (err) {
          if (err instanceof PostingError) throw new CrudRefused(err.message, err.status);
          throw err;
        }
      }

      // The cumulative figures are arithmetic over the certificates already
      // issued against this contract, not something a user should retype: the
      // running total a contractor is paid against was a text box, so it was
      // whatever the person filling in the certificate believed it to be.
      if (cfg.entity === "paymentCertificate") {
        await applyCertificateTotals(tx, String(updated.id));
      }
      if (CERTIFICATE_COMPONENTS.has(cfg.entity)) {
        // Both parents: moving a deduction from one certificate to another
        // changes the net of the one it left as much as the one it joined.
        for (const parent of new Set([existing.certificateId, updated.certificateId])) {
          if (parent) await applyCertificateTotals(tx, String(parent));
        }
      }
      if (cfg.entity === "certificateItem") {
        await applyItemTotals(tx, String(updated.id));
      }
      if (fin && transitionsToPosted) {
        const amount = updated[fin.amountField];
        if (typeof amount === "string" && amount.trim() !== "") {
          const entryDate =
            (fin.dateField && typeof updated[fin.dateField] === "string"
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
      if (wf && statusChanged) {
        await tx.insert(wf.logTable).values({
          companyId: updated.companyId as string,
          // Approval-log reference from the central sequence, not a timestamp.
          code: (await nextNumber("approvalLog", (updated.companyId as string) ?? null)).value,
          [wf.sourceField]: String(updated.id),
          action: newStatus,
          fromStatus: (existing.status as string) ?? null,
          toStatus: newStatus,
          actorName: req.authUser?.username ?? req.authUser?.id ?? null,
          actionDate: today(),
        });
      }
    },
    inDeleteTx: async (tx: Tx, row: Record<string, unknown>, req: import("express").Request) => {
      if (!fin) return;
      await reverseAutomaticEntriesForSource(tx, cfg.entity, String(row.id), req.authUser?.id ?? null);
    },
  };
}

for (const cfg of resources) {
  const { financial, workflow, derive, ...rest } = cfg;
  void financial; void workflow; void derive;
  registerCrud(router, { ...rest, getOne: true, hooks: constructionHooks(cfg) });
}

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
