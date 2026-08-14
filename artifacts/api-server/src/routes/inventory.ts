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

  // Approximate on-hand stock value: opening balances + receipts - issues.
  const [openingValue, receiptValue, issueValue] = await Promise.all([
    sumWhere(stockOpeningBalancesTable, stockOpeningBalancesTable.totalValue),
    sumWhere(goodsReceiptsTable, goodsReceiptsTable.totalValue),
    sumWhere(goodsIssuesTable, goodsIssuesTable.totalValue),
  ]);
  const totalStockValue = (openingValue + receiptValue - issueValue).toFixed(2);

  // Low-stock: reorder rules whose min quantity exceeds the item's net ledger
  // balance (sum of quantity in - quantity out) for that item + warehouse.
  const rlConds: SQL[] = [eq(reorderLevelsTable.isDeleted, false)];
  const rlc = company(reorderLevelsTable);
  if (rlc) rlConds.push(rlc);
  const reorderRules = await db
    .select({
      itemId: reorderLevelsTable.itemId,
      warehouseId: reorderLevelsTable.warehouseId,
      minQuantity: reorderLevelsTable.minQuantity,
    })
    .from(reorderLevelsTable)
    .where(and(...rlConds));

  let lowStockItems = 0;
  for (const rl of reorderRules) {
    if (!rl.itemId || !rl.warehouseId) continue;
    const ledgerConds: SQL[] = [
      eq(inventoryLedgerTable.isDeleted, false),
      eq(inventoryLedgerTable.itemId, rl.itemId),
      eq(inventoryLedgerTable.warehouseId, rl.warehouseId),
    ];
    const [{ bal }] = await db
      .select({
        bal: sql<string>`coalesce(sum(coalesce(${inventoryLedgerTable.quantityIn}, 0) - coalesce(${inventoryLedgerTable.quantityOut}, 0)), 0)::text`,
      })
      .from(inventoryLedgerTable)
      .where(and(...ledgerConds));
    if (Number(rl.minQuantity ?? 0) > Number(bal)) lowStockItems++;
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

export default router;
