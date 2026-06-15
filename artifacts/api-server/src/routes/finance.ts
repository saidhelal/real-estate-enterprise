import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, lt, ne, or, sql, type SQL } from "drizzle-orm";
import {
  db,
  cashboxesTable,
  treasuryTransactionsTable,
  bankAccountsTable,
  bankTransactionsTable,
  receiptsTable,
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
import { requireAuth, requirePermission } from "../middleware/auth";
import { postAutomaticEntry, reverseAutomaticEntriesForSource } from "../lib/posting";

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

router.post("/receipts", requirePermission("receipts.create"), async (req, res): Promise<void> => {
  const parsed = CreateReceiptBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;
  const amount = validAmount(data.amount);
  if (amount === null) { res.status(400).json({ error: "Invalid amount" }); return; }
  const row = await db.transaction(async (tx) => {
    const [created] = await tx.insert(receiptsTable).values({ ...data, userId: req.authUser?.id ?? null }).returning();

    // Only a confirmed receipt posts to the ledger/schedule. Non-confirmed (e.g. draft/cancelled)
    // receipts record nothing financial — keeping POST and DELETE symmetric on `status === "confirmed"`.
    if (created.status === "confirmed") {
      if (data.scheduleId) {
        // Atomic increment + status recompute in a single UPDATE to avoid lost updates under concurrency.
        await tx.update(installmentSchedulesTable).set({
          paidAmount: sql`${installmentSchedulesTable.paidAmount} + ${amount}::numeric`,
          status: sql`CASE
            WHEN ${installmentSchedulesTable.paidAmount} + ${amount}::numeric >= ${installmentSchedulesTable.amount} THEN 'paid'
            WHEN ${installmentSchedulesTable.paidAmount} + ${amount}::numeric > 0 THEN 'partial'
            ELSE ${installmentSchedulesTable.status} END`,
        }).where(and(eq(installmentSchedulesTable.id, data.scheduleId), eq(installmentSchedulesTable.isDeleted, false)));
      }

      if (data.paymentMethod === "cash" && data.cashboxId) {
        await tx.insert(treasuryTransactionsTable).values({
          companyId: data.companyId, cashboxId: data.cashboxId, type: "in", amount,
          transactionDate: data.receiptDate, reference: created.code, description: "Receipt collection",
          receiptId: created.id, userId: req.authUser?.id ?? null,
        });
        await tx.update(cashboxesTable)
          .set({ currentBalance: sql`${cashboxesTable.currentBalance} + ${amount}::numeric` })
          .where(eq(cashboxesTable.id, data.cashboxId));
      } else if (data.paymentMethod === "bank_transfer" && data.bankAccountId) {
        await tx.insert(bankTransactionsTable).values({
          companyId: data.companyId, bankAccountId: data.bankAccountId, type: "in", amount,
          transactionDate: data.receiptDate, reference: created.code, description: "Receipt collection",
          receiptId: created.id, userId: req.authUser?.id ?? null,
        });
        await tx.update(bankAccountsTable)
          .set({ currentBalance: sql`${bankAccountsTable.currentBalance} + ${amount}::numeric` })
          .where(eq(bankAccountsTable.id, data.bankAccountId));
      }

      // Automatic ledger posting (best-effort; skipped if accounting is unconfigured).
      const eventKey = (data.paymentMethod ? RECEIPT_EVENT[data.paymentMethod] : undefined) ?? "receipt.bank";
      await postAutomaticEntry(tx, {
        companyId: data.companyId,
        branchId: data.branchId ?? null,
        eventKey,
        amount,
        entryDate: data.receiptDate,
        description: `Receipt ${created.code}`,
        reference: created.code,
        sourceType: "receipt",
        sourceId: created.id,
        userId: req.authUser?.id ?? null,
      });
    }
    return created;
  });
  await recordAudit(req, { action: "create", entity: "receipt", entityId: row.id, newValue: row });
  res.status(201).json(GetReceiptResponse.parse(serializeRow(row)));
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
  // A posted receipt's financial fields are immutable (they drive ledger + schedule); only descriptive
  // fields may change. To reverse a receipt's financial effect, delete it (which compensates the ledger).
  const update = omit(parsed.data, ["amount", "companyId", "customerId", "contractId", "scheduleId", "paymentMethod", "cashboxId", "bankAccountId", "status"]);
  const [row] = Object.keys(update).length
    ? await db.update(receiptsTable).set(update).where(eq(receiptsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "receipt", entityId: id, oldValue: existing, newValue: row });
  res.json(GetReceiptResponse.parse(serializeRow(row)));
});

router.delete("/receipts/:id", requirePermission("receipts.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const row = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(receiptsTable).where(and(eq(receiptsTable.id, id), eq(receiptsTable.isDeleted, false)));
    if (!existing) return null;
    await tx.update(receiptsTable).set({ isDeleted: true, isActive: false }).where(eq(receiptsTable.id, id));
    // Only confirmed receipts ever posted to the ledger/schedule, so only those need compensating.
    // `status` is immutable via PATCH, so this matches exactly what was posted at create time.
    if (existing.status === "confirmed") {
      const amount = amountOrThrow(existing.amount);
      if (existing.scheduleId) {
        await tx.update(installmentSchedulesTable).set({
          paidAmount: sql`GREATEST(${installmentSchedulesTable.paidAmount} - ${amount}::numeric, 0)`,
          status: sql`CASE
            WHEN ${installmentSchedulesTable.paidAmount} - ${amount}::numeric >= ${installmentSchedulesTable.amount} THEN 'paid'
            WHEN ${installmentSchedulesTable.paidAmount} - ${amount}::numeric > 0 THEN 'partial'
            ELSE 'pending' END`,
        }).where(and(eq(installmentSchedulesTable.id, existing.scheduleId), eq(installmentSchedulesTable.isDeleted, false)));
      }
      if (existing.paymentMethod === "cash" && existing.cashboxId) {
        await tx.update(cashboxesTable).set({ currentBalance: sql`${cashboxesTable.currentBalance} - ${amount}::numeric` }).where(eq(cashboxesTable.id, existing.cashboxId));
        await tx.update(treasuryTransactionsTable).set({ isDeleted: true, isActive: false }).where(and(eq(treasuryTransactionsTable.receiptId, existing.id), eq(treasuryTransactionsTable.isDeleted, false)));
      } else if (existing.paymentMethod === "bank_transfer" && existing.bankAccountId) {
        await tx.update(bankAccountsTable).set({ currentBalance: sql`${bankAccountsTable.currentBalance} - ${amount}::numeric` }).where(eq(bankAccountsTable.id, existing.bankAccountId));
        await tx.update(bankTransactionsTable).set({ isDeleted: true, isActive: false }).where(and(eq(bankTransactionsTable.receiptId, existing.id), eq(bankTransactionsTable.isDeleted, false)));
      }
      // Reverse any automatic ledger entries posted for this receipt.
      await reverseAutomaticEntriesForSource(tx, "receipt", existing.id, req.authUser?.id ?? null);
    }
    return existing;
  });
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "receipt", entityId: id, oldValue: row });
  res.json({ success: true });
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
      const [row] = await db.insert(assessedPenaltiesTable).values({
        companyId: s.companyId, scheduleId: s.id, ruleId: rule.id,
        amount: amount.toFixed(2), daysOverdue, assessedDate: today, status: "pending",
      }).returning();
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
  const [row] = await db.insert(assessedPenaltiesTable).values({ ...parsed.data }).returning();
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
  const [row] = await db.update(assessedPenaltiesTable).set({ isDeleted: true, isActive: false }).where(and(eq(assessedPenaltiesTable.id, id), eq(assessedPenaltiesTable.isDeleted, false))).returning();
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
