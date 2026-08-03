import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const companiesTable = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  taxNumber: text("tax_number"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  baseCurrency: text("base_currency"),
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type CompanyRow = typeof companiesTable.$inferSelect;
