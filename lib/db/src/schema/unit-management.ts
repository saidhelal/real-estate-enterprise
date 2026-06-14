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

export const unitPriceListsTable = pgTable("unit_price_lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  projectId: uuid("project_id"),
  effectiveFrom: date("effective_from"),
  effectiveTo: date("effective_to"),
  ...audit,
});
export type UnitPriceListRow = typeof unitPriceListsTable.$inferSelect;

export const unitPricingTable = pgTable("unit_pricing", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  priceListId: uuid("price_list_id").notNull(),
  unitId: uuid("unit_id").notNull(),
  price: numeric("price", { precision: 14, scale: 2 }).notNull().default("0"),
  effectiveDate: date("effective_date"),
  ...audit,
});
export type UnitPricingRow = typeof unitPricingTable.$inferSelect;

export const unitDiscountsTable = pgTable("unit_discounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  discountType: text("discount_type").notNull().default("percentage"),
  discountValue: numeric("discount_value", { precision: 14, scale: 2 }).notNull().default("0"),
  validFrom: date("valid_from"),
  validTo: date("valid_to"),
  ...audit,
});
export type UnitDiscountRow = typeof unitDiscountsTable.$inferSelect;
