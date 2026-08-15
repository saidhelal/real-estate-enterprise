import { Router, type IRouter } from "express";
import { and, eq, ne, or, ilike, sql, desc, type SQL } from "drizzle-orm";
import {
  db,
  supplierCategoriesTable,
  suppliersTable,
  supplierContactsTable,
  supplierEvaluationsTable,
  purchaseRequestsTable,
  purchaseRequestItemsTable,
  rfqsTable,
  rfqItemsTable,
  rfqSuppliersTable,
  supplierQuotationsTable,
  quotationItemsTable,
  purchaseOrdersTable,
  purchaseOrderItemsTable,
  purchaseContractsTable,
  purchaseContractAmendmentsTable,
  goodsReceiptNotesTable,
  grnItemsTable,
  purchaseReturnsTable,
  purchaseReturnItemsTable,
  procurementApprovalsTable,
} from "@workspace/db";
import {
  CreateSupplierCategoryBody, UpdateSupplierCategoryBody, ListSupplierCategorysResponse,
  CreateSupplierBody, UpdateSupplierBody, ListSuppliersResponse,
  CreateSupplierContactBody, UpdateSupplierContactBody, ListSupplierContactsResponse,
  CreateSupplierEvaluationBody, UpdateSupplierEvaluationBody, ListSupplierEvaluationsResponse,
  CreatePurchaseRequestBody, UpdatePurchaseRequestBody, ListPurchaseRequestsResponse,
  CreatePurchaseRequestItemBody, UpdatePurchaseRequestItemBody, ListPurchaseRequestItemsResponse,
  CreateRfqBody, UpdateRfqBody, ListRfqsResponse,
  CreateRfqItemBody, UpdateRfqItemBody, ListRfqItemsResponse,
  CreateRfqSupplierBody, UpdateRfqSupplierBody, ListRfqSuppliersResponse,
  CreateSupplierQuotationBody, UpdateSupplierQuotationBody, ListSupplierQuotationsResponse,
  CreateQuotationItemBody, UpdateQuotationItemBody, ListQuotationItemsResponse,
  CreatePurchaseOrderBody, UpdatePurchaseOrderBody, ListPurchaseOrdersResponse,
  CreatePurchaseOrderItemBody, UpdatePurchaseOrderItemBody, ListPurchaseOrderItemsResponse,
  CreatePurchaseContractBody, UpdatePurchaseContractBody, ListPurchaseContractsResponse,
  CreatePurchaseContractAmendmentBody, UpdatePurchaseContractAmendmentBody, ListPurchaseContractAmendmentsResponse,
  CreateGoodsReceiptNoteBody, UpdateGoodsReceiptNoteBody, ListGoodsReceiptNotesResponse,
  CreateGrnItemBody, UpdateGrnItemBody, ListGrnItemsResponse,
  CreatePurchaseReturnBody, UpdatePurchaseReturnBody, ListPurchaseReturnsResponse,
  CreatePurchaseReturnItemBody, UpdatePurchaseReturnItemBody, ListPurchaseReturnItemsResponse,
  CreateProcurementApprovalBody, UpdateProcurementApprovalBody, ListProcurementApprovalsResponse,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";
import { postAutomaticEntry, reverseAutomaticEntriesForSource, PostingError } from "../lib/posting";
import { assertAction, LifecycleError } from "../lib/lifecycle";
import { receiveAgainstOrder } from "../lib/procurement-match";
import { applySupplierScore } from "../lib/evaluation-score";

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
}

import { registerCrud, type CrudConfig as SharedCrudConfig, type Tx } from "../lib/register-crud";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Accounting stays owned by procurement. The shared factory only supplies the
 * transaction; what gets posted, and from which fields, is decided here.
 */
type CrudConfig = SharedCrudConfig & { financial?: FinancialConfig };

function financialHooks(cfg: CrudConfig) {
  const fin = cfg.financial;
  if (!fin) return {};
  return {
    inCreateTx: async (tx: Tx, created: Record<string, unknown>, req: import("express").Request) => {
      const amount = created[fin.amountField];
      if (typeof amount === "string" && amount.trim() !== "") {
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
      }
    },
    inDeleteTx: async (tx: Tx, _row: Record<string, unknown>, req: import("express").Request) => {
      await reverseAutomaticEntriesForSource(tx, cfg.entity, String(_row.id), req.authUser?.id ?? null);
    },
  };
}


const resources: CrudConfig[] = [
  // Supplier management
  { path: "supplier-categories", table: supplierCategoriesTable, module: "supplierCategories", entity: "supplierCategory",
    // Issued by the central sequence engine; the client cannot choose it.
    generatedCode: { documentType: "supplierCategory" },
    createBody: CreateSupplierCategoryBody, updateBody: UpdateSupplierCategoryBody, listResponse: ListSupplierCategorysResponse,
    search: ["code", "name", "nameAr"] },
  { path: "suppliers", table: suppliersTable, module: "suppliers", entity: "supplier",
    // Issued by the central sequence engine; the client cannot choose it.
    generatedCode: { documentType: "supplier" },
    createBody: CreateSupplierBody, updateBody: UpdateSupplierBody, listResponse: ListSuppliersResponse,
    search: ["code", "name", "nameAr", "email", "phone"] },
  { path: "supplier-contacts", table: supplierContactsTable, module: "supplierContacts", entity: "supplierContact",
    createBody: CreateSupplierContactBody, updateBody: UpdateSupplierContactBody, listResponse: ListSupplierContactsResponse,
    search: ["name", "email", "phone"] },
  { path: "supplier-evaluations", table: supplierEvaluationsTable, module: "supplierEvaluations", entity: "supplierEvaluation",
    generatedCode: { documentType: "supplierEvaluation" },
    createBody: CreateSupplierEvaluationBody, updateBody: UpdateSupplierEvaluationBody, listResponse: ListSupplierEvaluationsResponse,
    search: ["code", "period"],
    // The overall score is the weighted combination of the four criteria. It
    // is written only once the business has set the weighting; until then the
    // engine declines to produce a number nobody chose.
    hooks: {
      async inCreateTx(tx: Tx, row: Record<string, unknown>) {
        await applySupplierScore(tx, String(row.id));
      },
      async inUpdateTx(tx: Tx, updated: Record<string, unknown>) {
        await applySupplierScore(tx, String(updated.id));
      },
    } },
  // Purchase requests
  { path: "purchase-requests", table: purchaseRequestsTable, module: "purchaseRequests", entity: "purchaseRequest",
    generatedCode: { documentType: "purchaseRequest" },
    createBody: CreatePurchaseRequestBody, updateBody: UpdatePurchaseRequestBody, listResponse: ListPurchaseRequestsResponse,
    search: ["code", "title", "titleAr"] },
  { path: "purchase-request-items", table: purchaseRequestItemsTable, module: "purchaseRequestItems", entity: "purchaseRequestItem",
    createBody: CreatePurchaseRequestItemBody, updateBody: UpdatePurchaseRequestItemBody, listResponse: ListPurchaseRequestItemsResponse,
    search: ["itemCode", "description"] },
  // RFQ
  { path: "rfqs", table: rfqsTable, module: "rfqs", entity: "rfq",
    generatedCode: { documentType: "rfq" },
    createBody: CreateRfqBody, updateBody: UpdateRfqBody, listResponse: ListRfqsResponse,
    search: ["code", "title", "titleAr"] },
  { path: "rfq-items", table: rfqItemsTable, module: "rfqItems", entity: "rfqItem",
    createBody: CreateRfqItemBody, updateBody: UpdateRfqItemBody, listResponse: ListRfqItemsResponse,
    search: ["description"] },
  { path: "rfq-suppliers", table: rfqSuppliersTable, module: "rfqSuppliers", entity: "rfqSupplier",
    generatedCode: { documentType: "rfqSupplier" },
    createBody: CreateRfqSupplierBody, updateBody: UpdateRfqSupplierBody, listResponse: ListRfqSuppliersResponse,
    search: ["notes"] },
  // Supplier quotations
  { path: "supplier-quotations", table: supplierQuotationsTable, module: "supplierQuotations", entity: "supplierQuotation",
    generatedCode: { documentType: "supplierQuotation" },
    createBody: CreateSupplierQuotationBody, updateBody: UpdateSupplierQuotationBody, listResponse: ListSupplierQuotationsResponse,
    search: ["code", "quotationNumber"] },
  { path: "quotation-items", table: quotationItemsTable, module: "quotationItems", entity: "quotationItem",
    createBody: CreateQuotationItemBody, updateBody: UpdateQuotationItemBody, listResponse: ListQuotationItemsResponse,
    search: ["description"] },
  // Purchase orders
  { path: "purchase-orders", table: purchaseOrdersTable, module: "purchaseOrders", entity: "purchaseOrder",
    generatedCode: { documentType: "purchaseOrder" },
    createBody: CreatePurchaseOrderBody, updateBody: UpdatePurchaseOrderBody, listResponse: ListPurchaseOrdersResponse,
    search: ["code"] },
  { path: "purchase-order-items", table: purchaseOrderItemsTable, module: "purchaseOrderItems", entity: "purchaseOrderItem",
    createBody: CreatePurchaseOrderItemBody, updateBody: UpdatePurchaseOrderItemBody, listResponse: ListPurchaseOrderItemsResponse,
    search: ["description"] },
  // Purchase contracts
  { path: "purchase-contracts", table: purchaseContractsTable, module: "purchaseContracts", entity: "purchaseContract",
    generatedCode: { documentType: "purchaseContract" },
    createBody: CreatePurchaseContractBody, updateBody: UpdatePurchaseContractBody, listResponse: ListPurchaseContractsResponse,
    search: ["code", "title", "titleAr"] },
  { path: "purchase-contract-amendments", table: purchaseContractAmendmentsTable, module: "purchaseContractAmendments", entity: "purchaseContractAmendment",
    generatedCode: { documentType: "purchaseContractAmendment" },
    createBody: CreatePurchaseContractAmendmentBody, updateBody: UpdatePurchaseContractAmendmentBody, listResponse: ListPurchaseContractAmendmentsResponse,
    search: ["code", "amendmentNumber"] },
  // Goods receipt notes (financial: post on receipt)
  { path: "goods-receipt-notes", table: goodsReceiptNotesTable, module: "goodsReceiptNotes", entity: "goodsReceiptNote",
    generatedCode: { documentType: "goodsReceiptNote" },
    createBody: CreateGoodsReceiptNoteBody, updateBody: UpdateGoodsReceiptNoteBody, listResponse: ListGoodsReceiptNotesResponse,
    search: ["code"],
    financial: { eventKey: "procurement.goods_receipt", amountField: "totalAmount", dateField: "receiptDate" } },
  { path: "grn-items", table: grnItemsTable, module: "grnItems", entity: "grnItem",
    createBody: CreateGrnItemBody, updateBody: UpdateGrnItemBody, listResponse: ListGrnItemsResponse,
    search: ["description"] },
  // Purchase returns (financial: reverse-style on receipt)
  { path: "purchase-returns", table: purchaseReturnsTable, module: "purchaseReturns", entity: "purchaseReturn",
    generatedCode: { documentType: "purchaseReturn" },
    createBody: CreatePurchaseReturnBody, updateBody: UpdatePurchaseReturnBody, listResponse: ListPurchaseReturnsResponse,
    search: ["code"],
    financial: { eventKey: "procurement.purchase_return", amountField: "totalAmount", dateField: "returnDate" } },
  { path: "purchase-return-items", table: purchaseReturnItemsTable, module: "purchaseReturnItems", entity: "purchaseReturnItem",
    createBody: CreatePurchaseReturnItemBody, updateBody: UpdatePurchaseReturnItemBody, listResponse: ListPurchaseReturnItemsResponse,
    search: ["description"] },
  // Approval workflow
  { path: "procurement-approvals", table: procurementApprovalsTable, module: "procurementApprovals", entity: "procurementApproval",
    generatedCode: { documentType: "procurementApproval" },
    createBody: CreateProcurementApprovalBody, updateBody: UpdateProcurementApprovalBody, listResponse: ListProcurementApprovalsResponse,
    search: ["code", "approverName"] },
];

for (const cfg of resources) {
  const { financial, ...rest } = cfg;
  registerCrud(router, {
    ...rest,
    getOne: true,
    // The posted amount is immutable once it has driven a ledger entry.
    immutableFields: financial ? [financial.amountField] : undefined,
    hooks: financialHooks(cfg),
  });
}

/* ------------------------------------------------------------------ */
/* Procurement dashboard KPIs                                          */
/* ------------------------------------------------------------------ */

router.get("/procurement/dashboard", async (req, res): Promise<void> => {
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
    suppliersCount,
    activeSuppliers,
    openRfqs,
    pendingApprovals,
    pendingRequests,
    openPurchaseOrders,
    pendingReturns,
  ] = await Promise.all([
    countWhere(suppliersTable),
    countWhere(suppliersTable, eq(suppliersTable.status, "active")),
    countWhere(rfqsTable, ne(rfqsTable.status, "closed")),
    countWhere(procurementApprovalsTable, eq(procurementApprovalsTable.status, "pending")),
    countWhere(purchaseRequestsTable, ne(purchaseRequestsTable.status, "approved")),
    countWhere(purchaseOrdersTable, ne(purchaseOrdersTable.status, "completed")),
    countWhere(purchaseReturnsTable, ne(purchaseReturnsTable.status, "completed")),
  ]);

  const [purchaseVolume, totalContractValue] = await Promise.all([
    sumWhere(purchaseOrdersTable, purchaseOrdersTable.totalAmount),
    sumWhere(purchaseContractsTable, purchaseContractsTable.contractValue),
  ]);

  const poStatusConds: SQL[] = [eq(purchaseOrdersTable.isDeleted, false)];
  const poc = company(purchaseOrdersTable);
  if (poc) poStatusConds.push(poc);
  const purchaseOrdersByStatus = await db
    .select({ status: purchaseOrdersTable.status, count: sql<number>`count(*)::int` })
    .from(purchaseOrdersTable)
    .where(and(...poStatusConds))
    .groupBy(purchaseOrdersTable.status);

  const reqStatusConds: SQL[] = [eq(purchaseRequestsTable.isDeleted, false)];
  const prc = company(purchaseRequestsTable);
  if (prc) reqStatusConds.push(prc);
  const requestsByStatus = await db
    .select({ status: purchaseRequestsTable.status, count: sql<number>`count(*)::int` })
    .from(purchaseRequestsTable)
    .where(and(...reqStatusConds))
    .groupBy(purchaseRequestsTable.status);

  res.json({
    suppliersCount,
    activeSuppliers,
    openRfqs,
    pendingApprovals,
    pendingRequests,
    openPurchaseOrders,
    purchaseVolume,
    totalContractValue,
    pendingReturns,
    purchaseOrdersByStatus,
    requestsByStatus,
  });
});

/**
 * Accept a goods receipt note.
 *
 * Accepting is the moment the receipt counts against the order it fulfils:
 * the order's lines learn what has arrived, and the order itself becomes
 * partially or fully received. Until this runs a purchase order has no idea
 * anything was delivered, which is how one used to sit at "approved" with
 * every line already on the shelf.
 */
router.post(
  "/goods-receipt-notes/:id/accept",
  requirePermission("goodsReceiptNotes.accept", "goodsReceiptNotes.update"),
  async (req, res): Promise<void> => {
    const id = String(req.params.id);
    try {
      const result = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(goodsReceiptNotesTable)
          .where(and(eq(goodsReceiptNotesTable.id, id), eq(goodsReceiptNotesTable.isDeleted, false)))
          .for("update");
        if (!existing) throw new PostingError(404, "Goods receipt note not found");

        try {
          assertAction("goodsReceiptNote", String(existing.status), "accepted");
        } catch (err) {
          if (err instanceof LifecycleError) throw new PostingError(err.status, err.message);
          throw err;
        }

        // The order lines and the acceptance commit together: an accepted
        // receipt whose order never learned of it is the state this fixes.
        const matched = await receiveAgainstOrder(tx, id);
        const [updated] = await tx
          .update(goodsReceiptNotesTable)
          .set({ status: "accepted" })
          .where(eq(goodsReceiptNotesTable.id, id))
          .returning();

        return { existing, updated, ...matched };
      });

      await recordAudit(req, {
        action: "accept",
        entity: "goodsReceiptNote",
        entityId: id,
        oldValue: result.existing,
        newValue: {
          ...result.updated,
          linesUpdated: result.linesUpdated,
          ordersAdvanced: result.ordersAdvanced,
        },
      });
      res.json({
        id,
        status: "accepted",
        linesUpdated: result.linesUpdated,
        ordersAdvanced: result.ordersAdvanced,
      });
    } catch (err) {
      if (err instanceof PostingError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      throw err;
    }
  },
);

export default router;
