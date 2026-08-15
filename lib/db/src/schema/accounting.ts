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

// ===================== chart of accounts =====================
// Hierarchical chart of accounts. `parentId` is a self reference (null at the
// root). `type` is one of asset/liability/equity/revenue/expense. `normalSide`
// is debit/credit and determines how balances are signed. Only `isPostable`
// (leaf) accounts may receive journal lines.
export const accountsTable = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  parentId: uuid("parent_id"),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  type: text("type").notNull().default("asset"),
  normalSide: text("normal_side").notNull().default("debit"),
  level: integer("level").notNull().default(1),
  isPostable: boolean("is_postable").notNull().default(true),
  currencyId: uuid("currency_id"),
  description: text("description"),
  status: text("status").notNull().default("active"),
  ...audit,
});
export type AccountRow = typeof accountsTable.$inferSelect;

// ===================== cost centers =====================
// Hierarchical cost centers (departments, projects, branches). `parentId` is a
// self reference; `projectId` optionally links to a real-estate project.
export const costCentersTable = pgTable("cost_centers", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  parentId: uuid("parent_id"),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  kind: text("kind").notNull().default("department"),
  projectId: uuid("project_id"),
  description: text("description"),
  status: text("status").notNull().default("active"),
  ...audit,
});
export type CostCenterRow = typeof costCentersTable.$inferSelect;

// ===================== profit centers =====================
// Hierarchical profit centers (revenue-generating segments: projects, product
// lines, regions). Mirrors cost centers but tracks profitability rather than
// cost allocation. Addable at any time; tagging a new center never alters
// historical journal lines.
export const profitCentersTable = pgTable("profit_centers", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  parentId: uuid("parent_id"),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  kind: text("kind").notNull().default("segment"),
  projectId: uuid("project_id"),
  description: text("description"),
  status: text("status").notNull().default("active"),
  ...audit,
});
export type ProfitCenterRow = typeof profitCentersTable.$inferSelect;

// ===================== fiscal periods =====================
// Accounting periods inside a fiscal year. Posting is blocked once a period is
// `closed`. Reopening flips it back to `open`.
export const fiscalPeriodsTable = pgTable("fiscal_periods", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  fiscalYearId: uuid("fiscal_year_id").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  periodNumber: integer("period_number").notNull().default(1),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  status: text("status").notNull().default("open"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  closedBy: uuid("closed_by"),
  ...audit,
});
export type FiscalPeriodRow = typeof fiscalPeriodsTable.$inferSelect;

// ===================== journal entries =====================
// A balanced double-entry document. `status` is draft/posted/reversed. A posted
// entry is ledger-immutable; reversing creates a mirror entry and links both via
// `reversalEntryId`. `sourceType`/`sourceId` tag auto-generated entries to their
// originating record (receipt, collection, contract, etc.).
export const journalEntriesTable = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  branchId: uuid("branch_id"),
  number: text("number").notNull(),
  entryDate: date("entry_date", { mode: "string" }).notNull(),
  fiscalPeriodId: uuid("fiscal_period_id"),
  description: text("description"),
  descriptionAr: text("description_ar"),
  reference: text("reference"),
  status: text("status").notNull().default("draft"),
  sourceType: text("source_type"),
  sourceId: uuid("source_id"),
  totalDebit: numeric("total_debit", { precision: 14, scale: 2 }).notNull().default("0"),
  totalCredit: numeric("total_credit", { precision: 14, scale: 2 }).notNull().default("0"),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  postedBy: uuid("posted_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: uuid("approved_by"),
  reversedAt: timestamp("reversed_at", { withTimezone: true }),
  reversedBy: uuid("reversed_by"),
  reversalEntryId: uuid("reversal_entry_id"),
  isAutomatic: boolean("is_automatic").notNull().default(false),
  userId: uuid("user_id"),
  ...audit,
});
export type JournalEntryRow = typeof journalEntriesTable.$inferSelect;

// ===================== journal entry lines =====================
// One debit-or-credit posting against an account, optionally tagged to a cost
// center. Each line carries exactly one positive amount (the other is 0).
export const journalEntryLinesTable = pgTable("journal_entry_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  entryId: uuid("entry_id").notNull(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  accountId: uuid("account_id").notNull(),
  costCenterId: uuid("cost_center_id"),
  profitCenterId: uuid("profit_center_id"),
  lineNumber: integer("line_number").notNull().default(1),
  debit: numeric("debit", { precision: 14, scale: 2 }).notNull().default("0"),
  credit: numeric("credit", { precision: 14, scale: 2 }).notNull().default("0"),
  description: text("description"),
  ...audit,
});
export type JournalEntryLineRow = typeof journalEntryLinesTable.$inferSelect;

// ===================== account mappings =====================
// Maps an automatic posting event (e.g. "receipt.cash") to the debit and credit
// accounts to use, so integration hooks resolve accounts by key.
export const accountMappingsTable = pgTable("account_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  eventKey: text("event_key").notNull(),
  debitAccountId: uuid("debit_account_id"),
  creditAccountId: uuid("credit_account_id"),
  description: text("description"),
  ...audit,
});
export type AccountMappingRow = typeof accountMappingsTable.$inferSelect;

// ===================== budgets =====================
export const budgetsTable = pgTable("budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  fiscalYearId: uuid("fiscal_year_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  status: text("status").notNull().default("draft"),
  description: text("description"),
  ...audit,
});
export type BudgetRow = typeof budgetsTable.$inferSelect;

// ===================== budget lines =====================
// Budgeted amount per account (optionally per cost center) inside a budget.
export const budgetLinesTable = pgTable("budget_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  budgetId: uuid("budget_id").notNull(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  accountId: uuid("account_id").notNull(),
  costCenterId: uuid("cost_center_id"),
  profitCenterId: uuid("profit_center_id"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  ...audit,
});
export type BudgetLineRow = typeof budgetLinesTable.$inferSelect;
