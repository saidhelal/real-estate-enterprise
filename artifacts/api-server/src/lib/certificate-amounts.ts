import { and, eq, ne, sum, notInArray } from "drizzle-orm";
import {
  db,
  paymentCertificatesTable,
  certificateItemsTable,
  contractorDeductionsTable,
  contractorAdditionsTable,
  retentionsTable,
  advanceRecoveriesTable,
} from "@workspace/db";
import type { Tx } from "./posting";

/**
 * The cumulative arithmetic of an interim payment certificate.
 *
 * A certificate claims the work done in one period, but a contractor is paid
 * against the *cumulative* value of the contract: the certificate carries what
 * was certified before it (`previous_amount`), what this period adds
 * (`current_amount`) and the running total (`gross_amount`). The same holds
 * per line — `previous_quantity`, `current_quantity`, `cumulative_quantity`.
 *
 * All of them were text boxes on a form. Nothing added them up, so the
 * cumulative value of a construction contract was whatever the person filling
 * in the certificate believed it to be — and the one figure a contractor and
 * an owner argue over was the one figure the system did not compute.
 *
 * This module owns that arithmetic. It reads the certificates already issued
 * against the same contract rather than trusting a stored running total, so a
 * cancelled or corrected certificate is reflected the next time one is issued
 * instead of leaving the series permanently out by its amount.
 */

function money(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v !== "string" || v.trim() === "") return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

/** Two decimals, as the numeric columns store money. */
const fixed = (n: number): string => n.toFixed(2);

/**
 * Certificates that count towards the cumulative total, excluding this one.
 *
 * A cancelled or rejected certificate certifies nothing, so it is left out —
 * counting it would have the contractor's cumulative claim include work the
 * owner refused.
 */
const EXCLUDED_FROM_CUMULATIVE = ["cancelled", "rejected", "draft"];

export interface CertificateTotals {
  previousAmount: string;
  grossAmount: string;
}

/**
 * What was certified before this certificate, and the running total with it.
 *
 * Ordered by certificate date rather than insertion: certificates are issued
 * per period and a late-entered one belongs where its period puts it, not at
 * the end of the list.
 */
export async function certificateTotals(
  exec: Tx | typeof db,
  certificate: {
    id: string;
    contractId: string | null;
    currentAmount: unknown;
    certificateDate: string | null;
  },
): Promise<CertificateTotals> {
  const current = money(certificate.currentAmount);

  // Without a contract there is no series to be cumulative over: the
  // certificate stands alone, and its gross is its own current value.
  if (!certificate.contractId) {
    return { previousAmount: fixed(0), grossAmount: fixed(current) };
  }

  const siblings = await exec
    .select({
      id: paymentCertificatesTable.id,
      currentAmount: paymentCertificatesTable.currentAmount,
      certificateDate: paymentCertificatesTable.certificateDate,
      status: paymentCertificatesTable.status,
    })
    .from(paymentCertificatesTable)
    .where(
      and(
        eq(paymentCertificatesTable.contractId, certificate.contractId),
        eq(paymentCertificatesTable.isDeleted, false),
        ne(paymentCertificatesTable.id, certificate.id),
      ),
    );

  const cutoff = certificate.certificateDate ?? "9999-12-31";
  const previous = siblings
    .filter((s) => !EXCLUDED_FROM_CUMULATIVE.includes(String(s.status)))
    // Strictly earlier by date. A certificate issued on the same day as another
    // is not "previous" to it — with no ordering between them, treating either
    // as prior would make the pair's totals depend on which was saved first.
    .filter((s) => (s.certificateDate ?? "") < cutoff)
    .reduce((sum, s) => sum + money(s.currentAmount), 0);

  return { previousAmount: fixed(previous), grossAmount: fixed(previous + current) };
}

export interface CertificateAdjustments {
  deductionsAmount: string;
  additionsAmount: string;
  retentionAmount: string;
  advanceRecovery: string;
}

/**
 * What the certificate's own attached documents add up to.
 *
 * Deductions, additions, retentions and advance recoveries are each a register
 * of records carrying a `certificate_id` — they are already attached to the
 * certificate. But the four totals that feed `net_amount` were text boxes, so
 * the amount a contractor is actually paid was whatever someone typed, and it
 * could disagree with the very deductions filed against that certificate.
 *
 * A `cancelled` or `rejected` line has decided nothing and is left out. A
 * retention counts what is still held — released money has gone back to the
 * contractor and is no longer a deduction from this certificate.
 */
export async function certificateAdjustments(
  exec: Tx | typeof db,
  certificateId: string,
): Promise<CertificateAdjustments> {
  // Written per table rather than through a shared helper: drizzle types each
  // table distinctly, so one predicate cannot be applied to two of them
  // without erasing the types that make these queries safe.
  const DECIDED_NOTHING = ["cancelled", "rejected"];

  const [deductions, additions, retentions, recoveries] = await Promise.all([
    exec
      .select({ total: sum(contractorDeductionsTable.amount) })
      .from(contractorDeductionsTable)
      .where(
        and(
          eq(contractorDeductionsTable.certificateId, certificateId),
          eq(contractorDeductionsTable.isDeleted, false),
          notInArray(contractorDeductionsTable.status, DECIDED_NOTHING),
        ),
      ),
    exec
      .select({ total: sum(contractorAdditionsTable.amount) })
      .from(contractorAdditionsTable)
      .where(
        and(
          eq(contractorAdditionsTable.certificateId, certificateId),
          eq(contractorAdditionsTable.isDeleted, false),
          notInArray(contractorAdditionsTable.status, DECIDED_NOTHING),
        ),
      ),
    exec
      .select({
        retained: sum(retentionsTable.retainedAmount),
        released: sum(retentionsTable.releasedAmount),
      })
      .from(retentionsTable)
      .where(
        and(
          eq(retentionsTable.certificateId, certificateId),
          eq(retentionsTable.isDeleted, false),
        ),
      ),
    exec
      .select({ total: sum(advanceRecoveriesTable.amount) })
      .from(advanceRecoveriesTable)
      .where(
        and(
          eq(advanceRecoveriesTable.certificateId, certificateId),
          eq(advanceRecoveriesTable.isDeleted, false),
        ),
      ),
  ]);

  const held = money(retentions[0]?.retained) - money(retentions[0]?.released);

  return {
    deductionsAmount: fixed(money(deductions[0]?.total)),
    additionsAmount: fixed(money(additions[0]?.total)),
    // Never negative: releasing more than was retained is a data question, not
    // a reason to hand the contractor extra money on this certificate.
    retentionAmount: fixed(Math.max(0, held)),
    advanceRecovery: fixed(money(recoveries[0]?.total)),
  };
}

/**
 * Recompute a certificate's derived amounts and store them.
 *
 * Two families of derivation, both from records rather than from typing: the
 * cumulative figures come from the certificates issued before this one, and
 * the four adjustments come from the documents attached to this one. The net
 * follows from those, so it is recomputed here too rather than left to the
 * value that was calculated before the deductions were known.
 *
 * Runs inside the caller's transaction, after the certificate row exists, and
 * writes only derived columns — everything the user entered stays as entered.
 */
export async function applyCertificateTotals(
  tx: Tx,
  certificateId: string,
): Promise<CertificateTotals | null> {
  const [row] = await tx
    .select()
    .from(paymentCertificatesTable)
    .where(eq(paymentCertificatesTable.id, certificateId));
  if (!row) return null;

  const totals = await certificateTotals(tx, {
    id: row.id,
    contractId: row.contractId,
    currentAmount: row.currentAmount,
    certificateDate: row.certificateDate,
  });

  const adjustments = await certificateAdjustments(tx, certificateId);

  // The same arithmetic the module already used for `net_amount`, applied to
  // the derived adjustments instead of the typed ones.
  const net =
    money(row.currentAmount) +
    money(adjustments.additionsAmount) -
    money(adjustments.retentionAmount) -
    money(adjustments.advanceRecovery) -
    money(adjustments.deductionsAmount);

  await tx
    .update(paymentCertificatesTable)
    .set({
      previousAmount: totals.previousAmount,
      grossAmount: totals.grossAmount,
      ...adjustments,
      netAmount: fixed(net),
    })
    .where(eq(paymentCertificatesTable.id, certificateId));

  return totals;
}

/**
 * A certificate line's cumulative quantity, and the amount it earns.
 *
 * `cumulative = previous + current` is the whole rule, and `amount` follows
 * from the current quantity at the agreed rate — a line's money is what this
 * period certifies, not the running total, which would pay for the same work
 * on every certificate.
 */
export async function applyItemTotals(tx: Tx, itemId: string): Promise<void> {
  const [line] = await tx
    .select()
    .from(certificateItemsTable)
    .where(eq(certificateItemsTable.id, itemId));
  if (!line) return;

  const previous = money(line.previousQuantity);
  const current = money(line.currentQuantity);
  const rate = money(line.rate);

  await tx
    .update(certificateItemsTable)
    .set({
      cumulativeQuantity: fixed(previous + current),
      amount: fixed(current * rate),
    })
    .where(eq(certificateItemsTable.id, itemId));
}
