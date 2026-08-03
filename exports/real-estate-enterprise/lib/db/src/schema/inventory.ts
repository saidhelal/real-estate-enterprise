import {
  pgTable,
  uuid,
  text,
  boolean,
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

export const warehousesTable = pgTable("warehouses", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  branchId: uuid("branch_id"),
  warehouseType: text("warehouse_type"),
  address: text("address"),
  manager: text("manager"),
  phone: text("phone"),
  status: text("status").notNull().default("active"),
  ...audit,
});
export type WarehouseRow = typeof warehousesTable.$inferSelect;

export const warehouseLocationsTable = pgTable("warehouse_locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  warehouseId: uuid("warehouse_id"),
  zone: text("zone"),
  aisle: text("aisle"),
  rack: text("rack"),
  shelf: text("shelf"),
  bin: text("bin"),
  status: text("status").notNull().default("active"),
  ...audit,
});
export type WarehouseLocationRow = typeof warehouseLocationsTable.$inferSelect;

export const itemCategoriesTable = pgTable("item_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  parentId: uuid("parent_id"),
  description: text("description"),
  status: text("status").notNull().default("active"),
  ...audit,
});
export type ItemCategoryRow = typeof itemCategoriesTable.$inferSelect;

export const itemGroupsTable = pgTable("item_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  categoryId: uuid("category_id"),
  description: text("description"),
  status: text("status").notNull().default("active"),
  ...audit,
});
export type ItemGroupRow = typeof itemGroupsTable.$inferSelect;

export const unitsOfMeasureTable = pgTable("units_of_measure", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  symbol: text("symbol"),
  baseUnit: text("base_unit"),
  conversionFactor: numeric("conversion_factor"),
  status: text("status").notNull().default("active"),
  ...audit,
});
export type UnitOfMeasureRow = typeof unitsOfMeasureTable.$inferSelect;

export const inventoryItemsTable = pgTable("inventory_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  categoryId: uuid("category_id"),
  groupId: uuid("group_id"),
  uomId: uuid("uom_id"),
  itemType: text("item_type"),
  barcode: text("barcode"),
  costPrice: numeric("cost_price"),
  sellingPrice: numeric("selling_price"),
  valuationMethod: text("valuation_method"),
  reorderPoint: numeric("reorder_point"),
  minStock: numeric("min_stock"),
  maxStock: numeric("max_stock"),
  description: text("description"),
  status: text("status").notNull().default("active"),
  ...audit,
});
export type InventoryItemRow = typeof inventoryItemsTable.$inferSelect;

export const reorderLevelsTable = pgTable("reorder_levels", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  itemId: uuid("item_id"),
  warehouseId: uuid("warehouse_id"),
  minQuantity: numeric("min_quantity"),
  maxQuantity: numeric("max_quantity"),
  reorderQuantity: numeric("reorder_quantity"),
  reorderPoint: numeric("reorder_point"),
  leadTimeDays: numeric("lead_time_days"),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  ...audit,
});
export type ReorderLevelRow = typeof reorderLevelsTable.$inferSelect;

export const stockOpeningBalancesTable = pgTable("stock_opening_balances", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  itemId: uuid("item_id"),
  warehouseId: uuid("warehouse_id"),
  locationId: uuid("location_id"),
  balanceDate: date("balance_date"),
  quantity: numeric("quantity"),
  unitCost: numeric("unit_cost"),
  totalValue: numeric("total_value"),
  batchNumber: text("batch_number"),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  ...audit,
});
export type StockOpeningBalanceRow = typeof stockOpeningBalancesTable.$inferSelect;

export const goodsReceiptsTable = pgTable("goods_receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  receiptDate: date("receipt_date"),
  receiptType: text("receipt_type"),
  warehouseId: uuid("warehouse_id"),
  supplierId: uuid("supplier_id"),
  poId: uuid("po_id"),
  referenceNumber: text("reference_number"),
  totalValue: numeric("total_value"),
  status: text("status").notNull().default("draft"),
  receivedBy: text("received_by"),
  notes: text("notes"),
  ...audit,
});
export type GoodsReceiptRow = typeof goodsReceiptsTable.$inferSelect;

export const goodsReceiptItemsTable = pgTable("goods_receipt_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  receiptId: uuid("receipt_id"),
  itemId: uuid("item_id"),
  locationId: uuid("location_id"),
  quantity: numeric("quantity"),
  unitCost: numeric("unit_cost"),
  totalCost: numeric("total_cost"),
  batchNumber: text("batch_number"),
  expiryDate: date("expiry_date"),
  notes: text("notes"),
  ...audit,
});
export type GoodsReceiptItemRow = typeof goodsReceiptItemsTable.$inferSelect;

export const goodsIssuesTable = pgTable("goods_issues", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  issueDate: date("issue_date"),
  issueType: text("issue_type"),
  warehouseId: uuid("warehouse_id"),
  issuedTo: text("issued_to"),
  costCenter: text("cost_center"),
  totalValue: numeric("total_value"),
  status: text("status").notNull().default("draft"),
  issuedBy: text("issued_by"),
  notes: text("notes"),
  ...audit,
});
export type GoodsIssueRow = typeof goodsIssuesTable.$inferSelect;

export const goodsIssueItemsTable = pgTable("goods_issue_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  issueId: uuid("issue_id"),
  itemId: uuid("item_id"),
  locationId: uuid("location_id"),
  quantity: numeric("quantity"),
  unitCost: numeric("unit_cost"),
  totalCost: numeric("total_cost"),
  batchNumber: text("batch_number"),
  notes: text("notes"),
  ...audit,
});
export type GoodsIssueItemRow = typeof goodsIssueItemsTable.$inferSelect;

export const inventoryTransfersTable = pgTable("inventory_transfers", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  transferDate: date("transfer_date"),
  fromWarehouseId: uuid("from_warehouse_id"),
  toWarehouseId: uuid("to_warehouse_id"),
  transferType: text("transfer_type"),
  totalValue: numeric("total_value"),
  status: text("status").notNull().default("draft"),
  requestedBy: text("requested_by"),
  approvedBy: text("approved_by"),
  notes: text("notes"),
  ...audit,
});
export type InventoryTransferRow = typeof inventoryTransfersTable.$inferSelect;

export const inventoryTransferItemsTable = pgTable("inventory_transfer_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  transferId: uuid("transfer_id"),
  itemId: uuid("item_id"),
  fromLocationId: uuid("from_location_id"),
  toLocationId: uuid("to_location_id"),
  quantity: numeric("quantity"),
  unitCost: numeric("unit_cost"),
  totalCost: numeric("total_cost"),
  notes: text("notes"),
  ...audit,
});
export type InventoryTransferItemRow = typeof inventoryTransferItemsTable.$inferSelect;

export const stockAdjustmentsTable = pgTable("stock_adjustments", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  adjustmentDate: date("adjustment_date"),
  warehouseId: uuid("warehouse_id"),
  adjustmentType: text("adjustment_type"),
  reason: text("reason"),
  totalValue: numeric("total_value"),
  status: text("status").notNull().default("draft"),
  approvedBy: text("approved_by"),
  notes: text("notes"),
  ...audit,
});
export type StockAdjustmentRow = typeof stockAdjustmentsTable.$inferSelect;

export const stockAdjustmentItemsTable = pgTable("stock_adjustment_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  adjustmentId: uuid("adjustment_id"),
  itemId: uuid("item_id"),
  locationId: uuid("location_id"),
  systemQuantity: numeric("system_quantity"),
  actualQuantity: numeric("actual_quantity"),
  differenceQuantity: numeric("difference_quantity"),
  unitCost: numeric("unit_cost"),
  totalCost: numeric("total_cost"),
  notes: text("notes"),
  ...audit,
});
export type StockAdjustmentItemRow = typeof stockAdjustmentItemsTable.$inferSelect;

export const stockCountsTable = pgTable("stock_counts", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  countDate: date("count_date"),
  warehouseId: uuid("warehouse_id"),
  countType: text("count_type"),
  status: text("status").notNull().default("draft"),
  countedBy: text("counted_by"),
  supervisedBy: text("supervised_by"),
  notes: text("notes"),
  ...audit,
});
export type StockCountRow = typeof stockCountsTable.$inferSelect;

export const stockCountItemsTable = pgTable("stock_count_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  countId: uuid("count_id"),
  itemId: uuid("item_id"),
  locationId: uuid("location_id"),
  systemQuantity: numeric("system_quantity"),
  countedQuantity: numeric("counted_quantity"),
  varianceQuantity: numeric("variance_quantity"),
  unitCost: numeric("unit_cost"),
  varianceValue: numeric("variance_value"),
  notes: text("notes"),
  ...audit,
});
export type StockCountItemRow = typeof stockCountItemsTable.$inferSelect;

export const inventoryLedgerTable = pgTable("inventory_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  itemId: uuid("item_id"),
  warehouseId: uuid("warehouse_id"),
  locationId: uuid("location_id"),
  transactionDate: date("transaction_date"),
  transactionType: text("transaction_type"),
  referenceType: text("reference_type"),
  referenceNumber: text("reference_number"),
  quantityIn: numeric("quantity_in"),
  quantityOut: numeric("quantity_out"),
  balanceQuantity: numeric("balance_quantity"),
  unitCost: numeric("unit_cost"),
  balanceValue: numeric("balance_value"),
  notes: text("notes"),
  ...audit,
});
export type InventoryLedgerRow = typeof inventoryLedgerTable.$inferSelect;
