import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
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

export const unitTypesTable = pgTable("unit_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  description: text("description"),
  ...audit,
});
export type UnitTypeRow = typeof unitTypesTable.$inferSelect;

export const unitStatusesTable = pgTable("unit_statuses", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  color: text("color"),
  ...audit,
});
export type UnitStatusRow = typeof unitStatusesTable.$inferSelect;

export const projectsTable = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  branchId: uuid("branch_id"),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  description: text("description"),
  location: text("location"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  status: text("status").notNull().default("planning"),
  ...audit,
});
export type ProjectRow = typeof projectsTable.$inferSelect;

export const phasesTable = pgTable("phases", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  projectId: uuid("project_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  status: text("status").notNull().default("planning"),
  ...audit,
});
export type PhaseRow = typeof phasesTable.$inferSelect;

export const buildingsTable = pgTable("buildings", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  projectId: uuid("project_id").notNull(),
  phaseId: uuid("phase_id"),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  floorsCount: integer("floors_count").notNull().default(0),
  ...audit,
});
export type BuildingRow = typeof buildingsTable.$inferSelect;

export const floorsTable = pgTable("floors", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  projectId: uuid("project_id"),
  phaseId: uuid("phase_id"),
  buildingId: uuid("building_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  floorNumber: integer("floor_number").notNull().default(0),
  ...audit,
});
export type FloorRow = typeof floorsTable.$inferSelect;

export const unitsTable = pgTable("units", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  branchId: uuid("branch_id"),
  projectId: uuid("project_id").notNull(),
  phaseId: uuid("phase_id"),
  buildingId: uuid("building_id").notNull(),
  floorId: uuid("floor_id").notNull(),
  unitTypeId: uuid("unit_type_id"),
  unitStatusId: uuid("unit_status_id"),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  area: numeric("area", { precision: 12, scale: 2 }),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  basePrice: numeric("base_price", { precision: 14, scale: 2 }),
  pricePerMeter: numeric("price_per_meter", { precision: 14, scale: 2 }),
  totalPrice: numeric("total_price", { precision: 14, scale: 2 }),
  discount: numeric("discount", { precision: 14, scale: 2 }),
  maxDiscount: numeric("max_discount", { precision: 14, scale: 2 }),
  minSellingPrice: numeric("min_selling_price", { precision: 14, scale: 2 }),
  commission: numeric("commission", { precision: 14, scale: 2 }),
  taxes: numeric("taxes", { precision: 14, scale: 2 }),
  salesAvailable: boolean("sales_available").notNull().default(false),
  paymentOption: text("payment_option"),
  collectionMethod: text("collection_method"),
  ...audit,
});
export type UnitRow = typeof unitsTable.$inferSelect;
