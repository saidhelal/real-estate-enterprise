import { and, eq, isNull, or } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";

/**
 * Who may approve what, and who may not.
 *
 * The approval queue already existed — a change request records who asked, who
 * reviewed and what happened. What it did not do was refuse anyone: whoever
 * held `approvals.approve` could approve anything, including their own request.
 * That is the control most often asked for in an audit and the one most often
 * missing, because the queue looks complete without it.
 *
 * Two rules live here, and only here. Every approval path asks this module
 * rather than deciding for itself, so a second module cannot answer the same
 * question differently.
 */

/** Why an approval was refused, in the words the approver needs to hear. */
export interface AuthorityDecision {
  allowed: boolean;
  reason?: string;
  /** The limit that refused it, when refusal was about an amount. */
  limit?: string;
}

const ALLOWED = { allowed: true } as const;

/**
 * Separation of duties: the person who asked cannot be the person who agrees.
 *
 * Not configurable, and deliberately so. An approval that the requester can
 * grant is not an approval — it is a second click. Making it a setting invites
 * it to be switched off on the day it would first have mattered.
 *
 * A wildcard holder is not exempt. The platform administrator can do anything
 * the system offers, but "approve your own request" is not something the system
 * offers to anyone: the record would show one name in both columns, which is
 * exactly what the control exists to prevent.
 */
export function separationOfDuties(requestedBy: string, approverId: string): AuthorityDecision {
  if (requestedBy !== approverId) return ALLOWED;
  return {
    allowed: false,
    reason:
      "You raised this request, so you cannot approve it. Someone else with approval rights must review it.",
  };
}

/**
 * The settings key holding approval limits.
 *
 * Stored as settings rather than code because a limit is a business decision
 * that changes without a release — and read through the settings table that
 * already owns every other tunable, rather than a table of its own.
 *
 * Shape: `{ "<permissionCode>": <maxAmount>, "default": <maxAmount> }`
 * A role with no entry and no default is unlimited, which keeps the system
 * behaving exactly as it did until someone configures a limit.
 */
export const APPROVAL_LIMITS_KEY = "approvals.limits";

interface Limits {
  [permissionOrDefault: string]: number;
}

async function loadLimits(): Promise<Limits | null> {
  try {
    const [row] = await db
      .select({ value: settingsTable.value })
      .from(settingsTable)
      .where(eq(settingsTable.key, APPROVAL_LIMITS_KEY))
      .limit(1);
    if (!row?.value) return null;
    const parsed = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
    return parsed && typeof parsed === "object" ? (parsed as Limits) : null;
  } catch {
    // A malformed or unreachable setting must not block an approval — it would
    // turn a configuration typo into a halt on every financial decision. The
    // absence of a limit is the documented "unlimited" case.
    return null;
  }
}

/**
 * Is this approver allowed to approve this amount?
 *
 * The amount comes from the request payload where the request carries one. A
 * request with no amount is not an amount decision, so no limit applies —
 * approving a name change is not the same act as approving a payment.
 */
export async function withinApprovalLimit(
  permissions: string[],
  amount: number | null,
): Promise<AuthorityDecision> {
  if (amount === null || !Number.isFinite(amount)) return ALLOWED;

  const limits = await loadLimits();
  if (!limits) return ALLOWED;

  // The most generous limit the approver's permissions grant. Someone holding
  // two roles approves at the higher of the two, which is what "this person is
  // also a director" is supposed to mean.
  let best: number | null = null;
  for (const code of permissions) {
    const v = limits[code];
    if (typeof v === "number" && (best === null || v > best)) best = v;
  }
  if (best === null && typeof limits.default === "number") best = limits.default;
  if (best === null) return ALLOWED;

  if (amount <= best) return ALLOWED;
  return {
    allowed: false,
    limit: String(best),
    reason:
      `This request is for ${amount}, above your approval limit of ${best}. ` +
      `Someone with a higher limit must approve it.`,
  };
}

/**
 * Pull the amount a change request is really about, if it has one.
 *
 * Payload keys differ by module — an invoice has `amount`, a voucher has
 * `amount`, a contract has `totalValue`. Reading a fixed key would silently
 * apply no limit to half the modules, which is worse than applying none at all
 * because it looks like it is working.
 */
export function amountFromPayload(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  for (const key of ["amount", "totalValue", "total", "netAmount", "grandTotal", "value"]) {
    const raw = p[key];
    if (raw === undefined || raw === null) continue;
    const n = typeof raw === "number" ? raw : Number(String(raw));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * The one gate every approval passes through.
 *
 * Both rules in one call so a caller cannot check separation of duties and
 * forget the limit, or the other way round.
 */
export async function canApprove(input: {
  requestedBy: string;
  approverId: string;
  approverPermissions: string[];
  payload: unknown;
}): Promise<AuthorityDecision> {
  const sod = separationOfDuties(input.requestedBy, input.approverId);
  if (!sod.allowed) return sod;
  return withinApprovalLimit(input.approverPermissions, amountFromPayload(input.payload));
}
