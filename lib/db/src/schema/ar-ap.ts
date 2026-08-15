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

// ===================== tax codes =====================
// VAT / tax master data. `taxType` is output (sales / customer invoices) or
// input (purchases / supplier invoices). `rate` is a percentage (e.g. 15.00).
// `taxAccountId` is the GL account the computed tax posts to (VAT payable for
// output, VAT recoverable for input).
export const taxCodesTable = pgTable("tax_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  taxType: text("tax_type").notNull().default("output"),
  rate: numeric("rate", { precision: 7, scale: 4 }).notNull().default("0"),
  taxAccountId: uuid("tax_account_id"),
  status: text("status").notNull().default("active"),
  description: text("description"),
  ...audit,
});
export type TaxCodeRow = typeof taxCodesTable.$inferSelect;

// ===================== customer invoices (AR) =====================
// A receivable invoice raised against a customer. Lifecycle:
// draft -> posted -> partially_paid -> paid, plus reversed / cancelled.
// Posting recognises revenue + output tax against the customer's receivable
// control account. Settlement is recorded via receipt_allocations which raise
// `paidAmount` toward `total`.
export const customerInvoicesTable = pgTable("customer_invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  branchId: uuid("branch_id"),
  number: text("number").notNull(),
  customerId: uuid("customer_id").notNull(),
  contractId: uuid("contract_id"),
  unitId: uuid("unit_id"),
  invoiceDate: date("invoice_date").notNull(),
  dueDate: date("due_date"),
  status: text("status").notNull().default("draft"),
  currencyId: uuid("currency_id"),
  receivableAccountId: uuid("receivable_account_id"),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
  taxTotal: numeric("tax_total", { precision: 14, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 14, scale: 2 }).notNull().default("0"),
  paidAmount: numeric("paid_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  reference: text("reference"),
  description: text("description"),
  notes: text("notes"),
  journalEntryId: uuid("journal_entry_id"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: uuid("approved_by"),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  postedBy: uuid("posted_by"),
  reversedAt: timestamp("reversed_at", { withTimezone: true }),
  reversedBy: uuid("reversed_by"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelledBy: uuid("cancelled_by"),
  userId: uuid("user_id"),
  ...audit,
});
export type CustomerInvoiceRow = typeof customerInvoicesTable.$inferSelect;

export const customerInvoiceLinesTable = pgTable("customer_invoice_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  invoiceId: uuid("invoice_id").notNull(),
  lineNumber: integer("line_number").notNull().default(1),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull().default("1"),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull().default("0"),
  lineSubtotal: numeric("line_subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
  taxCodeId: uuid("tax_code_id"),
  taxRate: numeric("tax_rate", { precision: 7, scale: 4 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull().default("0"),
  revenueAccountId: uuid("revenue_account_id"),
  costCenterId: uuid("cost_center_id"),
  profitCenterId: uuid("profit_center_id"),
  ...audit,
});
export type CustomerInvoiceLineRow = typeof customerInvoiceLinesTable.$inferSelect;

// ===================== supplier invoices (AP) =====================
// A payable invoice received from a supplier. Mirror of customer invoices:
// posting recognises expense + input tax against the supplier's payable control
// account. Settlement is recorded via payment_allocations.
export const supplierInvoicesTable = pgTable("supplier_invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  branchId: uuid("branch_id"),
  number: text("number").notNull(),
  supplierId: uuid("supplier_id").notNull(),
  contractId: uuid("contract_id"),
  supplierInvoiceNumber: text("supplier_invoice_number"),
  invoiceDate: date("invoice_date").notNull(),
  dueDate: date("due_date"),
  status: text("status").notNull().default("draft"),
  currencyId: uuid("currency_id"),
  payableAccountId: uuid("payable_account_id"),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
  taxTotal: numeric("tax_total", { precision: 14, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 14, scale: 2 }).notNull().default("0"),
  paidAmount: numeric("paid_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  reference: text("reference"),
  description: text("description"),
  notes: text("notes"),
  journalEntryId: uuid("journal_entry_id"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: uuid("approved_by"),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  postedBy: uuid("posted_by"),
  reversedAt: timestamp("reversed_at", { withTimezone: true }),
  reversedBy: uuid("reversed_by"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelledBy: uuid("cancelled_by"),
  userId: uuid("user_id"),
  ...audit,
});
export type SupplierInvoiceRow = typeof supplierInvoicesTable.$inferSelect;

export const supplierInvoiceLinesTable = pgTable("supplier_invoice_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  invoiceId: uuid("invoice_id").notNull(),
  lineNumber: integer("line_number").notNull().default(1),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull().default("1"),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull().default("0"),
  lineSubtotal: numeric("line_subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
  taxCodeId: uuid("tax_code_id"),
  taxRate: numeric("tax_rate", { precision: 7, scale: 4 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull().default("0"),
  expenseAccountId: uuid("expense_account_id"),
  costCenterId: uuid("cost_center_id"),
  profitCenterId: uuid("profit_center_id"),
  ...audit,
});
export type SupplierInvoiceLineRow = typeof supplierInvoiceLinesTable.$inferSelect;

// ===================== payment vouchers =====================
// An outgoing cash/bank payment document (to suppliers, contractors, or direct
// expenses). Lifecycle: draft -> approved -> posted -> reversed / cancelled.
// Posting debits the payee's payable control account (or a direct expense
// account) and credits cash/bank. Settlement against supplier invoices is
// recorded via payment_allocations.
export const paymentVouchersTable = pgTable("payment_vouchers", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  branchId: uuid("branch_id"),
  code: text("code").notNull(),
  payeeType: text("payee_type").notNull().default("supplier"),
  supplierId: uuid("supplier_id"),
  contractorId: uuid("contractor_id"),
  payeeName: text("payee_name"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
  paymentDate: date("payment_date").notNull(),
  paymentMethod: text("payment_method").notNull().default("cash"),
  cashboxId: uuid("cashbox_id"),
  bankAccountId: uuid("bank_account_id"),
  chequeId: uuid("cheque_id"),
  chequeNumber: text("cheque_number"),
  chequeDate: date("cheque_date"),
  bankName: text("bank_name"),
  expenseAccountId: uuid("expense_account_id"),
  payableAccountId: uuid("payable_account_id"),
  reference: text("reference"),
  status: text("status").notNull().default("draft"),
  description: text("description"),
  notes: text("notes"),
  journalEntryId: uuid("journal_entry_id"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: uuid("approved_by"),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  postedBy: uuid("posted_by"),
  reversedAt: timestamp("reversed_at", { withTimezone: true }),
  reversedBy: uuid("reversed_by"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelledBy: uuid("cancelled_by"),
  userId: uuid("user_id"),
  ...audit,
});
export type PaymentVoucherRow = typeof paymentVouchersTable.$inferSelect;

// ===================== allocations / settlement =====================
// Links a receipt voucher to the customer invoice(s) / installment schedule(s)
// it settles, raising their paidAmount.
export const receiptAllocationsTable = pgTable("receipt_allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  receiptId: uuid("receipt_id").notNull(),
  customerInvoiceId: uuid("customer_invoice_id"),
  scheduleId: uuid("schedule_id"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  ...audit,
});
export type ReceiptAllocationRow = typeof receiptAllocationsTable.$inferSelect;

// Links a payment voucher to the supplier invoice(s) it settles.
export const paymentAllocationsTable = pgTable("payment_allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  paymentVoucherId: uuid("payment_voucher_id").notNull(),
  supplierInvoiceId: uuid("supplier_invoice_id"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  ...audit,
});
export type PaymentAllocationRow = typeof paymentAllocationsTable.$inferSelect;
