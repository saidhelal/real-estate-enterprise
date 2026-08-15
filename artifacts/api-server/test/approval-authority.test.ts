import { describe, it, expect } from "vitest";
import {
  separationOfDuties,
  amountFromPayload,
  withinApprovalLimit,
  canApprove,
  APPROVAL_LIMITS_KEY,
} from "../src/lib/approval-authority";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";

/**
 * The two controls that turn an approval queue into an approval.
 *
 * The queue recorded who asked and who reviewed, but refused nobody: anyone
 * holding `approvals.approve` could approve anything, including their own
 * request. These assert the rules that changed that, and the boundaries where
 * they deliberately do not apply.
 */

describe("separation of duties", () => {
  it("refuses the requester", () => {
    const d = separationOfDuties("user-1", "user-1");
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain("cannot approve it");
  });

  it("allows anyone else", () => {
    expect(separationOfDuties("user-1", "user-2").allowed).toBe(true);
  });

  it("does not exempt a wildcard holder", () => {
    // The rule is about the record showing one name in both columns, which is
    // exactly what the control exists to prevent — permissions do not change it.
    expect(separationOfDuties("admin", "admin").allowed).toBe(false);
  });
});

describe("amount detection", () => {
  it("reads the key each module actually uses", () => {
    expect(amountFromPayload({ amount: 500 })).toBe(500);
    expect(amountFromPayload({ totalValue: "1200.50" })).toBe(1200.5);
    expect(amountFromPayload({ grandTotal: 90 })).toBe(90);
  });

  it("returns null when the request is not about an amount", () => {
    // Approving a name change is not the same act as approving a payment, so
    // no limit applies to it.
    expect(amountFromPayload({ name: "New name" })).toBeNull();
    expect(amountFromPayload(null)).toBeNull();
    expect(amountFromPayload("nonsense")).toBeNull();
  });

  it("ignores a value that is not a number", () => {
    expect(amountFromPayload({ amount: "not a number" })).toBeNull();
  });
});

describe("approval limits", () => {
  it("allows anything when nothing is configured", async () => {
    // The absence of a limit is the documented unlimited case. The system now
    // ships with a ceiling of 10,000, so this asserts the *fallback* rather
    // than the shipped policy: the row is emptied for the length of the check
    // and restored immediately, and approval-limit.test.ts covers the real one.
    const [before] = await db
      .select({ value: settingsTable.value })
      .from(settingsTable)
      .where(eq(settingsTable.key, APPROVAL_LIMITS_KEY));
    await db.update(settingsTable).set({ value: "" }).where(eq(settingsTable.key, APPROVAL_LIMITS_KEY));
    try {
      const d = await withinApprovalLimit(["approvals.approve"], 1_000_000);
      expect(d.allowed).toBe(true);
    } finally {
      await db
        .update(settingsTable)
        .set({ value: before?.value ?? "" })
        .where(eq(settingsTable.key, APPROVAL_LIMITS_KEY));
    }
  });

  it("allows a request with no amount regardless of limits", async () => {
    expect((await withinApprovalLimit(["approvals.approve"], null)).allowed).toBe(true);
  });
});

describe("the single gate", () => {
  it("checks duties before the amount", async () => {
    // Both rules in one call so a caller cannot check one and forget the other.
    const d = await canApprove({
      requestedBy: "u1",
      approverId: "u1",
      approverPermissions: ["*"],
      payload: { amount: 1 },
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain("cannot approve it");
  });

  it("passes a different approver on an unconfigured system", async () => {
    const d = await canApprove({
      requestedBy: "u1",
      approverId: "u2",
      approverPermissions: ["approvals.approve"],
      payload: { amount: 5000 },
    });
    expect(d.allowed).toBe(true);
  });
});
