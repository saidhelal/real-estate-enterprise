import { describe, it, expect } from "vitest";
import {
  LIFECYCLES,
  assertAction,
  LifecycleError,
  assertTransition,
  canTransition,
  isTerminal,
  isKnownState,
  statesOf,
} from "../src/lib/lifecycle";

/**
 * Document lifecycles.
 *
 * Each module used to guard its own transitions with a chain of
 * `if (row.status === "approved") throw ...`. Those chains reject the states
 * someone thought of and stay silent about the rest — which is why a record
 * could go from `cancelled` back to `draft` almost anywhere. These assert both
 * halves: the moves that must be allowed, and the ones that must not.
 */

describe("declared lifecycles are coherent", () => {
  it("every target state is itself a declared state", () => {
    // A transition pointing at a state the lifecycle does not define is a typo
    // that would strand a record somewhere it can never leave.
    for (const [type, lc] of Object.entries(LIFECYCLES)) {
      for (const [from, targets] of Object.entries(lc.transitions)) {
        for (const to of targets) {
          expect(
            lc.transitions[to],
            `${type}: ${from} -> ${to}, but ${to} is not a declared state`,
          ).toBeDefined();
        }
      }
    }
  });

  it("every lifecycle starts somewhere it declares", () => {
    for (const [type, lc] of Object.entries(LIFECYCLES)) {
      expect(lc.transitions[lc.initial], `${type}: initial ${lc.initial} undeclared`).toBeDefined();
    }
  });

  it("every lifecycle can actually finish, unless it says it is cyclic", () => {
    // A lifecycle with no terminal state is usually a record that can never be
    // closed — a forgotten state rather than a design. `cyclic: true` is how a
    // declaration says the loop is deliberate, which only `fiscalPeriod` does.
    for (const [type, lc] of Object.entries(LIFECYCLES)) {
      if (lc.cyclic) continue;
      const terminals = Object.keys(lc.transitions).filter((s) => isTerminal(type, s));
      expect(terminals.length, `${type} has no terminal state`).toBeGreaterThan(0);
    }
  });

  it("a cyclic lifecycle is a deliberate exception, not a common one", () => {
    const cyclic = Object.entries(LIFECYCLES)
      .filter(([, lc]) => lc.cyclic)
      .map(([type]) => type);
    expect(cyclic).toEqual(["fiscalPeriod"]);
  });
});

describe("transitions that must be allowed", () => {
  it("a change request is approved or rejected from pending", () => {
    expect(canTransition("changeRequest", "pending", "approved")).toBe(true);
    expect(canTransition("changeRequest", "pending", "rejected")).toBe(true);
  });

  it("a posted journal entry is reversed, never un-posted", () => {
    expect(canTransition("journalEntry", "posted", "reversed")).toBe(true);
    expect(canTransition("journalEntry", "posted", "draft")).toBe(false);
  });

  it("a legal contract can go back for more work while under review", () => {
    expect(canTransition("legalContract", "under_review", "draft")).toBe(true);
  });
});

describe("the declarations match what the modules actually do", () => {
  // These were transcribed from the guards, and one of them was transcribed
  // wrong: `reservation` was declared to require `confirmed` before
  // `converted`, which broke the whole Lead -> Sale chain until the end-to-end
  // test caught it. A lifecycle that describes an imagined process is worse
  // than none, so the paths the system really walks are asserted here.
  it("converts a live reservation without demanding it be confirmed first", () => {
    expect(canTransition("reservation", "active", "converted")).toBe(true);
    expect(canTransition("reservation", "confirmed", "converted")).toBe(true);
  });

  it("hands a shift over from either open state", () => {
    // A guard may hand over a post they never checked into.
    expect(canTransition("securityShift", "scheduled", "handed_over")).toBe(true);
    expect(canTransition("securityShift", "in_progress", "handed_over")).toBe(true);
    expect(canTransition("securityShift", "cancelled", "handed_over")).toBe(false);
  });

  it("treats a handover decision as final in both directions", () => {
    // The old pair of checks refused only a repeat of the same decision, so a
    // rejected approval could still be approved afterwards.
    expect(canTransition("handoverApproval", "rejected", "approved")).toBe(false);
    expect(canTransition("handoverApproval", "approved", "rejected")).toBe(false);
  });

  it("archives a legal contract only once it is terminated or active", () => {
    expect(canTransition("legalContract", "active", "archived")).toBe(true);
    expect(canTransition("legalContract", "terminated", "archived")).toBe(true);
    expect(canTransition("legalContract", "archived", "archived")).toBe(true); // no-op
    expect(canTransition("legalContract", "draft", "archived")).toBe(false);
  });

  it("refuses approving an asset movement that was already decided", () => {
    expect(canTransition("assetTransfer", "rejected", "approved")).toBe(false);
    expect(canTransition("assetDisposal", "approved", "approved")).toBe(true); // no-op
    expect(canTransition("assetDisposal", "cancelled", "approved")).toBe(false);
  });
});

describe("transitions that must be refused", () => {
  it("refuses re-approving what is already approved", () => {
    expect(() => assertTransition("changeRequest", "approved", "approved")).not.toThrow();
    expect(() => assertTransition("changeRequest", "executed", "approved")).toThrow(LifecycleError);
  });

  it("refuses reviving a rejected request", () => {
    expect(() => assertTransition("changeRequest", "rejected", "approved")).toThrow(LifecycleError);
  });

  it("refuses moving a cancelled record back to draft", () => {
    // The gap the old if-chains left open: they guarded the states someone
    // remembered and permitted everything else by omission.
    expect(canTransition("contract", "cancelled", "draft")).toBe(false);
    expect(canTransition("reservation", "cancelled", "active")).toBe(false);
    expect(canTransition("payrollRun", "cancelled", "draft")).toBe(false);
  });

  it("says what the record is, not just that it refused", () => {
    try {
      assertTransition("changeRequest", "executed", "approved");
      throw new Error("should have refused");
    } catch (err) {
      expect(err).toBeInstanceOf(LifecycleError);
      expect((err as LifecycleError).message).toContain("executed");
      expect((err as LifecycleError).status).toBe(409);
    }
  });

  it("lists the moves that would have been allowed", () => {
    try {
      assertTransition("legalContract", "draft", "active");
      throw new Error("should have refused");
    } catch (err) {
      expect((err as LifecycleError).message).toContain("under_review");
    }
  });
});

describe("an action is not a no-op", () => {
  // Found live: posting a goods receipt twice doubled the stock, because the
  // guard saw posted -> posted, called it a no-op and stepped aside. A PATCH
  // setting status to its current value really does nothing; an action
  // endpoint writes movements every time it runs.
  it("refuses repeating an action the record has already had", () => {
    expect(() => assertAction("goodsReceipt", "posted", "posted")).toThrow(LifecycleError);
    expect(() => assertAction("changeRequest", "approved", "approved")).toThrow(LifecycleError);
  });

  it("says the record is already there, rather than refusing blankly", () => {
    try {
      assertAction("goodsReceipt", "posted", "posted");
      throw new Error("should have refused");
    } catch (err) {
      expect((err as LifecycleError).message).toContain("already posted");
      expect((err as LifecycleError).status).toBe(409);
    }
  });

  it("still allows a first, legitimate action", () => {
    expect(() => assertAction("goodsReceipt", "draft", "posted")).not.toThrow();
  });

  it("leaves the plain transition guard idempotent, which a PATCH needs", () => {
    expect(() => assertTransition("goodsReceipt", "posted", "posted")).not.toThrow();
  });
});

describe("boundaries", () => {
  it("leaves a document type with no declared lifecycle to its module", () => {
    // Silence is not permission; it means this module still owns its rules.
    expect(canTransition("somethingUndeclared", "a", "b")).toBe(true);
    expect(() => assertTransition("somethingUndeclared", "a", "b")).not.toThrow();
  });

  it("treats a no-op as allowed", () => {
    expect(() => assertTransition("changeRequest", "pending", "pending")).not.toThrow();
  });

  it("refuses a state it does not recognise", () => {
    expect(() => assertTransition("changeRequest", "nonsense", "approved")).toThrow(LifecycleError);
    expect(isKnownState("changeRequest", "nonsense")).toBe(false);
  });

  it("reports the states a type can hold", () => {
    expect(statesOf("changeRequest").sort()).toEqual(
      ["approved", "executed", "failed", "pending", "rejected"].sort(),
    );
    expect(statesOf("undeclared")).toEqual([]);
  });
});
