/**
 * What a record is allowed to become next.
 *
 * Every module guarded its own transitions with a chain of
 * `if (row.status === "approved") throw ...`, written fresh each time — around
 * twenty-eight of them across eight files. Each chain says the same thing in
 * slightly different words, and each one is a place to forget a state: the
 * guards that exist reject the states someone thought of, and say nothing
 * about the rest. A record could go from `cancelled` back to `draft` in most
 * modules because nobody wrote the line that would have stopped it.
 *
 * A lifecycle here is a declaration, not a procedure: the states a document
 * can be in and the moves it may make. Everything else follows from that —
 * what is terminal, what is reachable, what a rejection message should say.
 *
 * This does not replace business rules. "A draft needs a recipient before it
 * can be sent" is about the record's content, not its state, and stays with
 * the handler that knows what sending means.
 */

/** A lifecycle: the moves allowed from each state. A state with no moves is terminal. */
export interface Lifecycle {
  /** Where a newly created record starts. */
  initial: string;
  /** `from` → the states it may become. */
  transitions: Record<string, string[]>;
  /**
   * This document never reaches a final state, on purpose.
   *
   * Almost every lifecycle ends somewhere, and one that does not is usually a
   * missing terminal state rather than a decision — so the coherence test
   * refuses it unless the declaration says here that the cycle is intended.
   * An accounting period is the real case: it closes and reopens for a late
   * adjustment, for as long as the books are kept.
   */
  cyclic?: true;
}

/** Raised when a caller asks for a move the lifecycle does not allow. */
export class LifecycleError extends Error {
  readonly status = 409;
  constructor(
    message: string,
    readonly documentType: string,
    readonly from: string,
    readonly to: string,
  ) {
    super(message);
    this.name = "LifecycleError";
    Object.setPrototypeOf(this, LifecycleError.prototype);
  }
}

/**
 * The lifecycles this system actually runs.
 *
 * Transcribed from the guards each module already enforced, so adopting this
 * changes no behaviour on the paths that were guarded — it only closes the
 * paths that were not. A document type absent from here has no lifecycle
 * declared and is left entirely to its module; silence is not permission.
 */
export const LIFECYCLES: Record<string, Lifecycle> = {
  /* ---- Approvals ------------------------------------------------------- */
  changeRequest: {
    initial: "pending",
    transitions: {
      pending: ["approved", "rejected"],
      approved: ["executed", "failed"],
      rejected: [],
      executed: [],
      failed: [],
    },
  },

  /* ---- Human resources ------------------------------------------------- */
  // A rejected request is finished: re-opening it would lose the rejection.
  leaveRequest: {
    initial: "pending",
    transitions: { pending: ["approved", "rejected", "cancelled"], approved: ["cancelled"], rejected: [], cancelled: [] },
  },
  payrollRun: {
    initial: "draft",
    transitions: { draft: ["posted", "cancelled"], posted: ["reversed"], reversed: [], cancelled: [] },
  },
  // Money leaves the company at `disbursed` / `paid`, so those are terminal:
  // an advance that has been paid is settled through a recovery, not by
  // editing the advance back to approved.
  employeeLoan: {
    initial: "pending",
    transitions: { pending: ["approved", "rejected", "cancelled"], approved: ["disbursed", "cancelled"], disbursed: [], rejected: [], cancelled: [] },
  },
  employeeAdvance: {
    initial: "pending",
    transitions: { pending: ["approved", "rejected", "cancelled"], approved: ["paid", "cancelled"], paid: [], rejected: [], cancelled: [] },
  },

  /* ---- Accounting ------------------------------------------------------ */
  // A posted entry is never edited back to draft — it is reversed, which
  // leaves both the original and the mirror in the ledger.
  journalEntry: {
    initial: "draft",
    transitions: { draft: ["posted", "cancelled"], posted: ["reversed"], reversed: [], cancelled: [] },
  },
  assetDepreciation: {
    initial: "draft",
    transitions: { draft: ["posted", "cancelled"], posted: ["reversed"], reversed: [], cancelled: [] },
  },
  // A period closes and reopens — closing is not terminal, because a late
  // adjustment is a normal event and the reopen endpoint exists for it. The
  // audit trail records who did which, which is the real control.
  fiscalPeriod: {
    initial: "open",
    transitions: { open: ["closed"], closed: ["open"] },
    cyclic: true,
  },
  // A year, once closed, is closed: the year-end entry has moved the result
  // into retained earnings, and there is no reopen endpoint to undo it.
  fiscalYear: {
    initial: "open",
    transitions: { open: ["closed"], closed: [] },
  },

 /* ---- Procurement ------------------------------------------------------ */
  // Accepting a GRN is what advances the purchase order behind it, so it is
  // the state that matters and it happens once. A mistake is corrected by a
  // purchase return, which is itself a document someone can see.
  goodsReceiptNote: {
    initial: "draft",
    transitions: { draft: ["accepted", "rejected", "cancelled"], accepted: [], rejected: [], cancelled: [] },
  },

  /* ---- Inventory -------------------------------------------------------- */
  // Posting is what moves stock, so `posted` is the state that matters and it
  // is not editable back to draft: the ledger entry has already been written
  // and read. A mistake is corrected by a return, a transfer or an adjustment
  // — each of which is itself a movement someone can see.
  goodsReceipt: {
    initial: "draft",
    transitions: { draft: ["posted", "cancelled"], posted: [], cancelled: [] },
  },
  goodsIssue: {
    initial: "draft",
    transitions: { draft: ["posted", "cancelled"], posted: [], cancelled: [] },
  },
  inventoryTransfer: {
    initial: "draft",
    transitions: { draft: ["posted", "cancelled"], posted: [], cancelled: [] },
  },
  stockAdjustment: {
    initial: "draft",
    transitions: { draft: ["posted", "cancelled"], posted: [], cancelled: [] },
  },

  /* ---- Construction ----------------------------------------------------- */
  // A payment certificate pays a contractor when it posts, and the approval
  // levels recorded against it are the control on that money — see
  // lib/construction-approval.ts, which refuses the post until they clear.
  paymentCertificate: {
    initial: "draft",
    transitions: {
      draft: ["under_review", "cancelled"],
      under_review: ["approved", "draft", "rejected", "cancelled"],
      approved: ["posted", "cancelled"],
      posted: ["paid"],
      paid: [],
      rejected: [],
      cancelled: [],
    },
  },

  /* ---- Fixed assets ---------------------------------------------------- */
  assetTransfer: {
    initial: "pending",
    transitions: { pending: ["approved", "rejected", "cancelled"], approved: [], rejected: [], cancelled: [] },
  },
  assetDisposal: {
    initial: "pending",
    transitions: { pending: ["approved", "rejected", "cancelled"], approved: [], rejected: [], cancelled: [] },
  },

  /* ---- Legal ----------------------------------------------------------- */
  legalContract: {
    initial: "draft",
    transitions: {
      draft: ["under_review", "cancelled"],
      under_review: ["approved", "draft", "cancelled"],
      approved: ["active", "cancelled"],
      active: ["terminated", "archived"],
      terminated: ["archived"],
      archived: [],
      cancelled: [],
    },
  },
  legalCase: {
    initial: "open",
    transitions: { open: ["in_progress", "closed"], in_progress: ["closed"], closed: [] },
  },

  /* ---- Sales ----------------------------------------------------------- */
  // Confirming is a step a reservation may take, not one it must: sales
  // converts a live reservation straight to a contract, and the conversion
  // endpoint has always accepted an `active` one. Declaring `confirmed` as a
  // prerequisite would have broken the sale chain — it is a stop along the
  // way, not a gate.
  reservation: {
    initial: "active",
    transitions: {
      active: ["confirmed", "converted", "cancelled", "expired"],
      confirmed: ["converted", "cancelled", "expired"],
      converted: [],
      cancelled: [],
      expired: [],
    },
  },
  contract: {
    initial: "draft",
    transitions: { draft: ["active", "cancelled"], active: ["completed", "cancelled"], completed: [], cancelled: [] },
  },

  /* ---- Handover -------------------------------------------------------- */
  // The old guards refused only a repeat of the same decision, which left a
  // rejected approval open to being approved afterwards. A decision is final.
  handoverApproval: {
    initial: "pending",
    transitions: { pending: ["approved", "rejected"], approved: [], rejected: [] },
  },

  /* ---- General administration ------------------------------------------ */
  // Publishing fans an announcement out to its audience; it cannot be
  // un-published, only archived, because the recipients already have it.
  circular: {
    initial: "draft",
    transitions: { draft: ["published", "archived"], published: ["archived"], archived: [] },
  },

  /* ---- Security -------------------------------------------------------- */
  // A shift may be handed over straight from `scheduled` — a guard arriving to
  // a post nobody checked into still hands it to the next one — so both open
  // states reach the closing ones, exactly as the previous guard allowed.
  securityShift: {
    initial: "scheduled",
    transitions: {
      scheduled: ["in_progress", "completed", "handed_over", "cancelled"],
      in_progress: ["completed", "handed_over", "cancelled"],
      completed: [],
      handed_over: [],
      cancelled: [],
    },
  },

  /* ---- Correspondence --------------------------------------------------- */
  correspondence: {
    initial: "draft",
    transitions: { draft: ["sent"], sent: ["replied", "closed"], replied: ["closed"], closed: [] },
  },
};

/** Is this a state the lifecycle knows about at all? */
export function isKnownState(documentType: string, state: string): boolean {
  const lc = LIFECYCLES[documentType];
  return !!lc && state in lc.transitions;
}

/** A state with nowhere left to go. */
export function isTerminal(documentType: string, state: string): boolean {
  const lc = LIFECYCLES[documentType];
  if (!lc) return false;
  return (lc.transitions[state]?.length ?? 0) === 0;
}

/** May this record move from `from` to `to`? */
export function canTransition(documentType: string, from: string, to: string): boolean {
  const lc = LIFECYCLES[documentType];
  // No declared lifecycle means this module still owns its own rules.
  if (!lc) return true;
  if (from === to) return true;
  return (lc.transitions[from] ?? []).includes(to);
}

/**
 * Guard a transition, or explain why not.
 *
 * The message names the current state rather than only refusing, because
 * "already approved" tells an operator what happened while "invalid
 * transition" sends them to read the code.
 */
export function assertTransition(documentType: string, from: string, to: string): void {
  const lc = LIFECYCLES[documentType];
  if (!lc || from === to) return;

  if (!(from in lc.transitions)) {
    throw new LifecycleError(
      `This record is in an unrecognised state (${from}), so it cannot be changed to ${to}.`,
      documentType,
      from,
      to,
    );
  }

  const allowed = lc.transitions[from];
  if (allowed.includes(to)) return;

  if (allowed.length === 0) {
    throw new LifecycleError(
      `This record is ${from} and can no longer be changed.`,
      documentType,
      from,
      to,
    );
  }

  throw new LifecycleError(
    `A record that is ${from} cannot become ${to}. It can only become: ${allowed.join(", ")}.`,
    documentType,
    from,
    to,
  );
}

/**
 * Guard an action that *does* something, where repeating it is not harmless.
 *
 * `assertTransition` treats a move to the state a record is already in as a
 * no-op and allows it, which is right when a PATCH sets `status` to its current
 * value: nothing happens, so nothing needs refusing.
 *
 * It is wrong for an endpoint whose whole purpose is a side effect. Posting a
 * goods receipt that is already posted is not a no-op — it writes the stock
 * movements a second time, and the warehouse gains forty bags of cement that
 * never arrived. This was found exactly that way: a receipt posted twice
 * doubled the stock, because the guard saw `posted -> posted` and stepped
 * aside.
 *
 * So actions use this instead. The message names the state rather than saying
 * "invalid", because "this is already posted" tells an operator what happened.
 */
export function assertAction(documentType: string, from: string, to: string): void {
  if (from === to) {
    throw new LifecycleError(`This record is already ${to}.`, documentType, from, to);
  }
  assertTransition(documentType, from, to);
}

/** Every state a document type can hold, for a lookup or a filter. */
export function statesOf(documentType: string): string[] {
  const lc = LIFECYCLES[documentType];
  return lc ? Object.keys(lc.transitions) : [];
}
