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

export const cashboxesTable = pgTable("cashboxes", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  branchId: uuid("branch_id"),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  openingBalance: numeric("opening_balance", { precision: 14, scale: 2 }).notNull().default("0"),
  currentBalance: numeric("current_balance", { precision: 14, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  ...audit,
});
export type CashboxRow = typeof cashboxesTable.$inferSelect;

export const treasuryTransactionsTable = pgTable("treasury_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  cashboxId: uuid("cashbox_id").notNull(),
  type: text("type").notNull().default("in"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
  transactionDate: date("transaction_date").notNull(),
  reference: text("reference"),
  description: text("description"),
  receiptId: uuid("receipt_id"),
  paymentVoucherId: uuid("payment_voucher_id"),
  userId: uuid("user_id"),
  ...audit,
});
export type TreasuryTransactionRow = typeof treasuryTransactionsTable.$inferSelect;

export const bankAccountsTable = pgTable("bank_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  branchId: uuid("branch_id"),
  code: text("code").notNull(),
  bankName: text("bank_name").notNull(),
  bankNameAr: text("bank_name_ar").notNull(),
  accountNumber: text("account_number").notNull(),
  iban: text("iban"),
  openingBalance: numeric("opening_balance", { precision: 14, scale: 2 }).notNull().default("0"),
  currentBalance: numeric("current_balance", { precision: 14, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  ...audit,
});
export type BankAccountRow = typeof bankAccountsTable.$inferSelect;

export const bankTransactionsTable = pgTable("bank_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  bankAccountId: uuid("bank_account_id").notNull(),
  type: text("type").notNull().default("in"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
  transactionDate: date("transaction_date").notNull(),
  reference: text("reference"),
  description: text("description"),
  receiptId: uuid("receipt_id"),
  paymentVoucherId: uuid("payment_voucher_id"),
  userId: uuid("user_id"),
  ...audit,
});
export type BankTransactionRow = typeof bankTransactionsTable.$inferSelect;

export const receiptsTable = pgTable("receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  branchId: uuid("branch_id"),
  code: text("code").notNull(),
  customerId: uuid("customer_id").notNull(),
  contractId: uuid("contract_id"),
  scheduleId: uuid("schedule_id"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
  receiptDate: date("receipt_date").notNull(),
  paymentMethod: text("payment_method").notNull().default("cash"),
  cashboxId: uuid("cashbox_id"),
  bankAccountId: uuid("bank_account_id"),
  chequeNumber: text("cheque_number"),
  chequeDate: date("cheque_date"),
  bankName: text("bank_name"),
  chequeId: uuid("cheque_id"),
  reference: text("reference"),
  // Receipt-voucher lifecycle: draft -> approved -> posted -> reversed / cancelled.
  // (Legacy rows may carry "confirmed"; new vouchers default to "draft" and only
  // post to the ledger on approval+posting.)
  status: text("status").notNull().default("draft"),
  receivableAccountId: uuid("receivable_account_id"),
  journalEntryId: uuid("journal_entry_id"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: uuid("approved_by"),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  postedBy: uuid("posted_by"),
  reversedAt: timestamp("reversed_at", { withTimezone: true }),
  reversedBy: uuid("reversed_by"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelledBy: uuid("cancelled_by"),
  notes: text("notes"),
  userId: uuid("user_id"),
  ...audit,
});
export type ReceiptRow = typeof receiptsTable.$inferSelect;

// ===================== cheques =====================
// Standalone cheque lifecycle (incoming from customers / outgoing to suppliers
// & contractors). Distinct from the cheque attributes stored inline on a
// receipt: a cheque here moves through a status lifecycle and posts to the
// ledger on collection (reversed on return/cancel). `direction` is incoming or
// outgoing. `status` is received / under_collection / collected / returned /
// cancelled / replaced. A replaced cheque keeps its history and links to its
// replacement via `replacedByChequeId` (and the new cheque back-links via
// `replacesChequeId`).
export const chequesTable = pgTable("cheques", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  branchId: uuid("branch_id"),
  code: text("code").notNull(),
  direction: text("direction").notNull().default("incoming"),
  chequeNumber: text("cheque_number").notNull(),
  chequeDate: date("cheque_date"),
  dueDate: date("due_date"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
  bankName: text("bank_name"),
  bankAccountId: uuid("bank_account_id"),
  customerId: uuid("customer_id"),
  supplierId: uuid("supplier_id"),
  contractId: uuid("contract_id"),
  unitId: uuid("unit_id"),
  scheduleId: uuid("schedule_id"),
  receiptId: uuid("receipt_id"),
  paymentVoucherId: uuid("payment_voucher_id"),
  payeeName: text("payee_name"),
  status: text("status").notNull().default("received"),
  replacedByChequeId: uuid("replaced_by_cheque_id"),
  replacesChequeId: uuid("replaces_cheque_id"),
  collectionDate: date("collection_date"),
  depositDate: date("deposit_date"),
  clearedDate: date("cleared_date"),
  returnedDate: date("returned_date"),
  returnReason: text("return_reason"),
  reference: text("reference"),
  notes: text("notes"),
  attachments: text("attachments"),
  userId: uuid("user_id"),
  ...audit,
});
export type ChequeRow = typeof chequesTable.$inferSelect;

// Append-only history of every cheque status transition.
export const chequeStatusHistoryTable = pgTable("cheque_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  chequeId: uuid("cheque_id"),
  action: text("action"),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  actorName: text("actor_name"),
  actionDate: date("action_date"),
  notes: text("notes"),
  ...audit,
});
export type ChequeStatusHistoryRow = typeof chequeStatusHistoryTable.$inferSelect;

export const assessedPenaltiesTable = pgTable("assessed_penalties", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  scheduleId: uuid("schedule_id").notNull(),
  ruleId: uuid("rule_id").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
  daysOverdue: integer("days_overdue").notNull().default(0),
  assessedDate: date("assessed_date").notNull(),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  ...audit,
});
export type AssessedPenaltyRow = typeof assessedPenaltiesTable.$inferSelect;
