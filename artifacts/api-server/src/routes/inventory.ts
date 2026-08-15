import { Router, type IRouter } from "express";
import { and, eq, ne, or, ilike, sql, desc, type SQL } from "drizzle-orm";
import {
  db,
  warehousesTable,
  warehouseLocationsTable,
  itemCategoriesTable,
  itemGroupsTable,
  unitsOfMeasureTable,
  inventoryItemsTable,
  reorderLevelsTable,
  stockOpeningBalancesTable,
  goodsReceiptsTable,
  goodsReceiptItemsTable,
  goodsIssuesTable,
  goodsIssueItemsTable,
  inventoryTransfersTable,
  inventoryTransferItemsTable,
  stockAdjustmentsTable,
  stockAdjustmentItemsTable,
  stockCountsTable,
  stockCountItemsTable,
  inventoryLedgerTable,
} from "@workspace/db";
import {
  CreateWarehouseBody, UpdateWarehouseBody, ListWarehousesResponse,
  CreateWarehouseLocationBody, UpdateWarehouseLocationBody, ListWarehouseLocationsResponse,
  CreateItemCategoryBody, UpdateItemCategoryBody, ListItemCategorysResponse,
  CreateItemGroupBody, UpdateItemGroupBody, ListItemGroupsResponse,
  CreateUnitOfMeasureBody, UpdateUnitOfMeasureBody, ListUnitOfMeasuresResponse,
  CreateInventoryItemBody, UpdateInventoryItemBody, ListInventoryItemsResponse,
  CreateReorderLevelBody, UpdateReorderLevelBody, ListReorderLevelsResponse,
  CreateStockOpeningBalanceBody, UpdateStockOpeningBalanceBody, ListStockOpeningBalancesResponse,
  CreateGoodsReceiptBody, UpdateGoodsReceiptBody, ListGoodsReceiptsResponse,
  CreateGoodsReceiptItemBody, UpdateGoodsReceiptItemBody, ListGoodsReceiptItemsResponse,
  CreateGoodsIssueBody, UpdateGoodsIssueBody, ListGoodsIssuesResponse,
  CreateGoodsIssueItemBody, UpdateGoodsIssueItemBody, ListGoodsIssueItemsResponse,
  CreateInventoryTransferBody, UpdateInventoryTransferBody, ListInventoryTransfersResponse,
  CreateInventoryTransferItemBody, UpdateInventoryTransferItemBody, ListInventoryTransferItemsResponse,
  CreateStockAdjustmentBody, UpdateStockAdjustmentBody, ListStockAdjustmentsResponse,
  CreateStockAdjustmentItemBody, UpdateStockAdjustmentItemBody, ListStockAdjustmentItemsResponse,
  CreateStockCountBody, UpdateStockCountBody, ListStockCountsResponse,
  CreateStockCountItemBody, UpdateStockCountItemBody, ListStockCountItemsResponse,
  CreateInventoryLedgerBody, UpdateInventoryLedgerBody, ListInventoryLedgersResponse,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { assertAction, LifecycleError } from "../lib/lifecycle";
import { PostingError } from "../lib/posting";
import {
  postGoodsReceipt,
  postGoodsIssue,
  postInventoryTransfer,
  postStockAdjustment,
  onHand,
  inventoryValue,
} from "../lib/stock";
import { requireAuth, requirePermission } from "../middleware/auth";
import { postAutomaticEntry, reverseAutomaticEntriesForSource } from "../lib/posting";

const router: IRouter = Router();
router.use(requireAuth);

/**
 * Optional accounting integration for money-moving resources. On create, post an
 * automatic journal entry (best-effort: skips cleanly when the company has no
 * account_mappings for the event key). On delete, reverse any automatic entries
 * for the source. Idempotent per (sourceType, sourceId).
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
 * Accounting stays owned by inventory. The shared factory only supplies the
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
  // Master data
  { path: "warehouses", table: warehousesTable, module: "warehouses", entity: "warehouse",
    createBody: CreateWarehouseBody, updateBody: UpdateWarehouseBody, listResponse: ListWarehousesResponse,
    search: ["code", "name", "nameAr"] },
  { path: "warehouse-locations", table: warehouseLocationsTable, module: "warehouseLocations", entity: "warehouseLocation",
    createBody: CreateWarehouseLocationBody, updateBody: UpdateWarehouseLocationBody, listResponse: ListWarehouseLocationsResponse,
    search: ["code", "name", "nameAr"] },
  { path: "item-categories", table: itemCategoriesTable, module: "itemCategories", entity: "itemCategory",
    // Issued by the central sequence engine; the client cannot choose it.
    generatedCode: { documentType: "itemCategory" },
    createBody: CreateItemCategoryBody, updateBody: UpdateItemCategoryBody, listResponse: ListItemCategorysResponse,
    search: ["code", "name", "nameAr"] },
  { path: "item-groups", table: itemGroupsTable, module: "itemGroups", entity: "itemGroup",
    // Issued by the central sequence engine; the client cannot choose it.
    generatedCode: { documentType: "itemGroup" },
    createBody: CreateItemGroupBody, updateBody: UpdateItemGroupBody, listResponse: ListItemGroupsResponse,
    search: ["code", "name", "nameAr"] },
  { path: "units-of-measure", table: unitsOfMeasureTable, module: "unitsOfMeasure", entity: "unitOfMeasure",
    createBody: CreateUnitOfMeasureBody, updateBody: UpdateUnitOfMeasureBody, listResponse: ListUnitOfMeasuresResponse,
    search: ["code", "name", "nameAr"] },
  { path: "inventory-items", table: inventoryItemsTable, module: "inventoryItems", entity: "inventoryItem",
    createBody: CreateInventoryItemBody, updateBody: UpdateInventoryItemBody, listResponse: ListInventoryItemsResponse,
    search: ["code", "name", "nameAr", "barcode"] },
  { path: "reorder-levels", table: reorderLevelsTable, module: "reorderLevels", entity: "reorderLevel",
    createBody: CreateReorderLevelBody, updateBody: UpdateReorderLevelBody, listResponse: ListReorderLevelsResponse,
    search: [] },
  // Transactions
  { path: "stock-opening-balances", table: stockOpeningBalancesTable, module: "stockOpeningBalances", entity: "stockOpeningBalance",
    generatedCode: { documentType: "stockOpeningBalance" },
    createBody: CreateStockOpeningBalanceBody, updateBody: UpdateStockOpeningBalanceBody, listResponse: ListStockOpeningBalancesResponse,
    search: ["code", "batchNumber"] },
  // Goods receipts (financial: post on receipt)
  { path: "goods-receipts", table: goodsReceiptsTable, module: "goodsReceipts", entity: "goodsReceipt",
    generatedCode: { documentType: "goodsReceipt" },
    createBody: CreateGoodsReceiptBody, updateBody: UpdateGoodsReceiptBody, listResponse: ListGoodsReceiptsResponse,
    search: ["code", "referenceNumber"],
    financial: { eventKey: "inventory.goods_receipt", amountField: "totalValue", dateField: "receiptDate" } },
  { path: "goods-receipt-items", table: goodsReceiptItemsTable, module: "goodsReceiptItems", entity: "goodsReceiptItem",
    createBody: CreateGoodsReceiptItemBody, updateBody: UpdateGoodsReceiptItemBody, listResponse: ListGoodsReceiptItemsResponse,
    search: ["batchNumber"] },
  // Goods issues (financial: post on issue)
  { path: "goods-issues", table: goodsIssuesTable, module: "goodsIssues", entity: "goodsIssue",
    generatedCode: { documentType: "goodsIssue" },
    createBody: CreateGoodsIssueBody, updateBody: UpdateGoodsIssueBody, listResponse: ListGoodsIssuesResponse,
    search: ["code"],
    financial: { eventKey: "inventory.goods_issue", amountField: "totalValue", dateField: "issueDate" } },
  { path: "goods-issue-items", table: goodsIssueItemsTable, module: "goodsIssueItems", entity: "goodsIssueItem",
    createBody: CreateGoodsIssueItemBody, updateBody: UpdateGoodsIssueItemBody, listResponse: ListGoodsIssueItemsResponse,
    search: ["batchNumber"] },
  // Transfers
  { path: "inventory-transfers", table: inventoryTransfersTable, module: "inventoryTransfers", entity: "inventoryTransfer",
    generatedCode: { documentType: "inventoryTransfer" },
    createBody: CreateInventoryTransferBody, updateBody: UpdateInventoryTransferBody, listResponse: ListInventoryTransfersResponse,
    search: ["code"] },
  { path: "inventory-transfer-items", table: inventoryTransferItemsTable, module: "inventoryTransferItems", entity: "inventoryTransferItem",
    createBody: CreateInventoryTransferItemBody, updateBody: UpdateInventoryTransferItemBody, listResponse: ListInventoryTransferItemsResponse,
    search: [] },
  // Adjustments (financial: post on adjustment)
  { path: "stock-adjustments", table: stockAdjustmentsTable, module: "stockAdjustments", entity: "stockAdjustment",
    generatedCode: { documentType: "stockAdjustment" },
    createBody: CreateStockAdjustmentBody, updateBody: UpdateStockAdjustmentBody, listResponse: ListStockAdjustmentsResponse,
    search: ["code", "reason"],
    financial: { eventKey: "inventory.stock_adjustment", amountField: "totalValue", dateField: "adjustmentDate" } },
  { path: "stock-adjustment-items", table: stockAdjustmentItemsTable, module: "stockAdjustmentItems", entity: "stockAdjustmentItem",
    createBody: CreateStockAdjustmentItemBody, updateBody: UpdateStockAdjustmentItemBody, listResponse: ListStockAdjustmentItemsResponse,
    search: [] },
  // Stock counts
  { path: "stock-counts", table: stockCountsTable, module: "stockCounts", entity: "stockCount",
    generatedCode: { documentType: "stockCount" },
    createBody: CreateStockCountBody, updateBody: UpdateStockCountBody, listResponse: ListStockCountsResponse,
    search: ["code"] },
  { path: "stock-count-items", table: stockCountItemsTable, module: "stockCountItems", entity: "stockCountItem",
    createBody: CreateStockCountItemBody, updateBody: UpdateStockCountItemBody, listResponse: ListStockCountItemsResponse,
    search: [] },
  // Ledger
  { path: "inventory-ledger", table: inventoryLedgerTable, module: "inventoryLedger", entity: "inventoryLedger",
    generatedCode: { documentType: "inventoryLedger" },
    createBody: CreateInventoryLedgerBody, updateBody: UpdateInventoryLedgerBody, listResponse: ListInventoryLedgersResponse,
    search: ["referenceNumber", "referenceType"] },
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
/* Inventory dashboard KPIs                                            */
/* ------------------------------------------------------------------ */

router.get("/inventory/dashboard", async (req, res): Promise<void> => {
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
  const sumWhere = async (t: any, col: any, extra?: SQL): Promise<number> => {
    const conds: SQL[] = [eq(t.isDeleted, false)];
    const c = company(t);
    if (c) conds.push(c);
    if (extra) conds.push(extra);
    const [{ total }] = await db
      .select({ total: sql<string>`coalesce(sum(${col}), 0)::text` })
      .from(t)
      .where(and(...conds));
    return Number(total);
  };

  const [
    itemsCount,
    activeItems,
    warehousesCount,
    pendingReceipts,
    pendingIssues,
    pendingTransfers,
    pendingAdjustments,
  ] = await Promise.all([
    countWhere(inventoryItemsTable),
    countWhere(inventoryItemsTable, eq(inventoryItemsTable.status, "active")),
    countWhere(warehousesTable),
    countWhere(goodsReceiptsTable, ne(goodsReceiptsTable.status, "completed")),
    countWhere(goodsIssuesTable, ne(goodsIssuesTable.status, "completed")),
    countWhere(inventoryTransfersTable, ne(inventoryTransfersTable.status, "completed")),
    countWhere(stockAdjustmentsTable, ne(stockAdjustmentsTable.status, "completed")),
  ]);

  // Stock value comes from the valuation engine, which is the only thing
  // that decides what stock is worth. This screen used to add up document
  // headers instead — opening + receipts - issues — and said so by calling
  // itself approximate: it counted a receipt that was never posted, and
  // ignored transfers and adjustments entirely.
  const totalStockValue = (await inventoryValue(db, companyId ?? null)).toFixed(2);

  // Low-stock: reorder rules whose min quantity exceeds the item's net ledger
  // balance (sum of quantity in - quantity out) for that item + warehouse.
  const rlConds: SQL[] = [eq(reorderLevelsTable.isDeleted, false)];
  const rlc = company(reorderLevelsTable);
  if (rlc) rlConds.push(rlc);
  const reorderRules = await db
    .select({
      companyId: reorderLevelsTable.companyId,
      itemId: reorderLevelsTable.itemId,
      warehouseId: reorderLevelsTable.warehouseId,
      minQuantity: reorderLevelsTable.minQuantity,
    })
    .from(reorderLevelsTable)
    .where(and(...rlConds));

  let lowStockItems = 0;
  for (const rl of reorderRules) {
    if (!rl.itemId || !rl.warehouseId || !rl.companyId) continue;
    // `onHand` is the one definition of how much stock there is. This screen
    // used to compute it inline, which is why the figure existed here and
    // nowhere else — including in the code that must refuse an over-issue.
    const balance = await onHand(db, rl.companyId, rl.itemId, rl.warehouseId);
    if (Number(rl.minQuantity ?? 0) > balance) lowStockItems++;
  }

  const rcConds: SQL[] = [eq(goodsReceiptsTable.isDeleted, false)];
  const rcc = company(goodsReceiptsTable);
  if (rcc) rcConds.push(rcc);
  const receiptsByStatus = await db
    .select({ status: goodsReceiptsTable.status, count: sql<number>`count(*)::int` })
    .from(goodsReceiptsTable)
    .where(and(...rcConds))
    .groupBy(goodsReceiptsTable.status);

  const isConds: SQL[] = [eq(goodsIssuesTable.isDeleted, false)];
  const isc = company(goodsIssuesTable);
  if (isc) isConds.push(isc);
  const issuesByStatus = await db
    .select({ status: goodsIssuesTable.status, count: sql<number>`count(*)::int` })
    .from(goodsIssuesTable)
    .where(and(...isConds))
    .groupBy(goodsIssuesTable.status);

  res.json({
    itemsCount,
    activeItems,
    warehousesCount,
    lowStockItems,
    totalStockValue,
    pendingReceipts,
    pendingIssues,
    pendingTransfers,
    pendingAdjustments,
    receiptsByStatus,
    issuesByStatus,
  });
});

/* ------------------------------------------------------------------ */
/* Posting: the act that actually moves stock                          */
/* ------------------------------------------------------------------ */

/**
 * The four documents that move stock, and how each one moves it.
 *
 * They differ only in which table holds the document and which function reads
 * its lines — the transaction, the lifecycle guard, the status flip and the
 * audit trail are identical, so they are written once. Writing them four times
 * is how three of the four end up missing a guard nobody notices for a year.
 */
const POSTABLE = [
  {
    segment: "goods-receipts",
    module: "goodsReceipts",
    entity: "goodsReceipt",
    documentType: "goodsReceipt",
    table: goodsReceiptsTable,
    post: postGoodsReceipt,
  },
  {
    segment: "goods-issues",
    module: "goodsIssues",
    entity: "goodsIssue",
    documentType: "goodsIssue",
    table: goodsIssuesTable,
    post: postGoodsIssue,
  },
  {
    segment: "inventory-transfers",
    module: "inventoryTransfers",
    entity: "inventoryTransfer",
    documentType: "inventoryTransfer",
    table: inventoryTransfersTable,
    post: postInventoryTransfer,
  },
  {
    segment: "stock-adjustments",
    module: "stockAdjustments",
    entity: "stockAdjustment",
    documentType: "stockAdjustment",
    table: stockAdjustmentsTable,
    post: postStockAdjustment,
  },
] as const;

for (const doc of POSTABLE) {
  router.post(
    `/${doc.segment}/:id/post`,
    // Posting is a distinct authority from editing a draft: writing a
    // warehouse movement is not the same act as correcting a typo on one.
    requirePermission(`${doc.module}.post`, `${doc.module}.update`),
    async (req, res): Promise<void> => {
      const id = String(req.params.id);
      try {
        const result = await db.transaction(async (tx) => {
          const [existing] = await tx
            .select()
            .from(doc.table)
            .where(and(eq(doc.table.id, id), eq(doc.table.isDeleted, false)))
            .for("update");
          if (!existing) throw new PostingError(404, `${doc.entity} not found`);

          // The lifecycle refuses a second posting, and every other state it
          // knows — a cancelled document cannot be posted either.
          try {
            assertAction(doc.documentType, String(existing.status), "posted");
          } catch (err) {
            if (err instanceof LifecycleError) throw new PostingError(err.status, err.message);
            throw err;
          }

          // The movements and the status flip commit together: a posted
          // document with no movements, or movements with no posted document,
          // is a stock figure that disagrees with the paperwork.
          const { movements } = await doc.post(tx, id);
          const [updated] = await tx
            .update(doc.table)
            .set({ status: "posted" })
            .where(eq(doc.table.id, id))
            .returning();

          return { existing, updated, movements };
        });

        await recordAudit(req, {
          action: "post",
          entity: doc.entity,
          entityId: id,
          oldValue: result.existing,
          newValue: { ...result.updated, movements: result.movements },
        });
        res.json({ id, status: "posted", movements: result.movements });
      } catch (err) {
        if (err instanceof PostingError) {
          res.status(err.status).json({ error: err.message });
          return;
        }
        throw err;
      }
    },
  );
}

export default router;
