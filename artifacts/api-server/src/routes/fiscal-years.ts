import { Router, type IRouter } from "express";
import { and, eq, gte, lte, inArray, sql, type SQL } from "drizzle-orm";
import {
  db,
  fiscalYearsTable,
  fiscalPeriodsTable,
  accountsTable,
  journalEntriesTable,
  journalEntryLinesTable,
} from "@workspace/db";
import {
  ListFiscalYearsResponse,
  CreateFiscalYearBody,
  UpdateFiscalYearBody,
} from "@workspace/api-zod";
import { toFiscalYear } from "../lib/presenters";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";
import { toCents, fromCents } from "../lib/money";
import { createEntry, reverseEntry, PostingError, type EntryLineInput } from "../lib/posting";

const router: IRouter = Router();
router.use(requireAuth);

// sourceType used to tag (and later locate) the year-end closing journal entry.
const CLOSING_SOURCE = "yearEndClose";
const RETAINED_EARNINGS_CODE = "3020";

router.get("/fiscal-years", requirePermission("fiscalYears.view"), async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(fiscalYearsTable)
    .where(eq(fiscalYearsTable.isDeleted, false))
    .orderBy(fiscalYearsTable.startDate);
  res.json(ListFiscalYearsResponse.parse(rows.map(toFiscalYear)));
});

router.post("/fiscal-years", requirePermission("fiscalYears.create"), async (req, res): Promise<void> => {
  const parsed = CreateFiscalYearBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(fiscalYearsTable)
    .values({
      companyId: parsed.data.companyId ?? null,
      name: parsed.data.name,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      status: parsed.data.status ?? "open",
    })
    .returning();
  await recordAudit(req, { action: "create", entity: "fiscalYear", entityId: row.id, newValue: row });
  res.status(201).json(toFiscalYear(row));
});

router.patch("/fiscal-years/:id", requirePermission("fiscalYears.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateFiscalYearBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(fiscalYearsTable)
    .where(and(eq(fiscalYearsTable.id, id), eq(fiscalYearsTable.isDeleted, false)));
  if (!existing) {
    res.status(404).json({ error: "Fiscal year not found" });
    return;
  }
  const update: Record<string, unknown> = {};
  for (const key of ["name", "startDate", "endDate", "status"] as const) {
    if (parsed.data[key] !== undefined) update[key] = parsed.data[key];
  }
  const [row] = Object.keys(update).length
    ? await db.update(fiscalYearsTable).set(update).where(eq(fiscalYearsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, {
    action: "update",
    entity: "fiscalYear",
    entityId: id,
    oldValue: existing,
    newValue: row,
  });
  res.json(toFiscalYear(row));
});

router.delete("/fiscal-years/:id", requirePermission("fiscalYears.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db
    .update(fiscalYearsTable)
    .set({ isDeleted: true, isActive: false })
    .where(and(eq(fiscalYearsTable.id, id), eq(fiscalYearsTable.isDeleted, false)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Fiscal year not found" });
    return;
  }
  await recordAudit(req, { action: "delete", entity: "fiscalYear", entityId: id });
  res.json({ success: true });
});

// Year-end closing: posts a closing entry that zeroes every revenue/expense
// account into Retained Earnings, then closes all periods in the year and marks
// the year closed. Reversible via /reopen.
router.post("/fiscal-years/:id/year-end-close", requirePermission("fiscalYears.close"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const closingDateBody = (req.body ?? {}) as Record<string, unknown>;
  try {
    const out = await db.transaction(async (tx) => {
      const [fy] = await tx
        .select()
        .from(fiscalYearsTable)
        .where(and(eq(fiscalYearsTable.id, id), eq(fiscalYearsTable.isDeleted, false)))
        .for("update");
      if (!fy) return { status: 404 as const, error: "Fiscal year not found" };
      if (fy.status === "closed") return { status: 409 as const, error: "Fiscal year is already closed" };
      if (!fy.companyId) return { status: 400 as const, error: "Year-end close requires a company-scoped fiscal year" };

      const closingDate = typeof closingDateBody.closingDate === "string" && closingDateBody.closingDate
        ? closingDateBody.closingDate
        : fy.endDate;

      // Net balance of every revenue/expense account within the year.
      const balances = await tx
        .select({
          accountId: accountsTable.id,
          debit: sql<string>`coalesce(sum(${journalEntryLinesTable.debit}),0)::text`,
          credit: sql<string>`coalesce(sum(${journalEntryLinesTable.credit}),0)::text`,
        })
        .from(journalEntryLinesTable)
        .innerJoin(journalEntriesTable, eq(journalEntriesTable.id, journalEntryLinesTable.entryId))
        .innerJoin(accountsTable, eq(accountsTable.id, journalEntryLinesTable.accountId))
        .where(
          and(
            eq(journalEntriesTable.companyId, fy.companyId),
            inArray(journalEntriesTable.status, ["posted", "reversed"]),
            eq(journalEntriesTable.isDeleted, false),
            eq(journalEntryLinesTable.isDeleted, false),
            inArray(accountsTable.type, ["revenue", "expense"]),
            gte(journalEntriesTable.entryDate, fy.startDate),
            lte(journalEntriesTable.entryDate, fy.endDate),
          ),
        )
        .groupBy(accountsTable.id);

      const lines: EntryLineInput[] = [];
      let sumNet = 0n; // Σ (debit − credit) across revenue/expense accounts.
      for (const b of balances) {
        const net = (toCents(b.debit) ?? 0n) - (toCents(b.credit) ?? 0n);
        if (net === 0n) continue;
        sumNet += net;
        // Post the opposite side to bring the account back to zero.
        if (net > 0n) lines.push({ accountId: b.accountId, credit: fromCents(net) });
        else lines.push({ accountId: b.accountId, debit: fromCents(-net) });
      }

      let closingEntryId: string | null = null;
      if (lines.length > 0) {
        const [retained] = await tx
          .select({ id: accountsTable.id })
          .from(accountsTable)
          .where(
            and(
              eq(accountsTable.companyId, fy.companyId),
              eq(accountsTable.code, RETAINED_EARNINGS_CODE),
              eq(accountsTable.isDeleted, false),
            ),
          );
        if (!retained) return { status: 400 as const, error: `Retained Earnings account (${RETAINED_EARNINGS_CODE}) not found` };
        // Balancing line into Retained Earnings (net of the period result).
        if (sumNet > 0n) lines.push({ accountId: retained.id, debit: fromCents(sumNet) });
        else if (sumNet < 0n) lines.push({ accountId: retained.id, credit: fromCents(-sumNet) });

        const entry = await createEntry(tx, {
          companyId: fy.companyId,
          entryDate: closingDate,
          description: `Year-end closing for ${fy.name}`,
          descriptionAr: `إقفال نهاية السنة ${fy.name}`,
          reference: fy.name,
          sourceType: CLOSING_SOURCE,
          sourceId: fy.id,
          isAutomatic: true,
          userId: req.authUser?.id ?? null,
          autoPost: true,
          lines,
        });
        closingEntryId = entry.id;
      }

      // Close all periods in the year, then the year itself.
      await tx
        .update(fiscalPeriodsTable)
        .set({ status: "closed" })
        .where(and(eq(fiscalPeriodsTable.fiscalYearId, fy.id), eq(fiscalPeriodsTable.isDeleted, false)));
      const [updated] = await tx
        .update(fiscalYearsTable)
        .set({ status: "closed" })
        .where(eq(fiscalYearsTable.id, fy.id))
        .returning();
      return { status: 200 as const, fy, updated, closingEntryId };
    });

    if (out.status !== 200) { res.status(out.status).json({ error: out.error }); return; }
    await recordAudit(req, { action: "close", entity: "fiscalYear", entityId: id, oldValue: out.fy, newValue: out.updated });
    res.json(toFiscalYear(out.updated));
  } catch (err) {
    if (err instanceof PostingError) { res.status(err.status).json({ error: err.message }); return; }
    throw err;
  }
});

// Reopen a closed year: reverse the closing entry, reopen its periods, mark open.
router.post("/fiscal-years/:id/reopen", requirePermission("fiscalYears.reopen"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  try {
    const out = await db.transaction(async (tx) => {
      const [fy] = await tx
        .select()
        .from(fiscalYearsTable)
        .where(and(eq(fiscalYearsTable.id, id), eq(fiscalYearsTable.isDeleted, false)))
        .for("update");
      if (!fy) return { status: 404 as const, error: "Fiscal year not found" };
      if (fy.status !== "closed") return { status: 409 as const, error: "Fiscal year is not closed" };

      // Reverse the posted closing entry (if any) before reopening.
      const [closing] = await tx
        .select({ id: journalEntriesTable.id })
        .from(journalEntriesTable)
        .where(
          and(
            eq(journalEntriesTable.sourceType, CLOSING_SOURCE),
            eq(journalEntriesTable.sourceId, fy.id),
            eq(journalEntriesTable.status, "posted"),
            eq(journalEntriesTable.isDeleted, false),
          ),
        );
      if (closing) await reverseEntry(tx, closing.id, req.authUser?.id ?? null, { description: `Reopen ${fy.name}` });

      await tx
        .update(fiscalPeriodsTable)
        .set({ status: "open" })
        .where(and(eq(fiscalPeriodsTable.fiscalYearId, fy.id), eq(fiscalPeriodsTable.isDeleted, false)));
      const [updated] = await tx
        .update(fiscalYearsTable)
        .set({ status: "open" })
        .where(eq(fiscalYearsTable.id, fy.id))
        .returning();
      return { status: 200 as const, fy, updated };
    });

    if (out.status !== 200) { res.status(out.status).json({ error: out.error }); return; }
    await recordAudit(req, { action: "reopen", entity: "fiscalYear", entityId: id, oldValue: out.fy, newValue: out.updated });
    res.json(toFiscalYear(out.updated));
  } catch (err) {
    if (err instanceof PostingError) { res.status(err.status).json({ error: err.message }); return; }
    throw err;
  }
});

export default router;
