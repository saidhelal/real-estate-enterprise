import { and, eq } from "drizzle-orm";
import { db, certificateApprovalsTable } from "@workspace/db";
import { PostingError, type Tx } from "./posting";

/**
 * Whether a payment certificate has actually been approved.
 *
 * A certificate is the document that pays a contractor: its `net_amount`
 * posts to the ledger the moment its status becomes `posted`. Alongside it sat
 * `certificate_approvals` — a row per approval level, site engineer through
 * project manager — which nothing consulted. Anyone holding
 * `paymentCertificates.update` could PATCH the status straight to `posted` and
 * the money went out with every approval still pending.
 *
 * So the approval rows are the control, and this is the one place that reads
 * them. It answers one question — may this certificate be posted — and the
 * answer is derived from the rows rather than stored, because a stored
 * "approved" flag is one more thing that can disagree with the approvals it
 * summarises.
 */

export interface ApprovalState {
  /** Approval rows recorded against the certificate. */
  levels: number;
  approved: number;
  rejected: string[];
  pending: string[];
  /** Every recorded level has approved, and none rejected. */
  complete: boolean;
}

/** Where a certificate stands with its approvers. */
export async function approvalState(
  exec: Tx | typeof db,
  certificateId: string,
): Promise<ApprovalState> {
  const rows = await exec
    .select({
      level: certificateApprovalsTable.level,
      status: certificateApprovalsTable.status,
    })
    .from(certificateApprovalsTable)
    .where(
      and(
        eq(certificateApprovalsTable.certificateId, certificateId),
        eq(certificateApprovalsTable.isDeleted, false),
      ),
    );

  const rejected = rows.filter((r) => r.status === "rejected").map((r) => r.level);
  const pending = rows.filter((r) => r.status !== "approved" && r.status !== "rejected").map((r) => r.level);
  const approved = rows.filter((r) => r.status === "approved").length;

  return {
    levels: rows.length,
    approved,
    rejected,
    pending,
    complete: rows.length > 0 && rejected.length === 0 && pending.length === 0,
  };
}

/**
 * Refuse to post a certificate its approvers have not cleared.
 *
 * A certificate with no approval rows at all is refused too. That is the
 * important case rather than an edge one: an unapproved certificate and a
 * certificate nobody was asked to approve pay exactly the same money, and
 * treating "no approvals recorded" as "nothing objected" is how a control
 * becomes optional.
 *
 * The message names the levels, so the person who hit the button knows who
 * they are waiting for instead of being told they lack permission.
 */
export async function assertCertificateApproved(
  tx: Tx,
  certificateId: string,
  certificateCode: string,
): Promise<void> {
  const state = await approvalState(tx, certificateId);

  if (state.levels === 0) {
    throw new PostingError(
      409,
      `${certificateCode} has no approvals recorded. Add the approval levels and have them signed off before posting it.`,
    );
  }
  if (state.rejected.length > 0) {
    throw new PostingError(
      409,
      `${certificateCode} was rejected at: ${state.rejected.join(", ")}. It cannot be posted.`,
    );
  }
  if (state.pending.length > 0) {
    throw new PostingError(
      409,
      `${certificateCode} is still waiting for approval at: ${state.pending.join(", ")}.`,
    );
  }
}
