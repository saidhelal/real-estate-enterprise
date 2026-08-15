import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

const audit = {
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// ===================== master data: lookup types =====================
// Registry of reference-data categories (e.g. payment methods, lead statuses,
// account types). One generic store serves every category and any future one.
// `code` is a stable, globally-unique machine key. `isSystem` marks categories
// migrated from the central label registry (cannot be deleted from the UI).
// `companyId` is null for global categories or set for company-scoped lists.
export const lookupTypesTable = pgTable("lookup_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull().unique(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  description: text("description"),
  module: text("module"),
  sortOrder: integer("sort_order").notNull().default(0),
  isSystem: boolean("is_system").notNull().default(false),
  metadata: jsonb("metadata"),
  ...audit,
});
export type LookupTypeRow = typeof lookupTypesTable.$inferSelect;

// ===================== master data: lookup values =====================
// The individual options for each lookup type. `code` is the stored machine
// value (kept identical to the existing snake_case enum codes for backward
// compatibility) and is unique within its type. `labelEn`/`labelAr` drive the
// bilingual display. `parentId` enables hierarchy (self reference, null at the
// root). `metadata` JSONB carries extras (e.g. bank SWIFT). `isArchived` hides
// a value from selection without deleting it; `isSystem` marks seeded values.
export const lookupValuesTable = pgTable(
  "lookup_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    typeId: uuid("type_id")
      .notNull()
      .references(() => lookupTypesTable.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").references(() => companiesTable.id, { onDelete: "restrict" }),
    parentId: uuid("parent_id"),
    code: text("code").notNull(),
    labelEn: text("label_en").notNull(),
    labelAr: text("label_ar").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    isArchived: boolean("is_archived").notNull().default(false),
    isSystem: boolean("is_system").notNull().default(false),
    metadata: jsonb("metadata"),
    ...audit,
  },
  (t) => ({
    typeCodeUq: uniqueIndex("lookup_values_type_code_uq").on(t.typeId, t.code),
  }),
);
export type LookupValueRow = typeof lookupValuesTable.$inferSelect;
