import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db, numberSequencesTable } from "@workspace/db";
import { formatSequenceSample } from "./presenters";

/**
 * The one place a system-issued code, number or reference is produced.
 *
 * Every module that needs an identifier asks here. Nothing generates its own,
 * and nothing accepts one from the client for a field the system owns — a
 * number the caller can choose is not an identifier, it is a suggestion, and
 * two callers will eventually suggest the same one.
 *
 * Three things this had to fix while staying the same engine:
 *
 *  - It ignored `companyId` although the sequence table has always had the
 *    column. Two tenants therefore drew from one counter, so company A's next
 *    contract number depended on how many contracts company B had written.
 *  - `resetYearly` put the year in the text but never reset the counter, so a
 *    "yearly" sequence ran 2026-000412 straight into 2027-000413.
 *  - Callers fell back to `Date.now()` when no sequence was configured, which
 *    is how codes like `CORR-1786669547533` reached the database. A missing
 *    definition is now created on first use instead.
 */

/**
 * A transaction handle the engine can run inside.
 *
 * Derived from drizzle's own transaction callback rather than declared, so it
 * cannot drift from what `db.transaction` actually hands out.
 */
export type NumberTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** What a caller gets back, so the audit trail can say where it came from. */
export interface GeneratedNumber {
  /** The formatted identifier, e.g. `CON-2026-000041`. */
  value: string;
  /** The sequence that issued it. */
  documentType: string;
  /** The counter value consumed, for audit. */
  sequence: number;
  /** The company the sequence belongs to, or null for a global one. */
  companyId: string | null;
}

/**
 * The prefixes to try for a type nobody has configured, shortest first.
 *
 * Built from the initial of each word, then filled from the last word:
 * `purchaseOrder` → `POR`, `purchaseRequest` → `PRE`, `paymentCertificate` →
 * `PCE`. Taking the first three letters of the whole name instead — the obvious
 * approach — gave `purchaseOrder` and `purchaseRequest` the same `PUR`.
 *
 * A configured sequence keeps whatever prefix it was given; this only decides
 * the starting point for a type nobody has configured.
 *
 * Three characters is the house style, but three characters is not always
 * available: `consultant` and `contractor` both start `CON`, which the contract
 * register already uses. So each step keeps the word initials and takes one
 * more letter from the last word — `CON`, `CONS`, `CONSU` — and the caller
 * walks the list until it finds one no other document type has taken.
 *
 * The numeric tail exists only so the function always terminates; a type that
 * needs it is a naming problem worth fixing by configuring the sequence.
 */
function prefixCandidates(documentType: string): string[] {
  const words = documentType
    .replace(/[^A-Za-z]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return ["DOC"];

  const initials = words.map((w) => w[0]).join("");
  const last = words[words.length - 1];
  const out: string[] = [];
  for (let width = 3; width <= 6; width++) {
    let stem = initials;
    for (let i = 1; stem.length < width && i < last.length; i++) stem += last[i];
    const candidate = stem.slice(0, width).toUpperCase().padEnd(3, "X");
    if (!out.includes(candidate)) out.push(candidate);
  }
  const base = out[0];
  for (let n = 2; n <= 9; n++) out.push(`${base}${n}`);
  return out;
}

/**
 * Pick a prefix for a sequence being created on first use, avoiding one that
 * another document type already answers to.
 *
 * Two counters sharing a prefix never duplicate a number — they are separate
 * rows — but `PUR-2026-000001` printed on both a purchase order and a purchase
 * request is indistinguishable from a bug to whoever is holding the two pieces
 * of paper. That collision was found and fixed once by hand; resolving it here
 * means the next new document type cannot reintroduce it.
 *
 * Only prefixes visible to the same reader are considered: this company's own
 * sequences plus the global ones. Another tenant's choices neither constrain
 * this one nor leak into it.
 *
 * Preview and issue both go through here, so the number a form displays for a
 * type that has never been used is the number that type will actually get.
 *
 * A type that already has a sequence somewhere the caller can see keeps that
 * prefix. Two companies both writing journal entries want `JE-` on both, with
 * separate counters — not `JE-` for one and an invented `JEN-` for the other
 * because the shared definition was mistaken for a rival. Only a genuinely new
 * document type derives a prefix.
 */
async function resolvePrefix(
  runner: Pick<typeof db, "select">,
  documentType: string,
  companyId: string | null,
): Promise<string> {
  const candidates = prefixCandidates(documentType);
  const rows = await runner
    .select({ prefix: numberSequencesTable.prefix, documentType: numberSequencesTable.documentType })
    .from(numberSequencesTable)
    .where(
      and(
        eq(numberSequencesTable.isDeleted, false),
        companyId
          ? or(eq(numberSequencesTable.companyId, companyId), isNull(numberSequencesTable.companyId))
          : isNull(numberSequencesTable.companyId),
      ),
    );
  // Same type, wider scope: adopt its prefix rather than deriving a rival one.
  const sameType = rows.find((r) => r.documentType === documentType);
  if (sameType) return sameType.prefix;

  const taken = new Set(
    rows.filter((r) => r.documentType !== documentType).map((r) => r.prefix.toUpperCase()),
  );
  return candidates.find((c) => !taken.has(c)) ?? candidates[candidates.length - 1];
}

/**
 * Take the next value from a sequence, creating the definition if this is the
 * first time the type has been used.
 *
 * Concurrency is handled by the advisory lock taken at the top of the
 * transaction, which covers the first-use window that `FOR UPDATE` cannot:
 * there is no row to lock until one exists. `FOR UPDATE` still guards the
 * read afterwards.
 *
 * `companyId` must come from the authenticated context, never from a request
 * body — otherwise a caller could draw a number from another tenant's counter
 * and learn how many documents they have.
 */
export async function nextNumber(
  documentType: string,
  companyId: string | null = null,
  existingTx?: NumberTx,
): Promise<GeneratedNumber> {
  // Compose inside the caller's transaction when there is one, so a number and
  // the row it belongs to commit or roll back together. Accounting needs this:
  // a journal entry that failed to insert must not have consumed a number.
  // Opening our own transaction here instead would let the counter advance for
  // an entry that never existed.
  const run = existingTx
    ? (fn: (tx: NumberTx) => Promise<GeneratedNumber>) => fn(existingTx)
    : (fn: (tx: NumberTx) => Promise<GeneratedNumber>) => db.transaction(fn);

  return run(async (tx) => {
    /*
     * Serialise everyone drawing on this counter, before anything is read.
     *
     * `FOR UPDATE` alone was not enough. On the very first use of a type there
     * is no row to lock, so concurrent callers all saw "no sequence", all
     * inserted a definition, and each then counted from its own — twenty-five
     * simultaneous creates produced seven distinct codes across three rival
     * counters. `ON CONFLICT DO NOTHING` did not help because nothing in the
     * schema declared the pair unique, so there was no conflict to detect.
     *
     * A transaction-scoped advisory lock keyed on the sequence identity closes
     * that window: the first caller creates the definition and the rest queue
     * behind it, then all of them take numbers from the one row. The lock is
     * released when the transaction ends, including on error.
     */
    const lockKey = `numseq:${documentType}:${companyId ?? "global"}`;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`);

    const scope = companyId
      ? eq(numberSequencesTable.companyId, companyId)
      : isNull(numberSequencesTable.companyId);

    const load = async () =>
      (
        await tx
          .select()
          .from(numberSequencesTable)
          .where(
            and(
              eq(numberSequencesTable.documentType, documentType),
              scope,
              eq(numberSequencesTable.isActive, true),
              eq(numberSequencesTable.isDeleted, false),
            ),
          )
          .for("update")
      )[0];

    let seq = await load();

    if (!seq) {
      // First use of this type. Created here rather than left to a caller's
      // timestamp fallback, which produced unpadded, unsortable codes.
      await tx
        .insert(numberSequencesTable)
        .values({
          documentType,
          // Resolved inside the advisory lock, so two types created at the same
          // moment cannot both claim the same free prefix.
          prefix: await resolvePrefix(tx, documentType, companyId),
          nextNumber: 1,
          padding: 6,
          resetYearly: true,
          companyId,
          periodYear: new Date().getFullYear(),
        })
        .execute();
      seq = await load();
      if (!seq) {
        // Another transaction inserted a row we cannot see yet. Rather than
        // guess a number, fail loudly — a silent fallback is what produced
        // the timestamp codes this replaces.
        throw new Error(`Could not obtain a number sequence for "${documentType}".`);
      }
    }

    const year = new Date().getFullYear();
    // A yearly sequence genuinely restarts. Without this the year in the text
    // changed while the counter kept climbing, which is not a reset.
    const rolledOver = seq.resetYearly && seq.periodYear !== year;
    const counter = rolledOver ? 1 : seq.nextNumber;

    const value = formatSequenceSample(seq.prefix, counter, seq.padding, seq.resetYearly);

    await tx
      .update(numberSequencesTable)
      .set({ nextNumber: counter + 1, periodYear: year })
      .where(eq(numberSequencesTable.id, seq.id));

    return { value, documentType, sequence: counter, companyId: seq.companyId };
  });
}

/**
 * Backwards-compatible wrapper.
 *
 * The five call sites that predate this returned `string | null` and each
 * carried its own `Date.now()` fallback. They keep working unchanged, but the
 * null path no longer happens: a missing definition is created rather than
 * reported, so those fallbacks are now unreachable and are being removed as
 * each module is wired to `nextNumber` directly.
 */
export async function nextDocumentNumber(
  documentType: string,
  companyId: string | null = null,
): Promise<string | null> {
  try {
    return (await nextNumber(documentType, companyId)).value;
  } catch {
    return null;
  }
}

/**
 * The shape a sequence currently has: prefix, period and counter.
 *
 * Reported alongside the formatted preview so a form can explain the value
 * rather than just display it. Falls back to the same defaults `nextNumber`
 * would create on first use, so a type that has never been used still
 * previews correctly instead of showing nothing.
 */
export async function sequenceShapeFor(
  documentType: string,
  companyId: string | null = null,
): Promise<{ prefix: string; nextNumber: number; periodYear: number | null }> {
  const [seq] = await db
    .select()
    .from(numberSequencesTable)
    .where(
      and(
        eq(numberSequencesTable.documentType, documentType),
        companyId
          ? eq(numberSequencesTable.companyId, companyId)
          : isNull(numberSequencesTable.companyId),
        eq(numberSequencesTable.isActive, true),
        eq(numberSequencesTable.isDeleted, false),
      ),
    );
  const year = new Date().getFullYear();
  if (!seq) {
    return { prefix: await resolvePrefix(db, documentType, companyId), nextNumber: 1, periodYear: year };
  }
  const rolledOver = seq.resetYearly && seq.periodYear !== year;
  return {
    prefix: seq.prefix,
    nextNumber: rolledOver ? 1 : seq.nextNumber,
    periodYear: seq.resetYearly ? year : seq.periodYear,
  };
}

/** Peek at what a sequence would issue next, without consuming it. */
export async function previewNumber(
  documentType: string,
  companyId: string | null = null,
): Promise<string | null> {
  const [seq] = await db
    .select()
    .from(numberSequencesTable)
    .where(
      and(
        eq(numberSequencesTable.documentType, documentType),
        companyId
          ? eq(numberSequencesTable.companyId, companyId)
          : isNull(numberSequencesTable.companyId),
        eq(numberSequencesTable.isActive, true),
        eq(numberSequencesTable.isDeleted, false),
      ),
    );
  if (!seq) {
    // Same resolution the create path will run, so the form's forecast for a
    // never-used type matches the number that type is actually given.
    return formatSequenceSample(await resolvePrefix(db, documentType, companyId), 1, 6, true);
  }
  const year = new Date().getFullYear();
  const counter = seq.resetYearly && seq.periodYear !== year ? 1 : seq.nextNumber;
  return formatSequenceSample(seq.prefix, counter, seq.padding, seq.resetYearly);
}

/** Kept for the sequence-admin screen, which reports usage. */
export { formatSequenceSample };
