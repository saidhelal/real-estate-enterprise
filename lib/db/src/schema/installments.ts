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

export const installmentPlansTable = pgTable("installment_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  contractId: uuid("contract_id").notNull(),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  downPayment: numeric("down_payment", { precision: 14, scale: 2 }),
  numberOfInstallments: integer("number_of_installments").notNull().default(1),
  frequency: text("frequency").notNull().default("monthly"),
  startDate: date("start_date").notNull(),
  status: text("status").notNull().default("active"),
  ...audit,
});
export type InstallmentPlanRow = typeof installmentPlansTable.$inferSelect;

export const installmentSchedulesTable = pgTable("installment_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  planId: uuid("plan_id").notNull(),
  installmentNumber: integer("installment_number").notNull().default(1),
  dueDate: date("due_date").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
  paidAmount: numeric("paid_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("pending"),
  ...audit,
});
export type InstallmentScheduleRow = typeof installmentSchedulesTable.$inferSelect;

export const installmentCollectionsTable = pgTable("installment_collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  scheduleId: uuid("schedule_id").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
  collectionDate: date("collection_date").notNull(),
  method: text("method").notNull().default("cash"),
  reference: text("reference"),
  userId: uuid("user_id"),
  ...audit,
});
export type InstallmentCollectionRow = typeof installmentCollectionsTable.$inferSelect;

export const penaltyRulesTable = pgTable("penalty_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  daysAfterDue: integer("days_after_due").notNull().default(0),
  penaltyType: text("penalty_type").notNull().default("fixed"),
  penaltyValue: numeric("penalty_value", { precision: 14, scale: 2 }).notNull().default("0"),
  ...audit,
});
export type PenaltyRuleRow = typeof penaltyRulesTable.$inferSelect;
