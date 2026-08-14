import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, lt, ne, or, sql, type SQL } from "drizzle-orm";
import {
  db,
  cashboxesTable,
  treasuryTransactionsTable,
  bankAccountsTable,
  bankTransactionsTable,
  receiptsTable,
  receiptAllocationsTable,
  customerInvoicesTable,
  customersTable,
  assessedPenaltiesTable,
  installmentSchedulesTable,
  penaltyRulesTable,
  contractsTable,
} from "@workspace/db";
import {
  ListCashboxesResponse,
  CreateCashboxBody,
  GetCashboxResponse,
  UpdateCashboxBody,
  ListTreasuryTransactionsResponse,
  CreateTreasuryTransactionBody,
  GetTreasuryTransactionResponse,
  UpdateTreasuryTransactionBody,
  ListBankAccountsResponse,
  CreateBankAccountBody,
  GetBankAccountResponse,
  UpdateBankAccountBody,
  ListBankTransactionsResponse,
  CreateBankTransactionBody,
  GetBankTransactionResponse,
  UpdateBankTransactionBody,
  ListReceiptsResponse,
  CreateReceiptBody,
  GetReceiptResponse,
  UpdateReceiptBody,
  ApproveReceiptResponse,
  PostReceiptResponse,
  ReverseReceiptResponse,
  CancelReceiptResponse,
  ListPenaltiesResponse,
  CreatePenaltyBody,
  GetPenaltyResponse,
  UpdatePenaltyBody,
  GetFinanceDashboardResponse,
  CalculatePenaltiesBody,
  CalculatePenaltiesResponse,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { nextNumber } from "../lib/doc-number";
import { requireAuth, requirePermission } from "../middleware/auth";
import {
  postAutomaticEntry,
  postAutomaticLines,
  reverseAutomaticEntriesForSource,
  getCompanyMapping,
  PostingError,
  type Tx,
} from "../lib/posting";

// Map a receipt payment method to the account-mapping event key.
const RECEIPT_EVENT: Record<string, string> = {
  cash: "receipt.cash",
  bank_transfer: "receipt.bank",
  cheque: "receipt.cheque",
};

const router: IRouter = Router();
router.use(requireAuth);

// Validate a decimal amount string (defense-in-depth; generated bodies type amount as z.string()).
const AMOUNT_RE = /^\d+(\.\d+)?$/;
// Returns a validated decimal string, or null if invalid (handlers turn null into a 400).
function validAmount(value: string | null | undefined): string | null {
  const v = (value ?? "0").trim();
  return AMOUNT_RE.test(v) ? v : null;
}
// For DB-sourced amounts that are already validated on write; throws if somehow corrupt.
function amountOrThrow(value: string | null | undefined): string {
  const v = (value ?? "0").trim();
  if (!AMOUNT_RE.test(v)) throw new Error(`Invalid amount: ${value}`);
  return v;
}

// Drop financial/immutable fields from a PATCH payload so balances/ledgers cannot desync.
function omit<T extends Record<string, unknown>>(obj: T, keys: string[]): Partial<T> {
  const out: Record<string, unknown> = { ...obj };
  for (const k of keys) delete out[k];
  return out as Partial<T>;
}

// ===================== cashboxes =====================
router.get("/cashboxes", requirePermission("cashboxes.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(cashboxesTable.isDeleted, false)];
  const search = qStr(q, "search");
  if (search) {
    const s = or(ilike(cashboxesTable.code, `%${search}%`), ilike(cashboxesTable.name, `%${search}%`), ilike(cashboxesTable.nameAr, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(cashboxesTable.companyId, companyId));
  const status = qStr(q, "status");
  if (status) filters.push(eq(cashboxesTable.status, status));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(cashboxesTable).where(where);
  const rows = await db.select().from(cashboxesTable).where(where).orderBy(desc(cashboxesTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListCashboxesResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/cashboxes", requirePermission("cashboxes.create"), async (req, res): Promise<void> => {
  const parsed = CreateCashboxBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = { ...parsed.data };
  if (data.currentBalance == null && data.openingBalance != null) data.currentBalance = data.openingBalance;
  const [row] = await db.insert(cashboxesTable).values(data).returning();
  await recordAudit(req, { action: "create", entity: "cashbox", entityId: row.id, newValue: row });
  res.status(201).json(GetCashboxResponse.parse(serializeRow(row)));
});

router.get("/cashboxes/:id", requirePermission("cashboxes.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(cashboxesTable).where(and(eq(cashboxesTable.id, id), eq(cashboxesTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetCashboxResponse.parse(serializeRow(row)));
});

router.patch("/cashboxes/:id", requirePermission("cashboxes.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateCashboxBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(cashboxesTable).where(and(eq(cashboxesTable.id, id), eq(cashboxesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(cashboxesTable).set(update).where(eq(cashboxesTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "cashbox", entityId: id, oldValue: existing, newValue: row });
  res.json(GetCashboxResponse.parse(serializeRow(row)));
});

router.delete("/cashboxes/:id", requirePermission("cashboxes.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(cashboxesTable).set({ isDeleted: true, isActive: false }).where(and(eq(cashboxesTable.id, id), eq(cashboxesTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "cashbox", entityId: id });
  res.json({ success: true });
});

// ===================== treasury transactions =====================
router.get("/treasury-transactions", requirePermission("treasuryTransactions.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(treasuryTransactionsTable.isDeleted, false)];
  const search = qStr(q, "search");
  if (search) {
    const s = or(ilike(treasuryTransactionsTable.reference, `%${search}%`), ilike(treasuryTransactionsTable.description, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(treasuryTransactionsTable.companyId, companyId));
  const cashboxId = qStr(q, "cashboxId");
  if (cashboxId) filters.push(eq(treasuryTransactionsTable.cashboxId, cashboxId));
  const type = qStr(q, "type");
  if (type) filters.push(eq(treasuryTransactionsTable.type, type));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(treasuryTransactionsTable).where(where);
  const rows = await db.select().from(treasuryTransactionsTable).where(where).orderBy(desc(treasuryTransactionsTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListTreasuryTransactionsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/treasury-transactions", requirePermission("treasuryTransactions.create"), async (req, res): Promise<void> => {
  const parsed = CreateTreasuryTransactionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;
  const amount = validAmount(data.amount);
  if (amount === null) { res.status(400).json({ error: "Invalid amount" }); return; }
  const row = await db.transaction(async (tx) => {
    const [created] = await tx.insert(treasuryTransactionsTable).values({ ...data, userId: req.authUser?.id ?? null }).returning();
    const balance = data.type === "out"
      ? sql`${cashboxesTable.currentBalance} - ${amount}::numeric`
      : sql`${cashboxesTable.currentBalance} + ${amount}::numeric`;
    await tx.update(cashboxesTable)
      .set({ currentBalance: balance })
      .where(eq(cashboxesTable.id, data.cashboxId));
    // Post a JE only for standalone treasury movements; receipt-linked ones are
    // posted via the receipt to avoid double counting.
    if (!data.receiptId) {
      await postAutomaticEntry(tx, {
        companyId: data.companyId,
        eventKey: data.type === "out" ? "treasury.out" : "treasury.in",
        amount,
        entryDate: data.transactionDate,
        description: data.description ?? `Treasury ${data.type}`,
        reference: data.reference ?? null,
        sourceType: "treasuryTransaction",
        sourceId: created.id,
        userId: req.authUser?.id ?? null,
      });
    }
    return created;
  });
  await recordAudit(req, { action: "create", entity: "treasuryTransaction", entityId: row.id, newValue: row });
  res.status(201).json(GetTreasuryTransactionResponse.parse(serializeRow(row)));
});

router.get("/treasury-transactions/:id", requirePermission("treasuryTransactions.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(treasuryTransactionsTable).where(and(eq(treasuryTransactionsTable.id, id), eq(treasuryTransactionsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetTreasuryTransactionResponse.parse(serializeRow(row)));
});

router.patch("/treasury-transactions/:id", requirePermission("treasuryTransactions.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateTreasuryTransactionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(treasuryTransactionsTable).where(and(eq(treasuryTransactionsTable.id, id), eq(treasuryTransactionsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  // Posted transactions are ledger-immutable: only descriptive fields may change.
  const update = omit(parsed.data, ["amount", "type", "cashboxId", "companyId"]);
  const [row] = Object.keys(update).length
    ? await db.update(treasuryTransactionsTable).set(update).where(eq(treasuryTransactionsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "treasuryTransaction", entityId: id, oldValue: existing, newValue: row });
  res.json(GetTreasuryTransactionResponse.parse(serializeRow(row)));
});

router.delete("/treasury-transactions/:id", requirePermission("treasuryTransactions.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const row = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(treasuryTransactionsTable).where(and(eq(treasuryTransactionsTable.id, id), eq(treasuryTransactionsTable.isDeleted, false)));
    if (!existing) return null;
    await tx.update(treasuryTransactionsTable).set({ isDeleted: true, isActive: false }).where(eq(treasuryTransactionsTable.id, id));
    const amount = amountOrThrow(existing.amount);
    // Reverse the original posting: 'in' had added, so subtract; 'out' had subtracted, so add back.
    const balance = existing.type === "in"
      ? sql`${cashboxesTable.currentBalance} - ${amount}::numeric`
      : sql`${cashboxesTable.currentBalance} + ${amount}::numeric`;
    await tx.update(cashboxesTable).set({ currentBalance: balance }).where(eq(cashboxesTable.id, existing.cashboxId));
    await reverseAutomaticEntriesForSource(tx, "treasuryTransaction", existing.id, req.authUser?.id ?? null);
    return existing;
  });
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "treasuryTransaction", entityId: id, oldValue: row });
  res.json({ success: true });
});

// ===================== bank accounts =====================
router.get("/bank-accounts", requirePermission("bankAccounts.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(bankAccountsTable.isDeleted, false)];
  const search = qStr(q, "search");
  if (search) {
    const s = or(ilike(bankAccountsTable.code, `%${search}%`), ilike(bankAccountsTable.bankName, `%${search}%`), ilike(bankAccountsTable.accountNumber, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(bankAccountsTable.companyId, companyId));
  const status = qStr(q, "status");
  if (status) filters.push(eq(bankAccountsTable.status, status));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(bankAccountsTable).where(where);
  const rows = await db.select().from(bankAccountsTable).where(where).orderBy(desc(bankAccountsTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListBankAccountsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/bank-accounts", requirePermission("bankAccounts.create"), async (req, res): Promise<void> => {
  const parsed = CreateBankAccountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = { ...parsed.data };
  if (data.currentBalance == null && data.openingBalance != null) data.currentBalance = data.openingBalance;
  const [row] = await db.insert(bankAccountsTable).values(data).returning();
  await recordAudit(req, { action: "create", entity: "bankAccount", entityId: row.id, newValue: row });
  res.status(201).json(GetBankAccountResponse.parse(serializeRow(row)));
});

router.get("/bank-accounts/:id", requirePermission("bankAccounts.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(bankAccountsTable).where(and(eq(bankAccountsTable.id, id), eq(bankAccountsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetBankAccountResponse.parse(serializeRow(row)));
});

router.patch("/bank-accounts/:id", requirePermission("bankAccounts.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateBankAccountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(bankAccountsTable).where(and(eq(bankAccountsTable.id, id), eq(bankAccountsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(bankAccountsTable).set(update).where(eq(bankAccountsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "bankAccount", entityId: id, oldValue: existing, newValue: row });
  res.json(GetBankAccountResponse.parse(serializeRow(row)));
});

router.delete("/bank-accounts/:id", requirePermission("bankAccounts.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(bankAccountsTable).set({ isDeleted: true, isActive: false }).where(and(eq(bankAccountsTable.id, id), eq(bankAccountsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "bankAccount", entityId: id });
  res.json({ success: true });
});

// ===================== bank transactions =====================
router.get("/bank-transactions", requirePermission("bankTransactions.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(bankTransactionsTable.isDeleted, false)];
  const search = qStr(q, "search");
  if (search) {
    const s = or(ilike(bankTransactionsTable.reference, `%${search}%`), ilike(bankTransactionsTable.description, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(bankTransactionsTable.companyId, companyId));
  const bankAccountId = qStr(q, "bankAccountId");
  if (bankAccountId) filters.push(eq(bankTransactionsTable.bankAccountId, bankAccountId));
  const type = qStr(q, "type");
  if (type) filters.push(eq(bankTransactionsTable.type, type));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(bankTransactionsTable).where(where);
  const rows = await db.select().from(bankTransactionsTable).where(where).orderBy(desc(bankTransactionsTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListBankTransactionsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/bank-transactions", requirePermission("bankTransactions.create"), async (req, res): Promise<void> => {
  const parsed = CreateBankTransactionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;
  const amount = validAmount(data.amount);
  if (amount === null) { res.status(400).json({ error: "Invalid amount" }); return; }
  const row = await db.transaction(async (tx) => {
    const [created] = await tx.insert(bankTransactionsTable).values({ ...data, userId: req.authUser?.id ?? null }).returning();
    const balance = data.type === "out"
      ? sql`${bankAccountsTable.currentBalance} - ${amount}::numeric`
      : sql`${bankAccountsTable.currentBalance} + ${amount}::numeric`;
    await tx.update(bankAccountsTable)
      .set({ currentBalance: balance })
      .where(eq(bankAccountsTable.id, data.bankAccountId));
    // Post a JE only for standalone bank movements; receipt-linked ones are
    // posted via the receipt to avoid double counting.
    if (!data.receiptId) {
      await postAutomaticEntry(tx, {
        companyId: data.companyId,
        eventKey: data.type === "out" ? "bank.out" : "bank.in",
        amount,
        entryDate: data.transactionDate,
        description: data.description ?? `Bank ${data.type}`,
        reference: data.reference ?? null,
        sourceType: "bankTransaction",
        sourceId: created.id,
        userId: req.authUser?.id ?? null,
      });
    }
    return created;
  });
  await recordAudit(req, { action: "create", entity: "bankTransaction", entityId: row.id, newValue: row });
  res.status(201).json(GetBankTransactionResponse.parse(serializeRow(row)));
});

router.get("/bank-transactions/:id", requirePermission("bankTransactions.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(bankTransactionsTable).where(and(eq(bankTransactionsTable.id, id), eq(bankTransactionsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetBankTransactionResponse.parse(serializeRow(row)));
});

router.patch("/bank-transactions/:id", requirePermission("bankTransactions.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateBankTransactionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(bankTransactionsTable).where(and(eq(bankTransactionsTable.id, id), eq(bankTransactionsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  // Posted transactions are ledger-immutable: only descriptive fields may change.
  const update = omit(parsed.data, ["amount", "type", "bankAccountId", "companyId"]);
  const [row] = Object.keys(update).length
    ? await db.update(bankTransactionsTable).set(update).where(eq(bankTransactionsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "bankTransaction", entityId: id, oldValue: existing, newValue: row });
  res.json(GetBankTransactionResponse.parse(serializeRow(row)));
});

router.delete("/bank-transactions/:id", requirePermission("bankTransactions.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const row = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(bankTransactionsTable).where(and(eq(bankTransactionsTable.id, id), eq(bankTransactionsTable.isDeleted, false)));
    if (!existing) return null;
    await tx.update(bankTransactionsTable).set({ isDeleted: true, isActive: false }).where(eq(bankTransactionsTable.id, id));
    const amount = amountOrThrow(existing.amount);
    const balance = existing.type === "in"
      ? sql`${bankAccountsTable.currentBalance} - ${amount}::numeric`
      : sql`${bankAccountsTable.currentBalance} + ${amount}::numeric`;
    await tx.update(bankAccountsTable).set({ currentBalance: balance }).where(eq(bankAccountsTable.id, existing.bankAccountId));
    await reverseAutomaticEntriesForSource(tx, "bankTransaction", existing.id, req.authUser?.id ?? null);
    return existing;
  });
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "bankTransaction", entityId: id, oldValue: row });
  res.json({ success: true });
});

// ===================== receipts =====================
router.get("/receipts", requirePermission("receipts.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(receiptsTable.isDeleted, false)];
  const search = qStr(q, "search");
  if (search) {
    const s = or(ilike(receiptsTable.code, `%${search}%`), ilike(receiptsTable.reference, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(receiptsTable.companyId, companyId));
  const customerId = qStr(q, "customerId");
  if (customerId) filters.push(eq(receiptsTable.customerId, customerId));
  const contractId = qStr(q, "contractId");
  if (contractId) filters.push(eq(receiptsTable.contractId, contractId));
  const scheduleId = qStr(q, "scheduleId");
  if (scheduleId) filters.push(eq(receiptsTable.scheduleId, scheduleId));
  const paymentMethod = qStr(q, "paymentMethod");
  if (paymentMethod) filters.push(eq(receiptsTable.paymentMethod, paymentMethod));
  const status = qStr(q, "status");
  if (status) filters.push(eq(receiptsTable.status, status));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(receiptsTable).where(where);
  const rows = await db.select().from(receiptsTable).where(where).orderBy(desc(receiptsTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListReceiptsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

// Load a receipt voucher with its allocation rows.
async function loadReceipt(tx: Tx, id: string) {
  const [receipt] = await tx.select().from(receiptsTable).where(and(eq(receiptsTable.id, id), eq(receiptsTable.isDeleted, false)));
  if (!receipt) return null;
  const allocations = await tx.select().from(receiptAllocationsTable)
    .where(and(eq(receiptAllocationsTable.receiptId, id), eq(receiptAllocationsTable.isDeleted, false)));
  return { receipt, allocations };
}

function receiptDetail(receipt: Record<string, unknown>, allocations: Record<string, unknown>[]) {
  return { ...serializeRow(receipt), allocations: allocations.map(serializeRow) };
}

// Apply the financial effects of posting a receipt voucher (called by /post). Updates the
// allocated invoices/schedules (or the legacy single schedule), the cash/bank balance, and
// posts the ledger entry. Throws PostingError(409) when no receivable account can be resolved.
async function applyReceiptPosting(tx: Tx, receipt: typeof receiptsTable.$inferSelect, allocations: (typeof receiptAllocationsTable.$inferSelect)[], userId: string | null): Promise<string> {
  const amount = amountOrThrow(receipt.amount);

  // Settle allocations (preferred) or fall back to the legacy single-schedule field.
  if (allocations.length) {
    for (const a of allocations) {
      const aAmt = amountOrThrow(a.amount);
      if (a.customerInvoiceId) {
        await tx.update(customerInvoicesTable).set({
          paidAmount: sql`${customerInvoicesTable.paidAmount} + ${aAmt}::numeric`,
          status: sql`CASE
            WHEN ${customerInvoicesTable.paidAmount} + ${aAmt}::numeric >= ${customerInvoicesTable.total} THEN 'paid'
            WHEN ${customerInvoicesTable.paidAmount} + ${aAmt}::numeric > 0 THEN 'partially_paid'
            ELSE ${customerInvoicesTable.status} END`,
        }).where(and(eq(customerInvoicesTable.id, a.customerInvoiceId), eq(customerInvoicesTable.isDeleted, false)));
      }
      if (a.scheduleId) {
        await tx.update(installmentSchedulesTable).set({
          paidAmount: sql`${installmentSchedulesTable.paidAmount} + ${aAmt}::numeric`,
          status: sql`CASE
            WHEN ${installmentSchedulesTable.paidAmount} + ${aAmt}::numeric >= ${installmentSchedulesTable.amount} THEN 'paid'
            WHEN ${installmentSchedulesTable.paidAmount} + ${aAmt}::numeric > 0 THEN 'partial'
            ELSE ${installmentSchedulesTable.status} END`,
        }).where(and(eq(installmentSchedulesTable.id, a.scheduleId), eq(installmentSchedulesTable.isDeleted, false)));
      }
    }
  } else if (receipt.scheduleId) {
    await tx.update(installmentSchedulesTable).set({
      paidAmount: sql`${installmentSchedulesTable.paidAmount} + ${amount}::numeric`,
      status: sql`CASE
        WHEN ${installmentSchedulesTable.paidAmount} + ${amount}::numeric >= ${installmentSchedulesTable.amount} THEN 'paid'
        WHEN ${installmentSchedulesTable.paidAmount} + ${amount}::numeric > 0 THEN 'partial'
        ELSE ${installmentSchedulesTable.status} END`,
    }).where(and(eq(installmentSchedulesTable.id, receipt.scheduleId), eq(installmentSchedulesTable.isDeleted, false)));
  }

  if (receipt.paymentMethod === "cash" && receipt.cashboxId) {
    await tx.insert(treasuryTransactionsTable).values({
      companyId: receipt.companyId, cashboxId: receipt.cashboxId, type: "in", amount,
      transactionDate: receipt.receiptDate, reference: receipt.code, description: "Receipt collection",
      receiptId: receipt.id, userId,
    });
    await tx.update(cashboxesTable).set({ currentBalance: sql`${cashboxesTable.currentBalance} + ${amount}::numeric` }).where(eq(cashboxesTable.id, receipt.cashboxId));
  } else if (receipt.paymentMethod === "bank_transfer" && receipt.bankAccountId) {
    await tx.insert(bankTransactionsTable).values({
      companyId: receipt.companyId, bankAccountId: receipt.bankAccountId, type: "in", amount,
      transactionDate: receipt.receiptDate, reference: receipt.code, description: "Receipt collection",
      receiptId: receipt.id, userId,
    });
    await tx.update(bankAccountsTable).set({ currentBalance: sql`${bankAccountsTable.currentBalance} + ${amount}::numeric` }).where(eq(bankAccountsTable.id, receipt.bankAccountId));
  }

  // Ledger: Dr cash/bank (mapping debit), Cr receivable (per-entity override → customer → mapping credit).
  const eventKey = (receipt.paymentMethod ? RECEIPT_EVENT[receipt.paymentMethod] : undefined) ?? "receipt.bank";
  const map = await getCompanyMapping(tx, receipt.companyId, eventKey);
  const debitId = map?.debitAccountId ?? null;
  if (!debitId) throw new PostingError(409, "No cash/bank account configured for this receipt method");
  const [cust] = await tx.select({ recv: customersTable.receivableAccountId }).from(customersTable).where(eq(customersTable.id, receipt.customerId));
  const creditId = receipt.receivableAccountId ?? cust?.recv ?? map?.creditAccountId ?? null;
  if (!creditId) throw new PostingError(409, "No receivable account configured for this receipt");
  const je = await postAutomaticLines(tx, {
    companyId: receipt.companyId, branchId: receipt.branchId, entryDate: receipt.receiptDate,
    description: `Receipt ${receipt.code}`, reference: receipt.code,
    sourceType: "receipt", sourceId: receipt.id, userId,
    lines: [
      { accountId: debitId, debit: amount, credit: "0", description: `Receipt ${receipt.code}` },
      { accountId: creditId, debit: "0", credit: amount, description: `Receipt ${receipt.code}` },
    ],
  });
  return je.id;
}

// Reverse the financial effects of a posted receipt voucher (called by /reverse).
async function reverseReceiptPosting(tx: Tx, receipt: typeof receiptsTable.$inferSelect, allocations: (typeof receiptAllocationsTable.$inferSelect)[], userId: string | null): Promise<void> {
  const amount = amountOrThrow(receipt.amount);
  if (allocations.length) {
    for (const a of allocations) {
      const aAmt = amountOrThrow(a.amount);
      if (a.customerInvoiceId) {
        await tx.update(customerInvoicesTable).set({
          paidAmount: sql`GREATEST(${customerInvoicesTable.paidAmount} - ${aAmt}::numeric, 0)`,
          status: sql`CASE
            WHEN ${customerInvoicesTable.paidAmount} - ${aAmt}::numeric >= ${customerInvoicesTable.total} THEN 'paid'
            WHEN ${customerInvoicesTable.paidAmount} - ${aAmt}::numeric > 0 THEN 'partially_paid'
            ELSE 'posted' END`,
        }).where(and(eq(customerInvoicesTable.id, a.customerInvoiceId), eq(customerInvoicesTable.isDeleted, false)));
      }
      if (a.scheduleId) {
        await tx.update(installmentSchedulesTable).set({
          paidAmount: sql`GREATEST(${installmentSchedulesTable.paidAmount} - ${aAmt}::numeric, 0)`,
          status: sql`CASE
            WHEN ${installmentSchedulesTable.paidAmount} - ${aAmt}::numeric >= ${installmentSchedulesTable.amount} THEN 'paid'
            WHEN ${installmentSchedulesTable.paidAmount} - ${aAmt}::numeric > 0 THEN 'partial'
            ELSE 'pending' END`,
        }).where(and(eq(installmentSchedulesTable.id, a.scheduleId), eq(installmentSchedulesTable.isDeleted, false)));
      }
    }
  } else if (receipt.scheduleId) {
    await tx.update(installmentSchedulesTable).set({
      paidAmount: sql`GREATEST(${installmentSchedulesTable.paidAmount} - ${amount}::numeric, 0)`,
      status: sql`CASE
        WHEN ${installmentSchedulesTable.paidAmount} - ${amount}::numeric >= ${installmentSchedulesTable.amount} THEN 'paid'
        WHEN ${installmentSchedulesTable.paidAmount} - ${amount}::numeric > 0 THEN 'partial'
        ELSE 'pending' END`,
    }).where(and(eq(installmentSchedulesTable.id, receipt.scheduleId), eq(installmentSchedulesTable.isDeleted, false)));
  }

  if (receipt.paymentMethod === "cash" && receipt.cashboxId) {
    await tx.update(cashboxesTable).set({ currentBalance: sql`${cashboxesTable.currentBalance} - ${amount}::numeric` }).where(eq(cashboxesTable.id, receipt.cashboxId));
    await tx.update(treasuryTransactionsTable).set({ isDeleted: true, isActive: false }).where(and(eq(treasuryTransactionsTable.receiptId, receipt.id), eq(treasuryTransactionsTable.isDeleted, false)));
  } else if (receipt.paymentMethod === "bank_transfer" && receipt.bankAccountId) {
    await tx.update(bankAccountsTable).set({ currentBalance: sql`${bankAccountsTable.currentBalance} - ${amount}::numeric` }).where(eq(bankAccountsTable.id, receipt.bankAccountId));
    await tx.update(bankTransactionsTable).set({ isDeleted: true, isActive: false }).where(and(eq(bankTransactionsTable.receiptId, receipt.id), eq(bankTransactionsTable.isDeleted, false)));
  }
  await reverseAutomaticEntriesForSource(tx, "receipt", receipt.id, userId);
}

// Create a receipt voucher. It is always created as a draft — no financial effects happen until
// it is posted via /receipts/:id/post. Allocation rows (invoice / schedule splits) are stored now.
router.post("/receipts", requirePermission("receipts.create"), async (req, res): Promise<void> => {
  const parsed = CreateReceiptBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;
  const amount = validAmount(data.amount);
  if (amount === null) { res.status(400).json({ error: "Invalid amount" }); return; }
  const { allocations: allocInput, status: _ignoredStatus, ...receiptFields } = data;
  const result = await db.transaction(async (tx) => {
    const [created] = await tx.insert(receiptsTable).values({ ...receiptFields, code: (await nextNumber("Receipt", req.authUser?.companyId ?? null)).value, status: "draft", userId: req.authUser?.id ?? null }).returning();
    const allocations = allocInput?.length
      ? await tx.insert(receiptAllocationsTable).values(allocInput.map((a) => ({
          companyId: data.companyId, receiptId: created.id, customerInvoiceId: a.customerInvoiceId ?? null,
          scheduleId: a.scheduleId ?? null, amount: a.amount, notes: a.notes ?? null,
        }))).returning()
      : [];
    return { receipt: created, allocations };
  });
  await recordAudit(req, { action: "create", entity: "receipt", entityId: result.receipt.id, newValue: result.receipt });
  res.status(201).json(GetReceiptResponse.parse(serializeRow(result.receipt)));
});

router.get("/receipts/:id", requirePermission("receipts.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(receiptsTable).where(and(eq(receiptsTable.id, id), eq(receiptsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetReceiptResponse.parse(serializeRow(row)));
});

router.patch("/receipts/:id", requirePermission("receipts.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateReceiptBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(receiptsTable).where(and(eq(receiptsTable.id, id), eq(receiptsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  // Governance: only a draft voucher can be edited; once posted it is immutable.
  if (existing.status !== "draft") { res.status(409).json({ error: "Only a draft receipt can be edited" }); return; }
  // `code` joins the list: the receipt number belongs to the sequence that
  // issued it, so an edit cannot rewrite it into another voucher's number.
  const update = omit(parsed.data, ["companyId", "status", "code"]);
  const [row] = Object.keys(update).length
    ? await db.update(receiptsTable).set(update).where(eq(receiptsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "receipt", entityId: id, oldValue: existing, newValue: row });
  res.json(GetReceiptResponse.parse(serializeRow(row)));
});

router.delete("/receipts/:id", requirePermission("receipts.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(receiptsTable).where(and(eq(receiptsTable.id, id), eq(receiptsTable.isDeleted, false))).for("update");
    if (!existing) return { notFound: true as const };
    // Governance: a posted/reversed voucher cannot be deleted (it has ledger effects). Reverse it instead.
    if (existing.status !== "draft" && existing.status !== "cancelled") return { conflict: "Only a draft receipt can be deleted; reverse a posted receipt instead" as const };
    await tx.update(receiptsTable).set({ isDeleted: true, isActive: false }).where(eq(receiptsTable.id, id));
    await tx.update(receiptAllocationsTable).set({ isDeleted: true, isActive: false }).where(eq(receiptAllocationsTable.receiptId, id));
    return { existing };
  });
  if ("notFound" in result) { res.status(404).json({ error: "Not found" }); return; }
  if ("conflict" in result) { res.status(409).json({ error: result.conflict }); return; }
  await recordAudit(req, { action: "delete", entity: "receipt", entityId: id, oldValue: result.existing });
  res.json({ success: true });
});

// Approve a draft receipt voucher (draft → approved). No ledger effects yet.
router.post("/receipts/:id/approve", requirePermission("receipts.approve"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const result = await db.transaction(async (tx) => {
    const [receipt] = await tx.select().from(receiptsTable).where(and(eq(receiptsTable.id, id), eq(receiptsTable.isDeleted, false))).for("update");
    if (!receipt) return { notFound: true as const };
    if (receipt.status !== "draft") return { conflict: "Only a draft receipt can be approved" as const };
    await tx.update(receiptsTable).set({ status: "approved", approvedAt: new Date(), approvedBy: req.authUser?.id ?? null }).where(eq(receiptsTable.id, id));
    const got = await loadReceipt(tx, id);
    return { got: got! };
  });
  if ("notFound" in result) { res.status(404).json({ error: "Not found" }); return; }
  if ("conflict" in result) { res.status(409).json({ error: result.conflict }); return; }
  await recordAudit(req, { action: "approve", entity: "receipt", entityId: id, newValue: result.got.receipt });
  res.json(ApproveReceiptResponse.parse(receiptDetail(result.got.receipt, result.got.allocations)));
});

// Post an approved receipt voucher (approved → posted): settle invoices/schedules, move cash/bank, post the ledger.
router.post("/receipts/:id/post", requirePermission("receipts.post"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  try {
    const result = await db.transaction(async (tx) => {
      const got = await (async () => {
        const [receipt] = await tx.select().from(receiptsTable).where(and(eq(receiptsTable.id, id), eq(receiptsTable.isDeleted, false))).for("update");
        if (!receipt) return null;
        const allocations = await tx.select().from(receiptAllocationsTable).where(and(eq(receiptAllocationsTable.receiptId, id), eq(receiptAllocationsTable.isDeleted, false)));
        return { receipt, allocations };
      })();
      if (!got) return { notFound: true as const };
      if (got.receipt.status !== "approved") return { conflict: "Only an approved receipt can be posted" as const };
      const journalEntryId = await applyReceiptPosting(tx, got.receipt, got.allocations, req.authUser?.id ?? null);
      await tx.update(receiptsTable).set({ status: "posted", postedAt: new Date(), postedBy: req.authUser?.id ?? null, journalEntryId }).where(eq(receiptsTable.id, id));
      const after = await loadReceipt(tx, id);
      return { got: after! };
    });
    if ("notFound" in result) { res.status(404).json({ error: "Not found" }); return; }
    if ("conflict" in result) { res.status(409).json({ error: result.conflict }); return; }
    await recordAudit(req, { action: "post", entity: "receipt", entityId: id, newValue: result.got.receipt });
    res.json(PostReceiptResponse.parse(receiptDetail(result.got.receipt, result.got.allocations)));
  } catch (e) {
    if (e instanceof PostingError) { res.status(e.status).json({ error: e.message }); return; }
    throw e;
  }
});

// Reverse a posted receipt voucher (posted → reversed): undo settlements + cash/bank, post a mirror entry.
router.post("/receipts/:id/reverse", requirePermission("receipts.reverse"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  try {
    const result = await db.transaction(async (tx) => {
      const got = await (async () => {
        const [receipt] = await tx.select().from(receiptsTable).where(and(eq(receiptsTable.id, id), eq(receiptsTable.isDeleted, false))).for("update");
        if (!receipt) return null;
        const allocations = await tx.select().from(receiptAllocationsTable).where(and(eq(receiptAllocationsTable.receiptId, id), eq(receiptAllocationsTable.isDeleted, false)));
        return { receipt, allocations };
      })();
      if (!got) return { notFound: true as const };
      if (got.receipt.status !== "posted") return { conflict: "Only a posted receipt can be reversed" as const };
      await reverseReceiptPosting(tx, got.receipt, got.allocations, req.authUser?.id ?? null);
      await tx.update(receiptsTable).set({ status: "reversed", reversedAt: new Date(), reversedBy: req.authUser?.id ?? null }).where(eq(receiptsTable.id, id));
      const after = await loadReceipt(tx, id);
      return { got: after! };
    });
    if ("notFound" in result) { res.status(404).json({ error: "Not found" }); return; }
    if ("conflict" in result) { res.status(409).json({ error: result.conflict }); return; }
    await recordAudit(req, { action: "reverse", entity: "receipt", entityId: id, newValue: result.got.receipt });
    res.json(ReverseReceiptResponse.parse(receiptDetail(result.got.receipt, result.got.allocations)));
  } catch (e) {
    if (e instanceof PostingError) { res.status(e.status).json({ error: e.message }); return; }
    throw e;
  }
});

// Cancel a draft/approved receipt voucher (→ cancelled). No ledger effects to undo.
router.post("/receipts/:id/cancel", requirePermission("receipts.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const result = await db.transaction(async (tx) => {
    const [receipt] = await tx.select().from(receiptsTable).where(and(eq(receiptsTable.id, id), eq(receiptsTable.isDeleted, false))).for("update");
    if (!receipt) return { notFound: true as const };
    if (receipt.status !== "draft" && receipt.status !== "approved") return { conflict: "Only a draft or approved receipt can be cancelled" as const };
    await tx.update(receiptsTable).set({ status: "cancelled", cancelledAt: new Date(), cancelledBy: req.authUser?.id ?? null }).where(eq(receiptsTable.id, id));
    const got = await loadReceipt(tx, id);
    return { got: got! };
  });
  if ("notFound" in result) { res.status(404).json({ error: "Not found" }); return; }
  if ("conflict" in result) { res.status(409).json({ error: result.conflict }); return; }
  await recordAudit(req, { action: "cancel", entity: "receipt", entityId: id, newValue: result.got.receipt });
  res.json(CancelReceiptResponse.parse(receiptDetail(result.got.receipt, result.got.allocations)));
});

// ===================== penalties (assessed) =====================
// POST /penalties/calculate must be declared before /penalties/:id GET is irrelevant (different method),
// but keep it above the param routes for clarity.
router.post("/penalties/calculate", requirePermission("penalties.create"), async (req, res): Promise<void> => {
  const parsed = CalculatePenaltiesBody.safeParse(req.body ?? {});
  const companyId = parsed.success ? parsed.data.companyId : undefined;
  const today = new Date().toISOString().slice(0, 10);

  const schedFilters: SQL[] = [
    eq(installmentSchedulesTable.isDeleted, false),
    ne(installmentSchedulesTable.status, "paid"),
    lt(installmentSchedulesTable.dueDate, today),
  ];
  if (companyId) schedFilters.push(eq(installmentSchedulesTable.companyId, companyId));
  const schedules = await db.select().from(installmentSchedulesTable).where(and(...schedFilters));

  const ruleFilters: SQL[] = [eq(penaltyRulesTable.isDeleted, false)];
  if (companyId) ruleFilters.push(eq(penaltyRulesTable.companyId, companyId));
  const rules = await db.select().from(penaltyRulesTable).where(and(...ruleFilters));

  let created = 0;
  let totalAmount = 0;
  for (const s of schedules) {
    const remaining = Number(s.amount) - Number(s.paidAmount);
    if (remaining <= 0) continue;
    const daysOverdue = Math.max(0, Math.floor((Date.parse(today) - Date.parse(s.dueDate)) / 86_400_000));
    for (const rule of rules) {
      if (daysOverdue < rule.daysAfterDue) continue;
      const [exists] = await db.select().from(assessedPenaltiesTable).where(and(
        eq(assessedPenaltiesTable.scheduleId, s.id),
        eq(assessedPenaltiesTable.ruleId, rule.id),
        eq(assessedPenaltiesTable.isDeleted, false),
      ));
      if (exists) continue;
      const isPercent = rule.penaltyType === "percent" || rule.penaltyType === "percentage";
      const amount = isPercent ? (remaining * Number(rule.penaltyValue)) / 100 : Number(rule.penaltyValue);
      const row = await db.transaction(async (tx) => {
        const [inserted] = await tx.insert(assessedPenaltiesTable).values({
          companyId: s.companyId, scheduleId: s.id, ruleId: rule.id,
          amount: amount.toFixed(2), daysOverdue, assessedDate: today, status: "pending",
        }).returning();
        // Auto-post penalty income (debit Accounts Receivable / credit Penalty
        // Income). Best-effort + idempotent per (assessedPenalty, id).
        await postAutomaticEntry(tx, {
          companyId: s.companyId,
          eventKey: "penalty.assessed",
          amount: inserted.amount,
          entryDate: today,
          description: `Penalty assessed for overdue installment`,
          sourceType: "assessedPenalty",
          sourceId: inserted.id,
          userId: req.authUser?.id ?? null,
        });
        return inserted;
      });
      created += 1;
      totalAmount += amount;
      await recordAudit(req, { action: "create", entity: "assessedPenalty", entityId: row.id, newValue: row });
    }
  }
  res.json(CalculatePenaltiesResponse.parse({ created, totalAmount: totalAmount.toFixed(2) }));
});

router.get("/penalties", requirePermission("penalties.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(assessedPenaltiesTable.isDeleted, false)];
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(assessedPenaltiesTable.companyId, companyId));
  const scheduleId = qStr(q, "scheduleId");
  if (scheduleId) filters.push(eq(assessedPenaltiesTable.scheduleId, scheduleId));
  const ruleId = qStr(q, "ruleId");
  if (ruleId) filters.push(eq(assessedPenaltiesTable.ruleId, ruleId));
  const status = qStr(q, "status");
  if (status) filters.push(eq(assessedPenaltiesTable.status, status));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(assessedPenaltiesTable).where(where);
  const rows = await db.select().from(assessedPenaltiesTable).where(where).orderBy(desc(assessedPenaltiesTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListPenaltiesResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/penalties", requirePermission("penalties.create"), async (req, res): Promise<void> => {
  const parsed = CreatePenaltyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const row = await db.transaction(async (tx) => {
    const [inserted] = await tx.insert(assessedPenaltiesTable).values({ ...parsed.data }).returning();
    await postAutomaticEntry(tx, {
      companyId: inserted.companyId,
      eventKey: "penalty.assessed",
      amount: inserted.amount,
      entryDate: inserted.assessedDate ?? new Date().toISOString().slice(0, 10),
      description: `Penalty assessed`,
      sourceType: "assessedPenalty",
      sourceId: inserted.id,
      userId: req.authUser?.id ?? null,
    });
    return inserted;
  });
  await recordAudit(req, { action: "create", entity: "assessedPenalty", entityId: row.id, newValue: row });
  res.status(201).json(GetPenaltyResponse.parse(serializeRow(row)));
});

router.get("/penalties/:id", requirePermission("penalties.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(assessedPenaltiesTable).where(and(eq(assessedPenaltiesTable.id, id), eq(assessedPenaltiesTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetPenaltyResponse.parse(serializeRow(row)));
});

router.patch("/penalties/:id", requirePermission("penalties.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdatePenaltyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(assessedPenaltiesTable).where(and(eq(assessedPenaltiesTable.id, id), eq(assessedPenaltiesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(assessedPenaltiesTable).set(update).where(eq(assessedPenaltiesTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "assessedPenalty", entityId: id, oldValue: existing, newValue: row });
  res.json(GetPenaltyResponse.parse(serializeRow(row)));
});

router.delete("/penalties/:id", requirePermission("penalties.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const row = await db.transaction(async (tx) => {
    const [deleted] = await tx.update(assessedPenaltiesTable).set({ isDeleted: true, isActive: false }).where(and(eq(assessedPenaltiesTable.id, id), eq(assessedPenaltiesTable.isDeleted, false))).returning();
    if (!deleted) return null;
    await reverseAutomaticEntriesForSource(tx, "assessedPenalty", id, req.authUser?.id ?? null);
    return deleted;
  });
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "assessedPenalty", entityId: id });
  res.json({ success: true });
});

// ===================== financial dashboard =====================
router.get("/finance/dashboard", async (req, res): Promise<void> => {
  const companyId = qStr(req.query as Record<string, unknown>, "companyId");
  const today = new Date().toISOString().slice(0, 10);

  const contractWhere = and(eq(contractsTable.isDeleted, false), ...(companyId ? [eq(contractsTable.companyId, companyId)] : []));
  const [{ totalSales }] = await db.select({ totalSales: sql<string>`coalesce(sum(${contractsTable.totalPrice}),0)::text` }).from(contractsTable).where(contractWhere);

  const receiptWhere = and(eq(receiptsTable.isDeleted, false), ne(receiptsTable.status, "cancelled"), ...(companyId ? [eq(receiptsTable.companyId, companyId)] : []));
  const [{ totalCollections, receiptCount }] = await db.select({
    totalCollections: sql<string>`coalesce(sum(${receiptsTable.amount}),0)::text`,
    receiptCount: sql<number>`count(*)::int`,
  }).from(receiptsTable).where(receiptWhere);

  const outstandingWhere = and(eq(installmentSchedulesTable.isDeleted, false), ne(installmentSchedulesTable.status, "paid"), ...(companyId ? [eq(installmentSchedulesTable.companyId, companyId)] : []));
  const [{ outstanding }] = await db.select({ outstanding: sql<string>`coalesce(sum(${installmentSchedulesTable.amount} - ${installmentSchedulesTable.paidAmount}),0)::text` }).from(installmentSchedulesTable).where(outstandingWhere);

  const overdueWhere = and(eq(installmentSchedulesTable.isDeleted, false), ne(installmentSchedulesTable.status, "paid"), lt(installmentSchedulesTable.dueDate, today), ...(companyId ? [eq(installmentSchedulesTable.companyId, companyId)] : []));
  const [{ overdue }] = await db.select({ overdue: sql<string>`coalesce(sum(${installmentSchedulesTable.amount} - ${installmentSchedulesTable.paidAmount}),0)::text` }).from(installmentSchedulesTable).where(overdueWhere);

  const cashboxWhere = and(eq(cashboxesTable.isDeleted, false), ...(companyId ? [eq(cashboxesTable.companyId, companyId)] : []));
  const [{ treasuryBalance }] = await db.select({ treasuryBalance: sql<string>`coalesce(sum(${cashboxesTable.currentBalance}),0)::text` }).from(cashboxesTable).where(cashboxWhere);

  const bankWhere = and(eq(bankAccountsTable.isDeleted, false), ...(companyId ? [eq(bankAccountsTable.companyId, companyId)] : []));
  const [{ bankBalance }] = await db.select({ bankBalance: sql<string>`coalesce(sum(${bankAccountsTable.currentBalance}),0)::text` }).from(bankAccountsTable).where(bankWhere);

  const penaltyWhere = and(eq(assessedPenaltiesTable.isDeleted, false), eq(assessedPenaltiesTable.status, "pending"), ...(companyId ? [eq(assessedPenaltiesTable.companyId, companyId)] : []));
  const [{ pendingPenalties }] = await db.select({ pendingPenalties: sql<number>`count(*)::int` }).from(assessedPenaltiesTable).where(penaltyWhere);

  res.json(GetFinanceDashboardResponse.parse({
    totalSales,
    totalCollections,
    outstandingInstallments: outstanding,
    overdueAmount: overdue,
    treasuryBalance,
    bankBalance,
    receipts: receiptCount,
    pendingPenalties,
  }));
});

export default router;
