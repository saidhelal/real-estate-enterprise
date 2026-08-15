import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  db,
  companiesTable,
  paymentCertificatesTable,
  certificateApprovalsTable,
} from "@workspace/db";
import { approvalState, assertCertificateApproved } from "../src/lib/construction-approval";
import { PostingError } from "../src/lib/posting";

/**
 * Approvals must gate the money.
 *
 * A payment certificate pays a contractor: its net amount posts to the ledger
 * the moment its status becomes `posted`. `certificate_approvals` held a row
 * per approval level and nothing read them, so anyone with
 * `paymentCertificates.update` could set the status directly and the payment
 * went out with every level still pending.
 *
 * The case that matters most is the empty one: a certificate nobody was asked
 * to approve must not be treated as a certificate nobody objected to.
 *
 * FIXTURE data under a per-run tag, removed in `afterAll`.
 */

const tag = `apprtest-${Date.now()}`;
const id = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-${tag.slice(-12).padStart(12, "0")}`;

const COMPANY = id(1);
const certNoApprovals = id(2);
const certPending = id(3);
const certRejected = id(4);
const certApproved = id(5);

beforeAll(async () => {
  await db.insert(companiesTable).values({
    id: COMPANY,
    code: `${tag}-C`,
    name: `${tag} Company`,
    nameAr: "شركة اختبار",
  });
  await db.insert(paymentCertificatesTable).values(
    [certNoApprovals, certPending, certRejected, certApproved].map((certId, i) => ({
      id: certId,
      companyId: COMPANY,
      code: `${tag}-IPC${i}`,
      netAmount: "150000.00",
      status: "approved",
    })),
  );

  await db.insert(certificateApprovalsTable).values([
    // Two levels, one signed and one still waiting.
    { companyId: COMPANY, code: `${tag}-A1`, certificateId: certPending, level: "site_engineer", status: "approved" },
    { companyId: COMPANY, code: `${tag}-A2`, certificateId: certPending, level: "project_manager", status: "pending" },
    // Signed at the first level, refused at the second.
    { companyId: COMPANY, code: `${tag}-A3`, certificateId: certRejected, level: "site_engineer", status: "approved" },
    { companyId: COMPANY, code: `${tag}-A4`, certificateId: certRejected, level: "project_manager", status: "rejected" },
    // Fully cleared.
    { companyId: COMPANY, code: `${tag}-A5`, certificateId: certApproved, level: "site_engineer", status: "approved" },
    { companyId: COMPANY, code: `${tag}-A6`, certificateId: certApproved, level: "project_manager", status: "approved" },
  ]);
});

afterAll(async () => {
  await db.delete(certificateApprovalsTable).where(eq(certificateApprovalsTable.companyId, COMPANY));
  await db.delete(paymentCertificatesTable).where(eq(paymentCertificatesTable.companyId, COMPANY));
  await db.delete(companiesTable).where(eq(companiesTable.id, COMPANY));
});

describe("where a certificate stands", () => {
  it("reports the levels that are still waiting", async () => {
    const state = await approvalState(db, certPending);
    expect(state.levels).toBe(2);
    expect(state.approved).toBe(1);
    expect(state.pending).toEqual(["project_manager"]);
    expect(state.complete).toBe(false);
  });

  it("reports a refusal as a refusal, not merely as incomplete", async () => {
    const state = await approvalState(db, certRejected);
    expect(state.rejected).toEqual(["project_manager"]);
    expect(state.complete).toBe(false);
  });

  it("is complete only when every level has signed", async () => {
    const state = await approvalState(db, certApproved);
    expect(state.complete).toBe(true);
  });
});

describe("posting is refused until the approvals clear", () => {
  const anyTx = db as unknown as Parameters<typeof assertCertificateApproved>[0];

  it("refuses a certificate nobody was asked to approve", async () => {
    // The important case: no approvals recorded is not the same as no
    // objections raised, and treating it that way makes the control optional.
    await expect(
      assertCertificateApproved(anyTx, certNoApprovals, `${tag}-IPC0`),
    ).rejects.toBeInstanceOf(PostingError);
  });

  it("names who it is waiting for", async () => {
    try {
      await assertCertificateApproved(anyTx, certPending, `${tag}-IPC1`);
      throw new Error("should have refused");
    } catch (err) {
      const message = (err as PostingError).message;
      expect(message).toContain("project_manager");
      expect((err as PostingError).status).toBe(409);
    }
  });

  it("refuses a certificate that was rejected", async () => {
    try {
      await assertCertificateApproved(anyTx, certRejected, `${tag}-IPC2`);
      throw new Error("should have refused");
    } catch (err) {
      expect((err as PostingError).message).toMatch(/rejected/i);
    }
  });

  it("allows a fully approved certificate through", async () => {
    await expect(
      assertCertificateApproved(anyTx, certApproved, `${tag}-IPC3`),
    ).resolves.toBeUndefined();
  });
});
