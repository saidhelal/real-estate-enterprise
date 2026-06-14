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

export const reservationsTable = pgTable("reservations", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  branchId: uuid("branch_id"),
  code: text("code").notNull(),
  unitId: uuid("unit_id").notNull(),
  customerId: uuid("customer_id").notNull(),
  reservationDate: date("reservation_date").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  ...audit,
});
export type ReservationRow = typeof reservationsTable.$inferSelect;

export const reservationPaymentsTable = pgTable("reservation_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  reservationId: uuid("reservation_id").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
  paymentDate: date("payment_date").notNull(),
  method: text("method").notNull().default("cash"),
  reference: text("reference"),
  notes: text("notes"),
  ...audit,
});
export type ReservationPaymentRow = typeof reservationPaymentsTable.$inferSelect;

export const contractsTable = pgTable("contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  branchId: uuid("branch_id"),
  code: text("code").notNull(),
  reservationId: uuid("reservation_id"),
  unitId: uuid("unit_id").notNull(),
  customerId: uuid("customer_id").notNull(),
  contractDate: date("contract_date").notNull(),
  totalPrice: numeric("total_price", { precision: 14, scale: 2 }).notNull().default("0"),
  downPayment: numeric("down_payment", { precision: 14, scale: 2 }),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  ...audit,
});
export type ContractRow = typeof contractsTable.$inferSelect;

export const contractAmendmentsTable = pgTable("contract_amendments", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  contractId: uuid("contract_id").notNull(),
  code: text("code"),
  amendmentDate: date("amendment_date").notNull(),
  description: text("description").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  userId: uuid("user_id"),
  ...audit,
});
export type ContractAmendmentRow = typeof contractAmendmentsTable.$inferSelect;

export const contractCancellationsTable = pgTable("contract_cancellations", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  contractId: uuid("contract_id").notNull(),
  cancellationDate: date("cancellation_date").notNull(),
  reason: text("reason"),
  refundAmount: numeric("refund_amount", { precision: 14, scale: 2 }),
  penaltyAmount: numeric("penalty_amount", { precision: 14, scale: 2 }),
  userId: uuid("user_id"),
  ...audit,
});
export type ContractCancellationRow = typeof contractCancellationsTable.$inferSelect;

export const unitTransfersTable = pgTable("unit_transfers", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  contractId: uuid("contract_id").notNull(),
  fromUnitId: uuid("from_unit_id").notNull(),
  toUnitId: uuid("to_unit_id").notNull(),
  transferDate: date("transfer_date").notNull(),
  reason: text("reason"),
  priceDifference: numeric("price_difference", { precision: 14, scale: 2 }),
  userId: uuid("user_id"),
  ...audit,
});
export type UnitTransferRow = typeof unitTransfersTable.$inferSelect;
