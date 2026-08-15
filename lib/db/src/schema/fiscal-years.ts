import { pgTable, uuid, text, boolean, date, timestamp } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const fiscalYearsTable = pgTable("fiscal_years", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companiesTable.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  status: text("status").notNull().default("open"),
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type FiscalYearRow = typeof fiscalYearsTable.$inferSelect;
