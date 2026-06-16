import { and, eq, inArray, lte, gte, desc } from "drizzle-orm";
import {
  db,
  accountsTable,
  accountMappingsTable,
  fiscalPeriodsTable,
  journalEntriesTable,
  journalEntryLinesTable,
  numberSequencesTable,
} from "@workspace/db";
import type { JournalEntryRow } from "@workspace/db";
import { toCents, fromCents } from "./money";
import { formatSequenceSample } from "./presenters";

// Transaction client type extracted from drizzle's transaction callback, so the
// posting service composes inside an existing business transaction (e.g. when a
// receipt auto-posts) or in its own transaction (manual journal entry).
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Error with an HTTP-ish status so route handlers can map it to a response. */
export class PostingError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "PostingError";
  }
}

export interface EntryLineInput {
  accountId: string;
  costCenterId?: string | null;
  debit?: string | null;
  credit?: string | null;
  description?: string | null;
}

export interface CreateEntryParams {
  companyId: string;
  branchId?: string | null;
  entryDate: string;
  fiscalPeriodId?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  reference?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  isAutomatic?: boolean;
  userId?: string | null;
  lines: EntryLineInput[];
  /** When true, the entry is created already posted (used by automatic hooks). */
  autoPost?: boolean;
}

interface NormalizedLine {
  accountId: string;
  costCenterId: string | null;
  debitCents: bigint;
  creditCents: bigint;
  description: string | null;
}

/** Validate + normalize lines and assert the entry balances. Throws PostingError. */
function normalizeLines(lines: EntryLineInput[]): {
  normalized: NormalizedLine[];
  totalDebit: bigint;
  totalCredit: bigint;
} {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new PostingError(400, "A journal entry needs at least two lines");
  }
  const normalized: NormalizedLine[] = [];
  let totalDebit = 0n;
  let totalCredit = 0n;
  for (const line of lines) {
    if (!line.accountId) throw new PostingError(400, "Each line needs an account");
    const debitCents = toCents(line.debit);
    const creditCents = toCents(line.credit);
    if (debitCents === null || creditCents === null) {
      throw new PostingError(400, "Invalid debit/credit amount");
    }
    const hasDebit = debitCents > 0n;
    const hasCredit = creditCents > 0n;
    if (hasDebit && hasCredit) {
      throw new PostingError(400, "A line cannot have both a debit and a credit");
    }
    if (!hasDebit && !hasCredit) {
      throw new PostingError(400, "A line needs either a debit or a credit");
    }
    totalDebit += debitCents;
    totalCredit += creditCents;
    normalized.push({
      accountId: line.accountId,
      costCenterId: line.costCenterId ?? null,
      debitCents,
      creditCents,
      description: line.description ?? null,
    });
  }
  if (totalDebit !== totalCredit) {
    throw new PostingError(400, "Entry is not balanced: total debit must equal total credit");
  }
  if (totalDebit === 0n) {
    throw new PostingError(400, "Entry total cannot be zero");
  }
  return { normalized, totalDebit, totalCredit };
}

/** Ensure every referenced account exists, belongs to the company and is postable. */
async function assertPostableAccounts(tx: Tx, companyId: string, accountIds: string[]): Promise<void> {
  const unique = Array.from(new Set(accountIds));
  const rows = await tx
    .select({ id: accountsTable.id, isPostable: accountsTable.isPostable, companyId: accountsTable.companyId })
    .from(accountsTable)
    .where(and(inArray(accountsTable.id, unique), eq(accountsTable.isDeleted, false)));
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const id of unique) {
    const acc = byId.get(id);
    if (!acc) throw new PostingError(400, `Account not found: ${id}`);
    if (acc.companyId !== companyId) throw new PostingError(400, "Account belongs to another company");
    if (!acc.isPostable) throw new PostingError(400, "Cannot post to a non-postable (parent) account");
  }
}

/** Find the fiscal period covering a date for a company (open or closed), or null. */
export async function resolvePeriod(
  tx: Tx,
  companyId: string,
  entryDate: string,
): Promise<{ id: string; status: string } | null> {
  const [period] = await tx
    .select({ id: fiscalPeriodsTable.id, status: fiscalPeriodsTable.status })
    .from(fiscalPeriodsTable)
    .where(
      and(
        eq(fiscalPeriodsTable.companyId, companyId),
        eq(fiscalPeriodsTable.isDeleted, false),
        lte(fiscalPeriodsTable.startDate, entryDate),
        gte(fiscalPeriodsTable.endDate, entryDate),
      ),
    );
  return period ?? null;
}

/** Resolve the period for posting and reject if it is closed. Returns the period id (or null). */
async function periodForPosting(
  tx: Tx,
  companyId: string,
  entryDate: string,
  explicitPeriodId?: string | null,
): Promise<string | null> {
  if (explicitPeriodId) {
    const [p] = await tx
      .select({ id: fiscalPeriodsTable.id, status: fiscalPeriodsTable.status })
      .from(fiscalPeriodsTable)
      .where(and(eq(fiscalPeriodsTable.id, explicitPeriodId), eq(fiscalPeriodsTable.isDeleted, false)));
    if (!p) throw new PostingError(400, "Fiscal period not found");
    if (p.status === "closed") throw new PostingError(409, "Fiscal period is closed");
    return p.id;
  }
  const period = await resolvePeriod(tx, companyId, entryDate);
  if (period && period.status === "closed") {
    throw new PostingError(409, "Fiscal period is closed for this date");
  }
  return period ? period.id : null;
}

/** Generate the next journal entry number within the transaction. */
export async function nextJournalNumber(tx: Tx, _companyId: string): Promise<string> {
  const [seq] = await tx
    .select()
    .from(numberSequencesTable)
    .where(
      and(
        eq(numberSequencesTable.documentType, "Journal Entry"),
        eq(numberSequencesTable.isActive, true),
        eq(numberSequencesTable.isDeleted, false),
      ),
    )
    .orderBy(numberSequencesTable.createdAt)
    .limit(1)
    .for("update");
  if (seq) {
    const code = formatSequenceSample(seq.prefix, seq.nextNumber, seq.padding, seq.resetYearly);
    await tx
      .update(numberSequencesTable)
      .set({ nextNumber: seq.nextNumber + 1 })
      .where(eq(numberSequencesTable.id, seq.id));
    return code;
  }
  // Fallback when no sequence is configured.
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const rand = Math.floor(Math.random() * 1_000_000).toString().padStart(6, "0");
  return `JV-${stamp}-${rand}`;
}

/**
 * Create a journal entry with its lines inside the given transaction. Validates
 * the entry is balanced and (when posting) that accounts are postable and the
 * period is open. Returns the created entry row.
 */
export async function createEntry(tx: Tx, params: CreateEntryParams): Promise<JournalEntryRow> {
  const { normalized, totalDebit, totalCredit } = normalizeLines(params.lines);
  await assertPostableAccounts(tx, params.companyId, normalized.map((l) => l.accountId));

  let fiscalPeriodId = params.fiscalPeriodId ?? null;
  const post = params.autoPost === true;
  if (post) {
    fiscalPeriodId = await periodForPosting(tx, params.companyId, params.entryDate, params.fiscalPeriodId);
  } else if (fiscalPeriodId == null) {
    const p = await resolvePeriod(tx, params.companyId, params.entryDate);
    fiscalPeriodId = p ? p.id : null;
  }

  const number = await nextJournalNumber(tx, params.companyId);
  const now = new Date();
  const [entry] = await tx
    .insert(journalEntriesTable)
    .values({
      companyId: params.companyId,
      branchId: params.branchId ?? null,
      number,
      entryDate: params.entryDate,
      fiscalPeriodId,
      description: params.description ?? null,
      descriptionAr: params.descriptionAr ?? null,
      reference: params.reference ?? null,
      status: post ? "posted" : "draft",
      sourceType: params.sourceType ?? null,
      sourceId: params.sourceId ?? null,
      totalDebit: fromCents(totalDebit),
      totalCredit: fromCents(totalCredit),
      postedAt: post ? now : null,
      postedBy: post ? params.userId ?? null : null,
      isAutomatic: params.isAutomatic ?? false,
      userId: params.userId ?? null,
    })
    .returning();

  await tx.insert(journalEntryLinesTable).values(
    normalized.map((l, i) => ({
      entryId: entry.id,
      companyId: params.companyId,
      accountId: l.accountId,
      costCenterId: l.costCenterId,
      lineNumber: i + 1,
      debit: fromCents(l.debitCents),
      credit: fromCents(l.creditCents),
      description: l.description,
    })),
  );

  return entry;
}

/** Replace the lines of a draft entry, re-validate balance, and recompute totals. */
export async function setEntryLines(tx: Tx, entry: JournalEntryRow, lines: EntryLineInput[]): Promise<void> {
  if (entry.status !== "draft") throw new PostingError(409, "Only draft entries can be edited");
  const { normalized, totalDebit, totalCredit } = normalizeLines(lines);
  await assertPostableAccounts(tx, entry.companyId, normalized.map((l) => l.accountId));
  await tx.delete(journalEntryLinesTable).where(eq(journalEntryLinesTable.entryId, entry.id));
  await tx.insert(journalEntryLinesTable).values(
    normalized.map((l, i) => ({
      entryId: entry.id,
      companyId: entry.companyId,
      accountId: l.accountId,
      costCenterId: l.costCenterId,
      lineNumber: i + 1,
      debit: fromCents(l.debitCents),
      credit: fromCents(l.creditCents),
      description: l.description,
    })),
  );
  await tx
    .update(journalEntriesTable)
    .set({ totalDebit: fromCents(totalDebit), totalCredit: fromCents(totalCredit) })
    .where(eq(journalEntriesTable.id, entry.id));
}

/** Post an existing draft entry. Throws PostingError on invalid state/closed period. */
export async function postEntry(tx: Tx, entryId: string, userId: string | null): Promise<JournalEntryRow> {
  const [entry] = await tx
    .select()
    .from(journalEntriesTable)
    .where(and(eq(journalEntriesTable.id, entryId), eq(journalEntriesTable.isDeleted, false)))
    .for("update");
  if (!entry) throw new PostingError(404, "Journal entry not found");
  if (entry.status === "posted") throw new PostingError(409, "Journal entry is already posted");
  if (entry.status === "reversed") throw new PostingError(409, "Journal entry is reversed");

  const fiscalPeriodId = await periodForPosting(tx, entry.companyId, entry.entryDate, entry.fiscalPeriodId);
  const [updated] = await tx
    .update(journalEntriesTable)
    .set({ status: "posted", postedAt: new Date(), postedBy: userId, fiscalPeriodId })
    .where(eq(journalEntriesTable.id, entryId))
    .returning();
  return updated;
}

/** Approve an entry (records approver; does not change posting status). */
export async function approveEntry(tx: Tx, entryId: string, userId: string | null): Promise<JournalEntryRow> {
  const [entry] = await tx
    .select()
    .from(journalEntriesTable)
    .where(and(eq(journalEntriesTable.id, entryId), eq(journalEntriesTable.isDeleted, false)))
    .for("update");
  if (!entry) throw new PostingError(404, "Journal entry not found");
  if (entry.status === "reversed") throw new PostingError(409, "Journal entry is reversed");
  const [updated] = await tx
    .update(journalEntriesTable)
    .set({ approvedAt: new Date(), approvedBy: userId })
    .where(eq(journalEntriesTable.id, entryId))
    .returning();
  return updated;
}

/**
 * Reverse a posted entry by creating a mirror (debits/credits swapped) posted
 * entry and linking both. The reversal date defaults to today.
 */
export async function reverseEntry(
  tx: Tx,
  entryId: string,
  userId: string | null,
  opts?: { entryDate?: string | null; description?: string | null },
): Promise<JournalEntryRow> {
  const [entry] = await tx
    .select()
    .from(journalEntriesTable)
    .where(and(eq(journalEntriesTable.id, entryId), eq(journalEntriesTable.isDeleted, false)))
    .for("update");
  if (!entry) throw new PostingError(404, "Journal entry not found");
  if (entry.status !== "posted") throw new PostingError(409, "Only a posted entry can be reversed");

  const lines = await tx
    .select()
    .from(journalEntryLinesTable)
    .where(and(eq(journalEntryLinesTable.entryId, entryId), eq(journalEntryLinesTable.isDeleted, false)))
    .orderBy(journalEntryLinesTable.lineNumber);

  const reversalDate = opts?.entryDate || new Date().toISOString().slice(0, 10);
  const mirror = await createEntry(tx, {
    companyId: entry.companyId,
    branchId: entry.branchId,
    entryDate: reversalDate,
    description: opts?.description ?? `Reversal of ${entry.number}`,
    descriptionAr: entry.descriptionAr,
    reference: entry.number,
    sourceType: "reversal",
    sourceId: entry.id,
    isAutomatic: entry.isAutomatic,
    userId,
    autoPost: true,
    lines: lines.map((l) => ({
      accountId: l.accountId,
      costCenterId: l.costCenterId,
      // swap sides
      debit: l.credit,
      credit: l.debit,
      description: l.description,
    })),
  });

  await tx
    .update(journalEntriesTable)
    .set({ status: "reversed", reversedAt: new Date(), reversedBy: userId, reversalEntryId: mirror.id })
    .where(eq(journalEntriesTable.id, entryId));

  return mirror;
}

export interface AutoPostParams {
  companyId: string;
  branchId?: string | null;
  eventKey: string;
  amount: string;
  entryDate: string;
  description?: string | null;
  descriptionAr?: string | null;
  reference?: string | null;
  sourceType: string;
  sourceId: string;
  userId?: string | null;
  costCenterId?: string | null;
}

/**
 * Resolve the account mapping for an event and post a balanced two-line entry
 * (debit + credit). Best-effort: returns null (without throwing) when accounting
 * is not configured for the event/company or the mapped accounts are unusable,
 * so it never breaks the originating business transaction. Throws only on a
 * genuinely invalid amount.
 */
export async function postAutomaticEntry(tx: Tx, params: AutoPostParams): Promise<JournalEntryRow | null> {
  const cents = toCents(params.amount);
  if (cents === null) throw new PostingError(400, "Invalid amount for automatic posting");
  if (cents <= 0n) return null;

  // Idempotency: never post a second automatic entry for the same source. If one
  // already exists (and is not reversed/deleted), return it unchanged so retries
  // or duplicate calls cannot overstate balances.
  const [existing] = await tx
    .select()
    .from(journalEntriesTable)
    .where(
      and(
        eq(journalEntriesTable.sourceType, params.sourceType),
        eq(journalEntriesTable.sourceId, params.sourceId),
        eq(journalEntriesTable.isAutomatic, true),
        eq(journalEntriesTable.isDeleted, false),
      ),
    );
  if (existing && existing.status !== "reversed") return existing;

  const [mapping] = await tx
    .select()
    .from(accountMappingsTable)
    .where(
      and(
        eq(accountMappingsTable.companyId, params.companyId),
        eq(accountMappingsTable.eventKey, params.eventKey),
        eq(accountMappingsTable.isDeleted, false),
        eq(accountMappingsTable.isActive, true),
      ),
    );
  if (!mapping || !mapping.debitAccountId || !mapping.creditAccountId) return null;

  // Pre-check accounts so a misconfiguration skips posting rather than aborting
  // the business transaction.
  const accts = await tx
    .select({ id: accountsTable.id, isPostable: accountsTable.isPostable, companyId: accountsTable.companyId })
    .from(accountsTable)
    .where(
      and(
        inArray(accountsTable.id, [mapping.debitAccountId, mapping.creditAccountId]),
        eq(accountsTable.isDeleted, false),
      ),
    );
  const usable = (id: string) => {
    const a = accts.find((x) => x.id === id);
    return a && a.companyId === params.companyId && a.isPostable;
  };
  if (!usable(mapping.debitAccountId) || !usable(mapping.creditAccountId)) return null;

  const amount = fromCents(cents);
  return createEntry(tx, {
    companyId: params.companyId,
    branchId: params.branchId ?? null,
    entryDate: params.entryDate,
    description: params.description ?? null,
    descriptionAr: params.descriptionAr ?? null,
    reference: params.reference ?? null,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    isAutomatic: true,
    userId: params.userId ?? null,
    autoPost: true,
    lines: [
      { accountId: mapping.debitAccountId, costCenterId: params.costCenterId ?? null, debit: amount, credit: "0" },
      { accountId: mapping.creditAccountId, costCenterId: params.costCenterId ?? null, debit: "0", credit: amount },
    ],
  });
}

/**
 * Reverse the automatic entries previously posted for a source record (used when
 * a receipt/transaction is deleted). Best-effort; skips entries already reversed.
 */
export async function reverseAutomaticEntriesForSource(
  tx: Tx,
  sourceType: string,
  sourceId: string,
  userId: string | null,
): Promise<void> {
  const entries = await tx
    .select({ id: journalEntriesTable.id, status: journalEntriesTable.status })
    .from(journalEntriesTable)
    .where(
      and(
        eq(journalEntriesTable.sourceType, sourceType),
        eq(journalEntriesTable.sourceId, sourceId),
        eq(journalEntriesTable.isAutomatic, true),
        eq(journalEntriesTable.isDeleted, false),
      ),
    )
    .orderBy(desc(journalEntriesTable.createdAt));
  for (const e of entries) {
    if (e.status === "posted") {
      await reverseEntry(tx, e.id, userId);
    }
  }
}
