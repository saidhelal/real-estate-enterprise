import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import {
  APPROVAL_LIMITS_KEY,
  withinApprovalLimit,
  canApprove,
} from "../src/lib/approval-authority";

/**
 * The approval ceiling, as decided: 10,000.
 *
 * `approval-authority.test.ts` covers the *mechanism* — how a limit is read,
 * how separation of duties works — against limits it sets itself. This file
 * covers the *policy*: that the figure the business approved is the figure the
 * system enforces, read from the one setting, and that no level rises above it.
 *
 * The value is restored to the shipped policy at the end, so the suite cannot
 * leave the system enforcing a ceiling nobody approved.
 */

const CEILING = 10_000;
const SHIPPED = '{"default":10000}';

/** The permission a department manager approves with. */
const MANAGER = ["approvals.approve"];

beforeAll(async () => {
  await db
    .insert(settingsTable)
    .values({
      key: APPROVAL_LIMITS_KEY,
      value: SHIPPED,
      category: "approvals",
      label: "Approval Limit",
    })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: SHIPPED } });
});

afterAll(async () => {
  await db
    .update(settingsTable)
    .set({ value: SHIPPED })
    .where(eq(settingsTable.key, APPROVAL_LIMITS_KEY));
});

describe("the ceiling the business approved", () => {
  it("allows an amount below it", async () => {
    const d = await withinApprovalLimit(MANAGER, 9_999);
    expect(d.allowed).toBe(true);
  });

  it("allows an amount exactly at it", async () => {
    // The decision reads "≤ 10,000", so the boundary itself is approvable.
    const d = await withinApprovalLimit(MANAGER, CEILING);
    expect(d.allowed).toBe(true);
  });

  it("refuses an amount one unit above it", async () => {
    const d = await withinApprovalLimit(MANAGER, CEILING + 1);
    expect(d.allowed).toBe(false);
    expect(d.limit).toBe(String(CEILING));
  });

  it("says what the limit is, so the approver knows where to send it", async () => {
    const d = await withinApprovalLimit(MANAGER, 25_000);
    expect(d.reason).toContain("10000");
    expect(d.reason).toMatch(/higher/i);
  });
});

describe("no level rises above the ceiling", () => {
  it("caps an approver holding every permission", async () => {
    // The decision says no level may approve above the maximum. A super admin
    // carries "*", which matches no named limit — so the ceiling has to reach
    // them through the default, and this is the assertion that it does.
    const d = await withinApprovalLimit(["*"], CEILING + 1);
    expect(d.allowed).toBe(false);
  });

  it("caps an approver holding several roles at once", async () => {
    const d = await withinApprovalLimit(
      ["approvals.approve", "contracts.approve", "payments.approve"],
      CEILING + 1,
    );
    expect(d.allowed).toBe(false);
  });
});

describe("the ceiling and separation of duties are one gate", () => {
  const requester = "11111111-1111-4111-8111-111111111111";
  const approver = "22222222-2222-4222-8222-222222222222";

  it("refuses the requester approving their own request, whatever the amount", async () => {
    const d = await canApprove({
      requestedBy: requester,
      approverId: requester,
      approverPermissions: ["*"],
      payload: { amount: 100 },
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/raised this request/i);
  });

  it("refuses an over-ceiling amount even from a different approver", async () => {
    const d = await canApprove({
      requestedBy: requester,
      approverId: approver,
      approverPermissions: MANAGER,
      payload: { amount: CEILING + 1 },
    });
    expect(d.allowed).toBe(false);
  });

  it("allows a within-ceiling amount from a different approver", async () => {
    const d = await canApprove({
      requestedBy: requester,
      approverId: approver,
      approverPermissions: MANAGER,
      payload: { amount: CEILING },
    });
    expect(d.allowed).toBe(true);
  });

  it("leaves a request with no amount to separation of duties alone", async () => {
    // Approving a name change is not an amount decision, and a ceiling has
    // nothing to say about it.
    const d = await canApprove({
      requestedBy: requester,
      approverId: approver,
      approverPermissions: MANAGER,
      payload: { name: "New name" },
    });
    expect(d.allowed).toBe(true);
  });
});

describe("the shipped policy is the approved one", () => {
  it("stores 10,000 as the ceiling", async () => {
    const [row] = await db
      .select({ value: settingsTable.value })
      .from(settingsTable)
      .where(eq(settingsTable.key, APPROVAL_LIMITS_KEY));
    const parsed = JSON.parse(String(row.value)) as Record<string, number>;
    expect(parsed.default).toBe(CEILING);
  });

  it("defines no tier above the ceiling", async () => {
    // The decision forbids inventing levels. Any entry larger than the ceiling
    // would be exactly that.
    const [row] = await db
      .select({ value: settingsTable.value })
      .from(settingsTable)
      .where(eq(settingsTable.key, APPROVAL_LIMITS_KEY));
    const parsed = JSON.parse(String(row.value)) as Record<string, number>;
    const above = Object.entries(parsed).filter(([, v]) => Number(v) > CEILING);
    expect(above).toEqual([]);
  });
});
