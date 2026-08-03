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

// Asset categories with default depreciation policy and COA account mapping.
export const assetCategoriesTable = pgTable("asset_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  usefulLifeYears: numeric("useful_life_years", { precision: 6, scale: 2 }).notNull().default("0"),
  depreciationMethod: text("depreciation_method").notNull().default("straight_line"),
  depreciationRate: numeric("depreciation_rate", { precision: 8, scale: 4 }).notNull().default("0"),
  assetAccountId: uuid("asset_account_id"),
  depreciationAccountId: uuid("depreciation_account_id"),
  expenseAccountId: uuid("expense_account_id"),
  notes: text("notes"),
  ...audit,
});
export type AssetCategoryRow = typeof assetCategoriesTable.$inferSelect;

// Fixed assets register.
export const fixedAssetsTable = pgTable("fixed_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  categoryId: uuid("category_id").notNull(),
  branchId: uuid("branch_id"),
  costCenterId: uuid("cost_center_id"),
  acquisitionDate: date("acquisition_date"),
  acquisitionCost: numeric("acquisition_cost", { precision: 16, scale: 2 }).notNull().default("0"),
  salvageValue: numeric("salvage_value", { precision: 16, scale: 2 }).notNull().default("0"),
  usefulLifeYears: numeric("useful_life_years", { precision: 6, scale: 2 }).notNull().default("0"),
  depreciationMethod: text("depreciation_method").notNull().default("straight_line"),
  accumulatedDepreciation: numeric("accumulated_depreciation", { precision: 16, scale: 2 }).notNull().default("0"),
  bookValue: numeric("book_value", { precision: 16, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("active"),
  location: text("location"),
  locationAr: text("location_ar"),
  serialNo: text("serial_no"),
  notes: text("notes"),
  ...audit,
});
export type FixedAssetRow = typeof fixedAssetsTable.$inferSelect;

// Transfers of an asset between branches / cost centers.
export const assetTransfersTable = pgTable("asset_transfers", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  assetId: uuid("asset_id").notNull(),
  fromBranchId: uuid("from_branch_id"),
  toBranchId: uuid("to_branch_id"),
  fromCostCenterId: uuid("from_cost_center_id"),
  toCostCenterId: uuid("to_cost_center_id"),
  transferDate: date("transfer_date"),
  reason: text("reason"),
  reasonAr: text("reason_ar"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  ...audit,
});
export type AssetTransferRow = typeof assetTransfersTable.$inferSelect;

// Depreciation entries posted (or drafted) per asset per period.
export const assetDepreciationsTable = pgTable("asset_depreciations", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  assetId: uuid("asset_id").notNull(),
  periodDate: date("period_date"),
  amount: numeric("amount", { precision: 16, scale: 2 }).notNull().default("0"),
  method: text("method"),
  accumulatedAfter: numeric("accumulated_after", { precision: 16, scale: 2 }).notNull().default("0"),
  bookValueAfter: numeric("book_value_after", { precision: 16, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  ...audit,
});
export type AssetDepreciationRow = typeof assetDepreciationsTable.$inferSelect;

// Physical inventory count lines per asset.
export const assetInventoryCountsTable = pgTable("asset_inventory_counts", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  assetId: uuid("asset_id"),
  branchId: uuid("branch_id"),
  countDate: date("count_date"),
  status: text("status").notNull().default("found"),
  location: text("location"),
  countedBy: text("counted_by"),
  notes: text("notes"),
  ...audit,
});
export type AssetInventoryCountRow = typeof assetInventoryCountsTable.$inferSelect;

// Asset disposals (sale/scrap/donation/write-off) with gain/loss.
export const assetDisposalsTable = pgTable("asset_disposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  assetId: uuid("asset_id").notNull(),
  disposalDate: date("disposal_date"),
  disposalType: text("disposal_type").notNull().default("sale"),
  proceeds: numeric("proceeds", { precision: 16, scale: 2 }).notNull().default("0"),
  bookValueAtDisposal: numeric("book_value_at_disposal", { precision: 16, scale: 2 }).notNull().default("0"),
  gainLoss: numeric("gain_loss", { precision: 16, scale: 2 }).notNull().default("0"),
  buyerName: text("buyer_name"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  ...audit,
});
export type AssetDisposalRow = typeof assetDisposalsTable.$inferSelect;
