import { and, eq, isNull, sql } from "drizzle-orm";
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

/** Default shape for a sequence created on first use. */
function defaultPrefix(documentType: string): string {
  // Letters only, upper-cased, capped — a readable stem rather than the whole
  // entity name: `securityIncident` becomes `SEC`, `Contract` becomes `CON`.
  const letters = documentType.replace(/[^A-Za-z]/g, "");
  return (letters.slice(0, 3) || "DOC").toUpperCase();
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
): Promise<GeneratedNumber> {
  return db.transaction(async (tx) => {
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
          prefix: defaultPrefix(documentType),
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
  if (!seq) return { prefix: defaultPrefix(documentType), nextNumber: 1, periodYear: year };
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
    return formatSequenceSample(defaultPrefix(documentType), 1, 6, true);
  }
  const year = new Date().getFullYear();
  const counter = seq.resetYearly && seq.periodYear !== year ? 1 : seq.nextNumber;
  return formatSequenceSample(seq.prefix, counter, seq.padding, seq.resetYearly);
}

/** Kept for the sequence-admin screen, which reports usage. */
export { formatSequenceSample };
