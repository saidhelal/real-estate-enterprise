import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, inArray, lt, lte, gte, or, sql, type SQL } from "drizzle-orm";
import {
  db,
  accountsTable,
  costCentersTable,
  profitCentersTable,
  fiscalPeriodsTable,
  fiscalYearsTable,
  journalEntriesTable,
  journalEntryLinesTable,
  accountMappingsTable,
  budgetsTable,
  budgetLinesTable,
} from "@workspace/db";
import {
  ListAccountsResponse,
  CreateAccountBody,
  GetAccountResponse,
  UpdateAccountBody,
  ListCostCentersResponse,
  CreateCostCenterBody,
  GetCostCenterResponse,
  UpdateCostCenterBody,
  ListProfitCentersResponse,
  CreateProfitCenterBody,
  GetProfitCenterResponse,
  UpdateProfitCenterBody,
  ListFiscalPeriodsResponse,
  CreateFiscalPeriodBody,
  GetFiscalPeriodResponse,
  UpdateFiscalPeriodBody,
  ListAccountMappingsResponse,
  CreateAccountMappingBody,
  GetAccountMappingResponse,
  UpdateAccountMappingBody,
  ListBudgetsResponse,
  CreateBudgetBody,
  GetBudgetResponse,
  UpdateBudgetBody,
  ListBudgetLinesResponse,
  CreateBudgetLineBody,
  GetBudgetLineResponse,
  UpdateBudgetLineBody,
  ListJournalEntriesResponse,
  CreateJournalEntryBody,
  GetJournalEntryResponse,
  UpdateJournalEntryBody,
  ReverseJournalEntryBody,
  GetGeneralLedgerResponse,
  GetTrialBalanceResponse,
  GetBalanceSheetResponse,
  GetIncomeStatementResponse,
  GetCashFlowResponse,
  GetBudgetVsActualResponse,
  GetAccountingDashboardResponse,
  RecordReportExportBody,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";
import { toCents, fromCents } from "../lib/money";
import {
  PostingError,
  createEntry,
  setEntryLines,
  postEntry,
  reverseEntry,
  approveEntry,
} from "../lib/posting";

const router: IRouter = Router();
router.use(requireAuth);

function uid(req: { authUser?: { id: string } }): string | null {
  return req.authUser?.id ?? null;
}

// Map a PostingError to an HTTP response; rethrow anything else.
function handlePostingError(err: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }): boolean {
  if (err instanceof PostingError) {
    res.status(err.status).json({ error: err.message });
    return true;
  }
  return false;
}

// Load journal entry with its lines, serialized for the API.
async function loadEntryDetail(id: string) {
  const [entry] = await db
    .select()
    .from(journalEntriesTable)
    .where(and(eq(journalEntriesTable.id, id), eq(journalEntriesTable.isDeleted, false)));
  if (!entry) return null;
  const lines = await db
    .select()
    .from(journalEntryLinesTable)
    .where(and(eq(journalEntryLinesTable.entryId, id), eq(journalEntryLinesTable.isDeleted, false)))
    .orderBy(journalEntryLinesTable.lineNumber);
  return { ...serializeRow(entry), lines: lines.map(serializeRow) };
}

// =====================================================================
// Chart of accounts
// =====================================================================
router.get("/accounts", requirePermission("accounts.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(accountsTable.isDeleted, false)];
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(accountsTable.companyId, companyId));
  const type = qStr(q, "type");
  if (type) filters.push(eq(accountsTable.type, type));
  const parentId = qStr(q, "parentId");
  if (parentId) filters.push(eq(accountsTable.parentId, parentId));
  const status = qStr(q, "status");
  if (status) filters.push(eq(accountsTable.status, status));
  const isPostable = qStr(q, "isPostable");
  if (isPostable === "true" || isPostable === "false") filters.push(eq(accountsTable.isPostable, isPostable === "true"));
  const search = qStr(q, "search");
  if (search) {
    const term = `%${search}%`;
    const m = or(ilike(accountsTable.code, term), ilike(accountsTable.name, term), ilike(accountsTable.nameAr, term));
    if (m) filters.push(m);
  }
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(accountsTable).where(where);
  const rows = await db.select().from(accountsTable).where(where).orderBy(accountsTable.code).limit(pageSize).offset(offset);
  res.json(ListAccountsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/accounts", requirePermission("accounts.create"), async (req, res): Promise<void> => {
  const parsed = CreateAccountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(accountsTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "account", entityId: row.id, newValue: row });
  res.status(201).json(GetAccountResponse.parse(serializeRow(row)));
});

router.get("/accounts/:id", requirePermission("accounts.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(accountsTable).where(and(eq(accountsTable.id, id), eq(accountsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetAccountResponse.parse(serializeRow(row)));
});

router.patch("/accounts/:id", requirePermission("accounts.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateAccountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(accountsTable).where(and(eq(accountsTable.id, id), eq(accountsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(accountsTable).set(update).where(eq(accountsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "account", entityId: id, oldValue: existing, newValue: row });
  res.json(GetAccountResponse.parse(serializeRow(row)));
});

router.delete("/accounts/:id", requirePermission("accounts.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  // Block deletion if the account has posted activity or child accounts.
  const [child] = await db.select({ id: accountsTable.id }).from(accountsTable).where(and(eq(accountsTable.parentId, id), eq(accountsTable.isDeleted, false)));
  if (child) { res.status(409).json({ error: "Cannot delete an account with child accounts" }); return; }
  const [line] = await db.select({ id: journalEntryLinesTable.id }).from(journalEntryLinesTable).where(and(eq(journalEntryLinesTable.accountId, id), eq(journalEntryLinesTable.isDeleted, false)));
  if (line) { res.status(409).json({ error: "Cannot delete an account that has journal activity" }); return; }
  const [row] = await db.update(accountsTable).set({ isDeleted: true, isActive: false }).where(and(eq(accountsTable.id, id), eq(accountsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "account", entityId: id });
  res.json({ success: true });
});

// =====================================================================
// Cost centers
// =====================================================================
router.get("/cost-centers", requirePermission("costCenters.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(costCentersTable.isDeleted, false)];
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(costCentersTable.companyId, companyId));
  const kind = qStr(q, "kind");
  if (kind) filters.push(eq(costCentersTable.kind, kind));
  const parentId = qStr(q, "parentId");
  if (parentId) filters.push(eq(costCentersTable.parentId, parentId));
  const status = qStr(q, "status");
  if (status) filters.push(eq(costCentersTable.status, status));
  const search = qStr(q, "search");
  if (search) {
    const term = `%${search}%`;
    const m = or(ilike(costCentersTable.code, term), ilike(costCentersTable.name, term), ilike(costCentersTable.nameAr, term));
    if (m) filters.push(m);
  }
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(costCentersTable).where(where);
  const rows = await db.select().from(costCentersTable).where(where).orderBy(costCentersTable.code).limit(pageSize).offset(offset);
  res.json(ListCostCentersResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/cost-centers", requirePermission("costCenters.create"), async (req, res): Promise<void> => {
  const parsed = CreateCostCenterBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(costCentersTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "costCenter", entityId: row.id, newValue: row });
  res.status(201).json(GetCostCenterResponse.parse(serializeRow(row)));
});

router.get("/cost-centers/:id", requirePermission("costCenters.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(costCentersTable).where(and(eq(costCentersTable.id, id), eq(costCentersTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetCostCenterResponse.parse(serializeRow(row)));
});

router.patch("/cost-centers/:id", requirePermission("costCenters.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateCostCenterBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(costCentersTable).where(and(eq(costCentersTable.id, id), eq(costCentersTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(costCentersTable).set(update).where(eq(costCentersTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "costCenter", entityId: id, oldValue: existing, newValue: row });
  res.json(GetCostCenterResponse.parse(serializeRow(row)));
});

router.delete("/cost-centers/:id", requirePermission("costCenters.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(costCentersTable).set({ isDeleted: true, isActive: false }).where(and(eq(costCentersTable.id, id), eq(costCentersTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "costCenter", entityId: id });
  res.json({ success: true });
});

// =====================================================================
// Profit centers (revenue/profitability segments; mirrors cost centers)
// =====================================================================
router.get("/profit-centers", requirePermission("profitCenters.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(profitCentersTable.isDeleted, false)];
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(profitCentersTable.companyId, companyId));
  const kind = qStr(q, "kind");
  if (kind) filters.push(eq(profitCentersTable.kind, kind));
  const parentId = qStr(q, "parentId");
  if (parentId) filters.push(eq(profitCentersTable.parentId, parentId));
  const status = qStr(q, "status");
  if (status) filters.push(eq(profitCentersTable.status, status));
  const search = qStr(q, "search");
  if (search) {
    const term = `%${search}%`;
    const m = or(ilike(profitCentersTable.code, term), ilike(profitCentersTable.name, term), ilike(profitCentersTable.nameAr, term));
    if (m) filters.push(m);
  }
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(profitCentersTable).where(where);
  const rows = await db.select().from(profitCentersTable).where(where).orderBy(profitCentersTable.code).limit(pageSize).offset(offset);
  res.json(ListProfitCentersResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/profit-centers", requirePermission("profitCenters.create"), async (req, res): Promise<void> => {
  const parsed = CreateProfitCenterBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(profitCentersTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "profitCenter", entityId: row.id, newValue: row });
  res.status(201).json(GetProfitCenterResponse.parse(serializeRow(row)));
});

router.get("/profit-centers/:id", requirePermission("profitCenters.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(profitCentersTable).where(and(eq(profitCentersTable.id, id), eq(profitCentersTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetProfitCenterResponse.parse(serializeRow(row)));
});

router.patch("/profit-centers/:id", requirePermission("profitCenters.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateProfitCenterBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(profitCentersTable).where(and(eq(profitCentersTable.id, id), eq(profitCentersTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(profitCentersTable).set(update).where(eq(profitCentersTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "profitCenter", entityId: id, oldValue: existing, newValue: row });
  res.json(GetProfitCenterResponse.parse(serializeRow(row)));
});

router.delete("/profit-centers/:id", requirePermission("profitCenters.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(profitCentersTable).set({ isDeleted: true, isActive: false }).where(and(eq(profitCentersTable.id, id), eq(profitCentersTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "profitCenter", entityId: id });
  res.json({ success: true });
});

// =====================================================================
// Fiscal periods
// =====================================================================
router.get("/fiscal-periods", requirePermission("fiscalPeriods.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(fiscalPeriodsTable.isDeleted, false)];
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(fiscalPeriodsTable.companyId, companyId));
  const fiscalYearId = qStr(q, "fiscalYearId");
  if (fiscalYearId) filters.push(eq(fiscalPeriodsTable.fiscalYearId, fiscalYearId));
  const status = qStr(q, "status");
  if (status) filters.push(eq(fiscalPeriodsTable.status, status));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(fiscalPeriodsTable).where(where);
  const rows = await db.select().from(fiscalPeriodsTable).where(where).orderBy(fiscalPeriodsTable.startDate).limit(pageSize).offset(offset);
  res.json(ListFiscalPeriodsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/fiscal-periods", requirePermission("fiscalPeriods.create"), async (req, res): Promise<void> => {
  const parsed = CreateFiscalPeriodBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(fiscalPeriodsTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "fiscalPeriod", entityId: row.id, newValue: row });
  res.status(201).json(GetFiscalPeriodResponse.parse(serializeRow(row)));
});

router.get("/fiscal-periods/:id", requirePermission("fiscalPeriods.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(fiscalPeriodsTable).where(and(eq(fiscalPeriodsTable.id, id), eq(fiscalPeriodsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetFiscalPeriodResponse.parse(serializeRow(row)));
});

router.patch("/fiscal-periods/:id", requirePermission("fiscalPeriods.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateFiscalPeriodBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(fiscalPeriodsTable).where(and(eq(fiscalPeriodsTable.id, id), eq(fiscalPeriodsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(fiscalPeriodsTable).set(update).where(eq(fiscalPeriodsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "fiscalPeriod", entityId: id, oldValue: existing, newValue: row });
  res.json(GetFiscalPeriodResponse.parse(serializeRow(row)));
});

router.delete("/fiscal-periods/:id", requirePermission("fiscalPeriods.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(fiscalPeriodsTable).set({ isDeleted: true, isActive: false }).where(and(eq(fiscalPeriodsTable.id, id), eq(fiscalPeriodsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "fiscalPeriod", entityId: id });
  res.json({ success: true });
});

router.post("/fiscal-periods/:id/close", requirePermission("fiscalPeriods.close"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [existing] = await db.select().from(fiscalPeriodsTable).where(and(eq(fiscalPeriodsTable.id, id), eq(fiscalPeriodsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status === "closed") { res.status(409).json({ error: "Period is already closed" }); return; }
  const [row] = await db.update(fiscalPeriodsTable).set({ status: "closed", closedAt: new Date(), closedBy: uid(req) }).where(eq(fiscalPeriodsTable.id, id)).returning();
  await recordAudit(req, { action: "update", entity: "fiscalPeriod", entityId: id, oldValue: existing, newValue: row });
  res.json(GetFiscalPeriodResponse.parse(serializeRow(row)));
});

router.post("/fiscal-periods/:id/reopen", requirePermission("fiscalPeriods.reopen"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [existing] = await db.select().from(fiscalPeriodsTable).where(and(eq(fiscalPeriodsTable.id, id), eq(fiscalPeriodsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status !== "closed") { res.status(409).json({ error: "Only a closed period can be reopened" }); return; }
  const [row] = await db.update(fiscalPeriodsTable).set({ status: "open", closedAt: null, closedBy: null }).where(eq(fiscalPeriodsTable.id, id)).returning();
  await recordAudit(req, { action: "update", entity: "fiscalPeriod", entityId: id, oldValue: existing, newValue: row });
  res.json(GetFiscalPeriodResponse.parse(serializeRow(row)));
});

// =====================================================================
// Account mappings
// =====================================================================
router.get("/account-mappings", requirePermission("accountMappings.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(accountMappingsTable.isDeleted, false)];
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(accountMappingsTable.companyId, companyId));
  const eventKey = qStr(q, "eventKey");
  if (eventKey) filters.push(eq(accountMappingsTable.eventKey, eventKey));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(accountMappingsTable).where(where);
  const rows = await db.select().from(accountMappingsTable).where(where).orderBy(accountMappingsTable.eventKey).limit(pageSize).offset(offset);
  res.json(ListAccountMappingsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/account-mappings", requirePermission("accountMappings.create"), async (req, res): Promise<void> => {
  const parsed = CreateAccountMappingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(accountMappingsTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "accountMapping", entityId: row.id, newValue: row });
  res.status(201).json(GetAccountMappingResponse.parse(serializeRow(row)));
});

router.get("/account-mappings/:id", requirePermission("accountMappings.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(accountMappingsTable).where(and(eq(accountMappingsTable.id, id), eq(accountMappingsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetAccountMappingResponse.parse(serializeRow(row)));
});

router.patch("/account-mappings/:id", requirePermission("accountMappings.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateAccountMappingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(accountMappingsTable).where(and(eq(accountMappingsTable.id, id), eq(accountMappingsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(accountMappingsTable).set(update).where(eq(accountMappingsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "accountMapping", entityId: id, oldValue: existing, newValue: row });
  res.json(GetAccountMappingResponse.parse(serializeRow(row)));
});

router.delete("/account-mappings/:id", requirePermission("accountMappings.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(accountMappingsTable).set({ isDeleted: true, isActive: false }).where(and(eq(accountMappingsTable.id, id), eq(accountMappingsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "accountMapping", entityId: id });
  res.json({ success: true });
});

// =====================================================================
// Budgets
// =====================================================================
router.get("/budgets", requirePermission("budgets.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(budgetsTable.isDeleted, false)];
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(budgetsTable.companyId, companyId));
  const fiscalYearId = qStr(q, "fiscalYearId");
  if (fiscalYearId) filters.push(eq(budgetsTable.fiscalYearId, fiscalYearId));
  const status = qStr(q, "status");
  if (status) filters.push(eq(budgetsTable.status, status));
  const search = qStr(q, "search");
  if (search) {
    const term = `%${search}%`;
    const m = or(ilike(budgetsTable.code, term), ilike(budgetsTable.name, term), ilike(budgetsTable.nameAr, term));
    if (m) filters.push(m);
  }
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(budgetsTable).where(where);
  const rows = await db.select().from(budgetsTable).where(where).orderBy(desc(budgetsTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListBudgetsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/budgets", requirePermission("budgets.create"), async (req, res): Promise<void> => {
  const parsed = CreateBudgetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(budgetsTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "budget", entityId: row.id, newValue: row });
  res.status(201).json(GetBudgetResponse.parse(serializeRow(row)));
});

router.get("/budgets/:id", requirePermission("budgets.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(budgetsTable).where(and(eq(budgetsTable.id, id), eq(budgetsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetBudgetResponse.parse(serializeRow(row)));
});

router.patch("/budgets/:id", requirePermission("budgets.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateBudgetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(budgetsTable).where(and(eq(budgetsTable.id, id), eq(budgetsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(budgetsTable).set(update).where(eq(budgetsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "budget", entityId: id, oldValue: existing, newValue: row });
  res.json(GetBudgetResponse.parse(serializeRow(row)));
});

router.delete("/budgets/:id", requirePermission("budgets.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(budgetsTable).set({ isDeleted: true, isActive: false }).where(and(eq(budgetsTable.id, id), eq(budgetsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await db.update(budgetLinesTable).set({ isDeleted: true, isActive: false }).where(eq(budgetLinesTable.budgetId, id));
  await recordAudit(req, { action: "delete", entity: "budget", entityId: id });
  res.json({ success: true });
});

// =====================================================================
// Budget lines
// =====================================================================
router.get("/budget-lines", requirePermission("budgets.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(budgetLinesTable.isDeleted, false)];
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(budgetLinesTable.companyId, companyId));
  const budgetId = qStr(q, "budgetId");
  if (budgetId) filters.push(eq(budgetLinesTable.budgetId, budgetId));
  const accountId = qStr(q, "accountId");
  if (accountId) filters.push(eq(budgetLinesTable.accountId, accountId));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(budgetLinesTable).where(where);
  const rows = await db.select().from(budgetLinesTable).where(where).orderBy(desc(budgetLinesTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListBudgetLinesResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/budget-lines", requirePermission("budgets.create"), async (req, res): Promise<void> => {
  const parsed = CreateBudgetLineBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(budgetLinesTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "budgetLine", entityId: row.id, newValue: row });
  res.status(201).json(GetBudgetLineResponse.parse(serializeRow(row)));
});

router.get("/budget-lines/:id", requirePermission("budgets.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(budgetLinesTable).where(and(eq(budgetLinesTable.id, id), eq(budgetLinesTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetBudgetLineResponse.parse(serializeRow(row)));
});

router.patch("/budget-lines/:id", requirePermission("budgets.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateBudgetLineBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(budgetLinesTable).where(and(eq(budgetLinesTable.id, id), eq(budgetLinesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(budgetLinesTable).set(update).where(eq(budgetLinesTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "budgetLine", entityId: id, oldValue: existing, newValue: row });
  res.json(GetBudgetLineResponse.parse(serializeRow(row)));
});

router.delete("/budget-lines/:id", requirePermission("budgets.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(budgetLinesTable).set({ isDeleted: true, isActive: false }).where(and(eq(budgetLinesTable.id, id), eq(budgetLinesTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "budgetLine", entityId: id });
  res.json({ success: true });
});

// =====================================================================
// Journal entries
// =====================================================================
router.get("/journal-entries", requirePermission("journalEntries.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(journalEntriesTable.isDeleted, false)];
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(journalEntriesTable.companyId, companyId));
  const status = qStr(q, "status");
  if (status) filters.push(eq(journalEntriesTable.status, status));
  const sourceType = qStr(q, "sourceType");
  if (sourceType) filters.push(eq(journalEntriesTable.sourceType, sourceType));
  const fiscalPeriodId = qStr(q, "fiscalPeriodId");
  if (fiscalPeriodId) filters.push(eq(journalEntriesTable.fiscalPeriodId, fiscalPeriodId));
  const fromDate = qStr(q, "fromDate");
  if (fromDate) filters.push(gte(journalEntriesTable.entryDate, fromDate));
  const toDate = qStr(q, "toDate");
  if (toDate) filters.push(lte(journalEntriesTable.entryDate, toDate));
  const search = qStr(q, "search");
  if (search) {
    const term = `%${search}%`;
    const m = or(ilike(journalEntriesTable.number, term), ilike(journalEntriesTable.description, term), ilike(journalEntriesTable.reference, term));
    if (m) filters.push(m);
  }
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(journalEntriesTable).where(where);
  const rows = await db.select().from(journalEntriesTable).where(where).orderBy(desc(journalEntriesTable.entryDate), desc(journalEntriesTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListJournalEntriesResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/journal-entries", requirePermission("journalEntries.create"), async (req, res): Promise<void> => {
  const parsed = CreateJournalEntryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const body = parsed.data;
  try {
    const entry = await db.transaction((tx) =>
      createEntry(tx, {
        companyId: body.companyId,
        branchId: body.branchId ?? null,
        entryDate: body.entryDate,
        fiscalPeriodId: body.fiscalPeriodId ?? null,
        description: body.description ?? null,
        descriptionAr: body.descriptionAr ?? null,
        reference: body.reference ?? null,
        userId: uid(req),
        lines: (body.lines ?? []).map((l) => ({
          accountId: l.accountId,
          costCenterId: l.costCenterId ?? null,
          debit: l.debit ?? "0",
          credit: l.credit ?? "0",
          description: l.description ?? null,
        })),
      }),
    );
    await recordAudit(req, { action: "create", entity: "journalEntry", entityId: entry.id, newValue: entry });
    const detail = await loadEntryDetail(entry.id);
    res.status(201).json(GetJournalEntryResponse.parse(detail));
  } catch (err) {
    if (handlePostingError(err, res)) return;
    throw err;
  }
});

router.get("/journal-entries/:id", requirePermission("journalEntries.view"), async (req, res): Promise<void> => {
  const detail = await loadEntryDetail(String(req.params.id));
  if (!detail) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetJournalEntryResponse.parse(detail));
});

router.patch("/journal-entries/:id", requirePermission("journalEntries.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateJournalEntryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const body = parsed.data;
  const [existing] = await db.select().from(journalEntriesTable).where(and(eq(journalEntriesTable.id, id), eq(journalEntriesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status !== "draft") { res.status(409).json({ error: "Only a draft entry can be edited" }); return; }
  try {
    await db.transaction(async (tx) => {
      const header: Record<string, unknown> = {};
      if (body.branchId !== undefined) header.branchId = body.branchId;
      if (body.entryDate !== undefined) header.entryDate = body.entryDate;
      if (body.fiscalPeriodId !== undefined) header.fiscalPeriodId = body.fiscalPeriodId;
      if (body.description !== undefined) header.description = body.description;
      if (body.descriptionAr !== undefined) header.descriptionAr = body.descriptionAr;
      if (body.reference !== undefined) header.reference = body.reference;
      if (Object.keys(header).length) {
        await tx.update(journalEntriesTable).set(header).where(eq(journalEntriesTable.id, id));
      }
      if (body.lines) {
        await setEntryLines(tx, existing, body.lines.map((l) => ({
          accountId: l.accountId,
          costCenterId: l.costCenterId ?? null,
          debit: l.debit ?? "0",
          credit: l.credit ?? "0",
          description: l.description ?? null,
        })));
      }
    });
    await recordAudit(req, { action: "update", entity: "journalEntry", entityId: id, oldValue: existing });
    const detail = await loadEntryDetail(id);
    res.json(GetJournalEntryResponse.parse(detail));
  } catch (err) {
    if (handlePostingError(err, res)) return;
    throw err;
  }
});

router.delete("/journal-entries/:id", requirePermission("journalEntries.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [existing] = await db.select().from(journalEntriesTable).where(and(eq(journalEntriesTable.id, id), eq(journalEntriesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status !== "draft") { res.status(409).json({ error: "Only a draft entry can be deleted; post/reverse it instead" }); return; }
  await db.transaction(async (tx) => {
    await tx.update(journalEntriesTable).set({ isDeleted: true, isActive: false }).where(eq(journalEntriesTable.id, id));
    await tx.update(journalEntryLinesTable).set({ isDeleted: true, isActive: false }).where(eq(journalEntryLinesTable.entryId, id));
  });
  await recordAudit(req, { action: "delete", entity: "journalEntry", entityId: id });
  res.json({ success: true });
});

router.post("/journal-entries/:id/post", requirePermission("journalEntries.post"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  try {
    const updated = await db.transaction((tx) => postEntry(tx, id, uid(req)));
    await recordAudit(req, { action: "update", entity: "journalEntry", entityId: id, newValue: updated });
    const detail = await loadEntryDetail(id);
    res.json(GetJournalEntryResponse.parse(detail));
  } catch (err) {
    if (handlePostingError(err, res)) return;
    throw err;
  }
});

router.post("/journal-entries/:id/approve", requirePermission("journalEntries.approve"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  try {
    const updated = await db.transaction((tx) => approveEntry(tx, id, uid(req)));
    await recordAudit(req, { action: "update", entity: "journalEntry", entityId: id, newValue: updated });
    const detail = await loadEntryDetail(id);
    res.json(GetJournalEntryResponse.parse(detail));
  } catch (err) {
    if (handlePostingError(err, res)) return;
    throw err;
  }
});

router.post("/journal-entries/:id/reverse", requirePermission("journalEntries.reverse"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = ReverseJournalEntryBody.safeParse(req.body ?? {});
  const opts = parsed.success ? parsed.data : {};
  try {
    const mirror = await db.transaction((tx) =>
      reverseEntry(tx, id, uid(req), { entryDate: opts.entryDate ?? null, description: opts.description ?? null }),
    );
    await recordAudit(req, { action: "update", entity: "journalEntry", entityId: id, newValue: { reversalEntryId: mirror.id } });
    const detail = await loadEntryDetail(mirror.id);
    res.json(GetJournalEntryResponse.parse(detail));
  } catch (err) {
    if (handlePostingError(err, res)) return;
    throw err;
  }
});

// =====================================================================
// Reports
// =====================================================================
type Balrow = { accountId: string; code: string; name: string; nameAr: string; type: string; debit: string; credit: string };

// Aggregate posted debit/credit per account, optionally filtered by date range / asOf / type.
async function accountBalances(opts: {
  companyId?: string;
  fromDate?: string;
  toDate?: string;
  asOfDate?: string;
  types?: string[];
}): Promise<Balrow[]> {
  const filters: SQL[] = [
    // Include reversed entries: their original lines net to zero against the
    // posted reversal mirror, so excluding them would leave a phantom balance.
    inArray(journalEntriesTable.status, ["posted", "reversed"]),
    eq(journalEntriesTable.isDeleted, false),
    eq(journalEntryLinesTable.isDeleted, false),
  ];
  if (opts.companyId) filters.push(eq(journalEntriesTable.companyId, opts.companyId));
  if (opts.fromDate) filters.push(gte(journalEntriesTable.entryDate, opts.fromDate));
  if (opts.toDate) filters.push(lte(journalEntriesTable.entryDate, opts.toDate));
  if (opts.asOfDate) filters.push(lte(journalEntriesTable.entryDate, opts.asOfDate));
  if (opts.types && opts.types.length) filters.push(inArray(accountsTable.type, opts.types));
  return db
    .select({
      accountId: accountsTable.id,
      code: accountsTable.code,
      name: accountsTable.name,
      nameAr: accountsTable.nameAr,
      type: accountsTable.type,
      debit: sql<string>`coalesce(sum(${journalEntryLinesTable.debit}),0)::text`,
      credit: sql<string>`coalesce(sum(${journalEntryLinesTable.credit}),0)::text`,
    })
    .from(journalEntryLinesTable)
    .innerJoin(journalEntriesTable, eq(journalEntriesTable.id, journalEntryLinesTable.entryId))
    .innerJoin(accountsTable, eq(accountsTable.id, journalEntryLinesTable.accountId))
    .where(and(...filters))
    .groupBy(accountsTable.id, accountsTable.code, accountsTable.name, accountsTable.nameAr, accountsTable.type)
    .orderBy(accountsTable.code);
}

const netDebit = (r: Balrow) => (toCents(r.debit) ?? 0n) - (toCents(r.credit) ?? 0n);

router.get("/reports/trial-balance", requirePermission("accountingReports.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const rows = await accountBalances({ companyId: qStr(q, "companyId"), fromDate: qStr(q, "fromDate"), toDate: qStr(q, "toDate") });
  let totalDebit = 0n;
  let totalCredit = 0n;
  const out = rows
    .map((r) => {
      const net = netDebit(r);
      const debit = net >= 0n ? net : 0n;
      const credit = net < 0n ? -net : 0n;
      totalDebit += debit;
      totalCredit += credit;
      return { accountId: r.accountId, code: r.code, name: r.name, nameAr: r.nameAr, type: r.type, debit: fromCents(debit), credit: fromCents(credit) };
    })
    .filter((r) => r.debit !== "0.00" || r.credit !== "0.00");
  res.json(GetTrialBalanceResponse.parse({ rows: out, totalDebit: fromCents(totalDebit), totalCredit: fromCents(totalCredit) }));
});

router.get("/reports/general-ledger", requirePermission("accountingReports.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const companyId = qStr(q, "companyId");
  const accountId = qStr(q, "accountId");
  const costCenterId = qStr(q, "costCenterId");
  const fromDate = qStr(q, "fromDate");
  const toDate = qStr(q, "toDate");
  if (!accountId) {
    res.json(GetGeneralLedgerResponse.parse({ accountId: null, openingBalance: "0.00", closingBalance: "0.00", totalDebit: "0.00", totalCredit: "0.00", data: [], total: 0, page, pageSize }));
    return;
  }
  const baseFilters: SQL[] = [
    inArray(journalEntriesTable.status, ["posted", "reversed"]),
    eq(journalEntriesTable.isDeleted, false),
    eq(journalEntryLinesTable.isDeleted, false),
    eq(journalEntryLinesTable.accountId, accountId),
  ];
  if (companyId) baseFilters.push(eq(journalEntriesTable.companyId, companyId));
  if (costCenterId) baseFilters.push(eq(journalEntryLinesTable.costCenterId, costCenterId));

  // Opening balance: everything strictly before fromDate.
  let openingCents = 0n;
  if (fromDate) {
    const [op] = await db
      .select({
        debit: sql<string>`coalesce(sum(${journalEntryLinesTable.debit}),0)::text`,
        credit: sql<string>`coalesce(sum(${journalEntryLinesTable.credit}),0)::text`,
      })
      .from(journalEntryLinesTable)
      .innerJoin(journalEntriesTable, eq(journalEntriesTable.id, journalEntryLinesTable.entryId))
      .where(and(...baseFilters, lt(journalEntriesTable.entryDate, fromDate)));
    openingCents = (toCents(op.debit) ?? 0n) - (toCents(op.credit) ?? 0n);
  }

  const rangeFilters = [...baseFilters];
  if (fromDate) rangeFilters.push(gte(journalEntriesTable.entryDate, fromDate));
  if (toDate) rangeFilters.push(lte(journalEntriesTable.entryDate, toDate));
  const lines = await db
    .select({
      entryId: journalEntriesTable.id,
      entryNumber: journalEntriesTable.number,
      entryDate: journalEntriesTable.entryDate,
      description: journalEntryLinesTable.description,
      costCenterId: journalEntryLinesTable.costCenterId,
      debit: journalEntryLinesTable.debit,
      credit: journalEntryLinesTable.credit,
    })
    .from(journalEntryLinesTable)
    .innerJoin(journalEntriesTable, eq(journalEntriesTable.id, journalEntryLinesTable.entryId))
    .where(and(...rangeFilters))
    .orderBy(journalEntriesTable.entryDate, journalEntriesTable.createdAt);

  let running = openingCents;
  let totalDebit = 0n;
  let totalCredit = 0n;
  const all = lines.map((l) => {
    const d = toCents(l.debit) ?? 0n;
    const c = toCents(l.credit) ?? 0n;
    running += d - c;
    totalDebit += d;
    totalCredit += c;
    return {
      entryId: l.entryId,
      entryNumber: l.entryNumber,
      entryDate: l.entryDate,
      description: l.description ?? null,
      costCenterId: l.costCenterId ?? null,
      debit: fromCents(d),
      credit: fromCents(c),
      balance: fromCents(running),
    };
  });
  const pageData = all.slice(offset, offset + pageSize);
  res.json(GetGeneralLedgerResponse.parse({
    accountId,
    openingBalance: fromCents(openingCents),
    closingBalance: fromCents(running),
    totalDebit: fromCents(totalDebit),
    totalCredit: fromCents(totalCredit),
    data: pageData,
    total: all.length,
    page,
    pageSize,
  }));
});

router.get("/reports/balance-sheet", requirePermission("accountingReports.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const companyId = qStr(q, "companyId");
  const asOfDate = qStr(q, "asOfDate") ?? new Date().toISOString().slice(0, 10);
  const rows = await accountBalances({ companyId, asOfDate });
  const assets: { accountId: string; code: string; name: string; nameAr: string; amount: string }[] = [];
  const liabilities: typeof assets = [];
  const equity: typeof assets = [];
  let totalAssets = 0n;
  let totalLiabilities = 0n;
  let totalEquity = 0n;
  let revenueNet = 0n; // credit - debit
  let expenseNet = 0n; // debit - credit
  for (const r of rows) {
    const net = netDebit(r); // debit - credit
    const line = { accountId: r.accountId, code: r.code, name: r.name, nameAr: r.nameAr };
    if (r.type === "asset") {
      if (net !== 0n) { assets.push({ ...line, amount: fromCents(net) }); totalAssets += net; }
    } else if (r.type === "liability") {
      const amt = -net;
      if (amt !== 0n) { liabilities.push({ ...line, amount: fromCents(amt) }); totalLiabilities += amt; }
    } else if (r.type === "equity") {
      const amt = -net;
      if (amt !== 0n) { equity.push({ ...line, amount: fromCents(amt) }); totalEquity += amt; }
    } else if (r.type === "revenue") {
      revenueNet += -net;
    } else if (r.type === "expense") {
      expenseNet += net;
    }
  }
  const retained = revenueNet - expenseNet;
  if (retained !== 0n) {
    equity.push({ accountId: "retained-earnings", code: "", name: "Retained Earnings", nameAr: "الأرباح المحتجزة", amount: fromCents(retained) });
    totalEquity += retained;
  }
  const balanced = totalAssets === totalLiabilities + totalEquity;
  res.json(GetBalanceSheetResponse.parse({
    assets, liabilities, equity,
    totalAssets: fromCents(totalAssets),
    totalLiabilities: fromCents(totalLiabilities),
    totalEquity: fromCents(totalEquity),
    balanced,
  }));
});

router.get("/reports/income-statement", requirePermission("accountingReports.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const rows = await accountBalances({ companyId: qStr(q, "companyId"), fromDate: qStr(q, "fromDate"), toDate: qStr(q, "toDate"), types: ["revenue", "expense"] });
  const revenue: { accountId: string; code: string; name: string; nameAr: string; amount: string }[] = [];
  const expenses: typeof revenue = [];
  let totalRevenue = 0n;
  let totalExpenses = 0n;
  for (const r of rows) {
    const net = netDebit(r);
    const line = { accountId: r.accountId, code: r.code, name: r.name, nameAr: r.nameAr };
    if (r.type === "revenue") {
      const amt = -net;
      if (amt !== 0n) { revenue.push({ ...line, amount: fromCents(amt) }); totalRevenue += amt; }
    } else {
      if (net !== 0n) { expenses.push({ ...line, amount: fromCents(net) }); totalExpenses += net; }
    }
  }
  res.json(GetIncomeStatementResponse.parse({
    revenue, expenses,
    totalRevenue: fromCents(totalRevenue),
    totalExpenses: fromCents(totalExpenses),
    netIncome: fromCents(totalRevenue - totalExpenses),
  }));
});

router.get("/reports/cash-flow", requirePermission("accountingReports.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const companyId = qStr(q, "companyId");
  const fromDate = qStr(q, "fromDate");
  const toDate = qStr(q, "toDate");

  // Cash & cash-equivalent accounts identified by name/code convention.
  const cashFilters: SQL[] = [eq(accountsTable.isDeleted, false), eq(accountsTable.type, "asset")];
  if (companyId) cashFilters.push(eq(accountsTable.companyId, companyId));
  const cashName = or(ilike(accountsTable.name, "%cash%"), ilike(accountsTable.name, "%bank%"), ilike(accountsTable.nameAr, "%نقد%"), ilike(accountsTable.nameAr, "%بنك%"), ilike(accountsTable.nameAr, "%صندوق%"));
  if (cashName) cashFilters.push(cashName);
  const cashAccounts = await db.select({ id: accountsTable.id }).from(accountsTable).where(and(...cashFilters));
  const cashIds = cashAccounts.map((c) => c.id);

  const empty = { operating: [], investing: [], financing: [], netChange: "0.00", openingCash: "0.00", closingCash: "0.00" };
  if (!cashIds.length) { res.json(GetCashFlowResponse.parse(empty)); return; }

  const cashNet = async (filters: SQL[]) => {
    const [r] = await db
      .select({
        debit: sql<string>`coalesce(sum(${journalEntryLinesTable.debit}),0)::text`,
        credit: sql<string>`coalesce(sum(${journalEntryLinesTable.credit}),0)::text`,
      })
      .from(journalEntryLinesTable)
      .innerJoin(journalEntriesTable, eq(journalEntriesTable.id, journalEntryLinesTable.entryId))
      .where(and(inArray(journalEntriesTable.status, ["posted", "reversed"]), eq(journalEntriesTable.isDeleted, false), eq(journalEntryLinesTable.isDeleted, false), inArray(journalEntryLinesTable.accountId, cashIds), ...filters));
    return (toCents(r.debit) ?? 0n) - (toCents(r.credit) ?? 0n);
  };
  const companyFilter: SQL[] = companyId ? [eq(journalEntriesTable.companyId, companyId)] : [];
  let openingCash = 0n;
  if (fromDate) openingCash = await cashNet([...companyFilter, lt(journalEntriesTable.entryDate, fromDate)]);
  const rangeFilter: SQL[] = [...companyFilter];
  if (fromDate) rangeFilter.push(gte(journalEntriesTable.entryDate, fromDate));
  if (toDate) rangeFilter.push(lte(journalEntriesTable.entryDate, toDate));
  const netChange = await cashNet(rangeFilter);
  const closingCash = openingCash + netChange;

  // Counterpart legs (non-cash) of entries that also touch a cash account.
  const counterFilters: SQL[] = [
    inArray(journalEntriesTable.status, ["posted", "reversed"]),
    eq(journalEntriesTable.isDeleted, false),
    eq(journalEntryLinesTable.isDeleted, false),
    sql`${journalEntryLinesTable.accountId} not in (${sql.join(cashIds.map((id) => sql`${id}`), sql`, `)})`,
    sql`exists (select 1 from ${journalEntryLinesTable} cl where cl.entry_id = ${journalEntriesTable.id} and cl.is_deleted = false and cl.account_id in (${sql.join(cashIds.map((id) => sql`${id}`), sql`, `)}))`,
  ];
  if (companyId) counterFilters.push(eq(journalEntriesTable.companyId, companyId));
  if (fromDate) counterFilters.push(gte(journalEntriesTable.entryDate, fromDate));
  if (toDate) counterFilters.push(lte(journalEntriesTable.entryDate, toDate));
  const counter = await db
    .select({
      accountId: accountsTable.id,
      code: accountsTable.code,
      name: accountsTable.name,
      nameAr: accountsTable.nameAr,
      type: accountsTable.type,
      debit: sql<string>`coalesce(sum(${journalEntryLinesTable.debit}),0)::text`,
      credit: sql<string>`coalesce(sum(${journalEntryLinesTable.credit}),0)::text`,
    })
    .from(journalEntryLinesTable)
    .innerJoin(journalEntriesTable, eq(journalEntriesTable.id, journalEntryLinesTable.entryId))
    .innerJoin(accountsTable, eq(accountsTable.id, journalEntryLinesTable.accountId))
    .where(and(...counterFilters))
    .groupBy(accountsTable.id, accountsTable.code, accountsTable.name, accountsTable.nameAr, accountsTable.type)
    .orderBy(accountsTable.code);

  const operating: { accountId: string; code: string; name: string; nameAr: string; amount: string }[] = [];
  const investing: typeof operating = [];
  const financing: typeof operating = [];
  for (const r of counter) {
    // Cash impact of this counterpart = credit - debit of its own legs.
    const impact = (toCents(r.credit) ?? 0n) - (toCents(r.debit) ?? 0n);
    if (impact === 0n) continue;
    const line = { accountId: r.accountId, code: r.code, name: r.name, nameAr: r.nameAr, amount: fromCents(impact) };
    if (r.type === "revenue" || r.type === "expense" || r.type === "liability") operating.push(line);
    else if (r.type === "asset") investing.push(line);
    else financing.push(line);
  }
  res.json(GetCashFlowResponse.parse({
    operating, investing, financing,
    netChange: fromCents(netChange),
    openingCash: fromCents(openingCash),
    closingCash: fromCents(closingCash),
  }));
});

router.get("/reports/budget-vs-actual", requirePermission("accountingReports.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const companyId = qStr(q, "companyId");
  const budgetId = qStr(q, "budgetId");
  if (!budgetId) { res.json(GetBudgetVsActualResponse.parse({ rows: [], totalBudgeted: "0.00", totalActual: "0.00", totalVariance: "0.00" })); return; }
  const [budget] = await db.select().from(budgetsTable).where(and(eq(budgetsTable.id, budgetId), eq(budgetsTable.isDeleted, false)));
  if (!budget) { res.status(404).json({ error: "Budget not found" }); return; }
  const [fy] = await db.select().from(fiscalYearsTable).where(eq(fiscalYearsTable.id, budget.fiscalYearId));
  const fromDate = fy?.startDate;
  const toDate = fy?.endDate;

  const lines = await db
    .select({
      accountId: budgetLinesTable.accountId,
      amount: budgetLinesTable.amount,
      code: accountsTable.code,
      name: accountsTable.name,
      nameAr: accountsTable.nameAr,
    })
    .from(budgetLinesTable)
    .innerJoin(accountsTable, eq(accountsTable.id, budgetLinesTable.accountId))
    .where(and(eq(budgetLinesTable.budgetId, budgetId), eq(budgetLinesTable.isDeleted, false)))
    .orderBy(accountsTable.code);

  const actuals = await accountBalances({ companyId: companyId ?? budget.companyId, fromDate, toDate });
  const actualByAccount = new Map(actuals.map((a) => [a.accountId, netDebit(a)]));

  let totalBudgeted = 0n;
  let totalActual = 0n;
  let totalVariance = 0n;
  const rows = lines.map((l) => {
    const budgeted = toCents(l.amount) ?? 0n;
    const actual = actualByAccount.get(l.accountId) ?? 0n;
    const variance = budgeted - actual;
    totalBudgeted += budgeted;
    totalActual += actual;
    totalVariance += variance;
    return { accountId: l.accountId, code: l.code, name: l.name, nameAr: l.nameAr, budgeted: fromCents(budgeted), actual: fromCents(actual), variance: fromCents(variance) };
  });
  res.json(GetBudgetVsActualResponse.parse({ rows, totalBudgeted: fromCents(totalBudgeted), totalActual: fromCents(totalActual), totalVariance: fromCents(totalVariance) }));
});

router.get("/accounting/dashboard", requirePermission("accountingReports.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const companyId = qStr(q, "companyId");
  const asOfDate = new Date().toISOString().slice(0, 10);
  const balances = await accountBalances({ companyId, asOfDate });
  let totalAssets = 0n;
  let totalLiabilities = 0n;
  let totalEquity = 0n;
  let totalRevenue = 0n;
  let totalExpenses = 0n;
  for (const r of balances) {
    const net = netDebit(r);
    if (r.type === "asset") totalAssets += net;
    else if (r.type === "liability") totalLiabilities += -net;
    else if (r.type === "equity") totalEquity += -net;
    else if (r.type === "revenue") totalRevenue += -net;
    else if (r.type === "expense") totalExpenses += net;
  }
  const netIncome = totalRevenue - totalExpenses;

  const statusFilter: SQL[] = [eq(journalEntriesTable.isDeleted, false)];
  if (companyId) statusFilter.push(eq(journalEntriesTable.companyId, companyId));
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(journalEntriesTable).where(and(...statusFilter));
  const [{ draftCount }] = await db.select({ draftCount: sql<number>`count(*)::int` }).from(journalEntriesTable).where(and(...statusFilter, eq(journalEntriesTable.status, "draft")));
  const [{ postedCount }] = await db.select({ postedCount: sql<number>`count(*)::int` }).from(journalEntriesTable).where(and(...statusFilter, eq(journalEntriesTable.status, "posted")));

  const periodFilter: SQL[] = [eq(fiscalPeriodsTable.isDeleted, false), eq(fiscalPeriodsTable.status, "open")];
  if (companyId) periodFilter.push(eq(fiscalPeriodsTable.companyId, companyId));
  const [{ openPeriodCount }] = await db.select({ openPeriodCount: sql<number>`count(*)::int` }).from(fiscalPeriodsTable).where(and(...periodFilter));

  const recent = await db.select().from(journalEntriesTable).where(and(...statusFilter)).orderBy(desc(journalEntriesTable.createdAt)).limit(5);

  res.json(GetAccountingDashboardResponse.parse({
    totalAssets: fromCents(totalAssets),
    totalLiabilities: fromCents(totalLiabilities),
    totalEquity: fromCents(totalEquity),
    totalRevenue: fromCents(totalRevenue),
    totalExpenses: fromCents(totalExpenses),
    netIncome: fromCents(netIncome),
    journalEntryCount: total,
    draftCount,
    postedCount,
    openPeriodCount,
    recentEntries: recent.map(serializeRow),
  }));
});

router.post("/reports/export-audit", requirePermission("accountingReports.export"), async (req, res): Promise<void> => {
  const parsed = RecordReportExportBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const { reportType, format, ...filters } = parsed.data;
  await recordAudit(req, {
    action: "export",
    entity: "accountingReport",
    entityId: reportType,
    newValue: { format, filters },
  });
  res.json({ success: true });
});

export default router;
