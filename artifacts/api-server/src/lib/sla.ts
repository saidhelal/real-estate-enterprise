import { and, eq, not, isNotNull, lt, inArray } from "drizzle-orm";
import {
  db,
  slaPoliciesTable,
  serviceEscalationsTable,
  complaintsTable,
  supportTicketsTable,
  maintenanceRequestsTable,
} from "@workspace/db";
import { notify, recipientsByPermission } from "./notify";
import { nextNumber, type NumberTx } from "./doc-number";
import type { Tx } from "./posting";

/**
 * Service level agreements, and what happens when one is missed.
 *
 * `sla_policies` and `service_escalations` existed as two registers someone
 * could type rows into, and complaints, tickets and maintenance requests each
 * carried `slaPolicyId`, `dueAt`, `firstResponseAt` and `escalationLevel`.
 * Nothing wrote any of them. The executive dashboard averaged a
 * `first_response_at` that no code had ever set, so it reported nothing and
 * looked like it was reporting something — the worst of the three states a
 * metric can be in.
 *
 * This module is the one place that answers all four questions:
 *
 *   which policy applies      -> resolvePolicy
 *   when is it due            -> applyOnCreate
 *   has it been answered      -> stampFirstResponse
 *   has it been missed        -> sweepBreaches
 *
 * A register gains SLA behaviour by declaring which of its columns hold these
 * values, not by writing any of the rules again. The escalation code comes
 * from the central numbering engine like every other business identifier, and
 * recipients come from the permission that makes someone responsible — never
 * from a name written into a config.
 */

/** The service registers governed by an SLA, and where each keeps its clock. */
export type SlaSource = "complaint" | "supportTicket" | "maintenanceRequest";

interface SourceBinding {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any;
  /** The `channel` an SLA policy must match to apply to this register. */
  channel: string;
  /** Permission that makes someone answerable for these, and so a recipient. */
  ownerPermission: string;
  /** Statuses that are finished, so a missed target is no longer meaningful. */
  closedStatuses: string[];
}

const SOURCES: Record<SlaSource, SourceBinding> = {
  complaint: {
    table: complaintsTable,
    channel: "complaint",
    ownerPermission: "complaints.update",
    closedStatuses: ["resolved", "closed", "cancelled", "rejected"],
  },
  supportTicket: {
    table: supportTicketsTable,
    channel: "ticket",
    ownerPermission: "supportTickets.update",
    closedStatuses: ["resolved", "closed", "cancelled"],
  },
  maintenanceRequest: {
    table: maintenanceRequestsTable,
    channel: "maintenance",
    ownerPermission: "maintenanceRequests.update",
    closedStatuses: ["completed", "closed", "cancelled", "rejected"],
  },
};

export function slaSources(): SlaSource[] {
  return Object.keys(SOURCES) as SlaSource[];
}

/** Hours as a policy stores them (numeric text) to milliseconds. */
function hoursToMs(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 60 * 60 * 1000);
}

export interface ResolvedPolicy {
  id: string;
  firstResponseMs: number | null;
  resolutionMs: number | null;
}

/**
 * The policy that governs one record.
 *
 * Specificity decides, in one pass rather than four queries: a policy naming
 * both this channel and this priority beats one naming only the channel, which
 * beats the catch-all `all`. Without an ordering rule the answer would depend
 * on which row happened to be inserted first, and two companies with the same
 * policies would get different due dates.
 */
export async function resolvePolicy(
  exec: Tx | typeof db,
  companyId: string,
  source: SlaSource,
  priority: string | null,
): Promise<ResolvedPolicy | null> {
  const binding = SOURCES[source];
  const channels = [binding.channel, "all"];
  const priorities = priority ? [priority, "all"] : ["all"];

  const rows = await exec
    .select({
      id: slaPoliciesTable.id,
      channel: slaPoliciesTable.channel,
      priority: slaPoliciesTable.priority,
      firstResponseHours: slaPoliciesTable.firstResponseHours,
      resolutionHours: slaPoliciesTable.resolutionHours,
    })
    .from(slaPoliciesTable)
    .where(
      and(
        eq(slaPoliciesTable.isDeleted, false),
        eq(slaPoliciesTable.companyId, companyId),
        inArray(slaPoliciesTable.channel, channels),
        inArray(slaPoliciesTable.priority, priorities),
      ),
    );

  if (rows.length === 0) return null;

  const score = (r: { channel: string; priority: string }) =>
    (r.channel === binding.channel ? 2 : 0) + (priority && r.priority === priority ? 1 : 0);

  // Two policies can be equally specific — a company may well write both a
  // "complaints" policy and an "everything" one at the same priority. Left to
  // row order the winner would be whichever was inserted first, so the same
  // configuration would produce different deadlines on two installations.
  // The stricter promise wins: a company that wrote two applicable policies
  // has committed to both, and only the tighter one honours that.
  const strictness = (r: { resolutionHours: string; firstResponseHours: string }) =>
    hoursToMs(r.resolutionHours) ?? hoursToMs(r.firstResponseHours) ?? Number.MAX_SAFE_INTEGER;

  const best = rows.reduce((a, b) => {
    if (score(b) !== score(a)) return score(b) > score(a) ? b : a;
    if (strictness(b) !== strictness(a)) return strictness(b) < strictness(a) ? b : a;
    // Nothing left to distinguish them; the id keeps the answer stable rather
    // than dependent on the order the rows came back.
    return b.id < a.id ? b : a;
  });

  return {
    id: best.id,
    firstResponseMs: hoursToMs(best.firstResponseHours),
    resolutionMs: hoursToMs(best.resolutionHours),
  };
}

export interface SlaStamp {
  slaPolicyId: string | null;
  dueAt: Date | null;
}

/**
 * The policy and deadline a new record starts with.
 *
 * Computed from the record's own creation time rather than from `now()`, so
 * replaying or importing a record does not silently give it a fresh clock.
 * A company with no policy gets nulls: no policy means no promise, which is a
 * different thing from a promise of zero.
 */
export async function applyOnCreate(
  exec: Tx | typeof db,
  source: SlaSource,
  row: { companyId: string; priority?: unknown; createdAt?: unknown },
): Promise<SlaStamp> {
  const priority = typeof row.priority === "string" ? row.priority : null;
  const policy = await resolvePolicy(exec, row.companyId, source, priority);
  if (!policy) return { slaPolicyId: null, dueAt: null };

  const start = row.createdAt instanceof Date ? row.createdAt : new Date();
  // Resolution is the deadline that matters for a breach; a first-response
  // target with no resolution target still gives the record a due date,
  // because a policy that promises only a reply still promises something.
  const ms = policy.resolutionMs ?? policy.firstResponseMs;
  return {
    slaPolicyId: policy.id,
    dueAt: ms === null ? null : new Date(start.getTime() + ms),
  };
}

/**
 * Stamp the moment someone first answered.
 *
 * Written once and never revised — the value records when the customer
 * actually heard back, and a later edit would move a fact into the past.
 * Returns the field to write, or nothing when it is already set.
 */
export function stampFirstResponse(
  existing: { firstResponseAt?: unknown },
  update: { status?: unknown; assignedToUserId?: unknown },
): { firstResponseAt: Date } | null {
  if (existing.firstResponseAt) return null;
  // The first response is the first act of working it: taking ownership, or
  // moving it off the untouched state.
  const engaged =
    (typeof update.status === "string" && update.status !== "open" && update.status !== "new") ||
    (typeof update.assignedToUserId === "string" && update.assignedToUserId.length > 0);
  return engaged ? { firstResponseAt: new Date() } : null;
}

export interface SweepResult {
  /** Records past their due date and still open. */
  breached: number;
  /** Escalations raised in this pass — never more than one per record per level. */
  raised: number;
  /** Notifications issued; the engine de-duplicates, so this is an upper bound. */
  notified: number;
  /** Companies with nobody holding the owning permission. */
  skippedNoRecipients: number;
}

const EMPTY_SWEEP: SweepResult = {
  breached: 0,
  raised: 0,
  notified: 0,
  skippedNoRecipients: 0,
};

/**
 * Raise an escalation for everything that has missed its deadline.
 *
 * Idempotent by construction: a record's escalation level is stored on the
 * record, and an escalation is only raised when the level about to be written
 * is higher than the one already there. Running this every ten minutes
 * therefore produces one escalation per breach, not one every ten minutes.
 *
 * Never throws — a scheduled sweep that fails loudly on one company would stop
 * the others, and this is a notification, not a posting.
 */
export async function sweepBreaches(
  source: SlaSource,
  companyId: string,
  now: Date = new Date(),
): Promise<SweepResult> {
  const binding = SOURCES[source];
  const result: SweepResult = { ...EMPTY_SWEEP };

  const overdue = await db
    .select()
    .from(binding.table)
    .where(
      and(
        eq(binding.table.isDeleted, false),
        eq(binding.table.companyId, companyId),
        isNotNull(binding.table.dueAt),
        lt(binding.table.dueAt, now),
        // `NOT IN` through the ORM rather than a hand-built ANY(): drizzle
        // binds the list as parameters, where interpolating a JS array into
        // `<> ALL(...)` hands Postgres a string it cannot treat as an array.
        not(inArray(binding.table.status, binding.closedStatuses)),
      ),
    );

  result.breached = overdue.length;
  if (overdue.length === 0) return result;

  // Everyone answerable for this register in this company. Resolved once per
  // sweep, and per company, so one company's escalations cannot reach another.
  const recipients = await recipientsByPermission(db, binding.ownerPermission, { companyId });
  if (recipients.length === 0) result.skippedNoRecipients = 1;

  for (const row of overdue) {
    const currentLevel = Number(row.escalationLevel ?? 0) || 0;
    const nextLevel = currentLevel + 1;

    // How far past the deadline decides the level: one escalation when it
    // slips, a second when it has slipped by as long again. Without this the
    // level would climb on a clock rather than on the facts.
    const overdueMs = now.getTime() - new Date(row.dueAt as Date).getTime();
    const dueSpanMs = Math.max(
      1,
      new Date(row.dueAt as Date).getTime() - new Date(row.createdAt as Date).getTime(),
    );
    const earnedLevel = Math.min(3, 1 + Math.floor(overdueMs / dueSpanMs));
    if (earnedLevel < nextLevel) continue;

    await db.transaction(async (tx) => {
      const code = (await nextNumber("serviceEscalation", companyId, tx as NumberTx)).value;
      const [escalation] = await tx.insert(serviceEscalationsTable).values({
        companyId,
        code,
        sourceType: source,
        sourceId: row.id as string,
        level: String(nextLevel),
        reason: `Missed the agreed ${binding.channel} response time.`,
        reasonAr: "تجاوز الوقت المتفق عليه للاستجابة.",
        status: "open",
        escalatedAt: now.toISOString().slice(0, 10),
      }).returning({ id: serviceEscalationsTable.id });
      await tx
        .update(binding.table)
        .set({ escalationLevel: String(nextLevel) })
        .where(eq(binding.table.id, row.id as string));
      result.raised++;

      if (recipients.length > 0) {
        result.notified += await notify(tx, {
          recipientUserIds: recipients,
          category: "customer_service",
          eventType: "sla_breached",
          priority: nextLevel >= 2 ? "urgent" : "high",
          title: "A service request has missed its agreed response time",
          body: `${String(row.code ?? "")} — ${String(row.subject ?? "")}`,
          sourceModule: `${source}Escalation`,
          // The escalation row, not the record it concerns. `sourceId` is what
          // makes a notification unique, and pointing it at the complaint would
          // suppress the level-2 alert as a duplicate of level 1. Each
          // escalation is its own event and deserves its own notice.
          sourceId: escalation.id,
          sourceRef: String(row.code ?? ""),
          companyId,
        });
      }
    });
  }

  return result;
}

/** Sweep every governed register for one company. */
export async function sweepCompany(companyId: string, now: Date = new Date()): Promise<SweepResult> {
  const total: SweepResult = { ...EMPTY_SWEEP };
  for (const source of slaSources()) {
    const r = await sweepBreaches(source, companyId, now);
    total.breached += r.breached;
    total.raised += r.raised;
    total.notified += r.notified;
    total.skippedNoRecipients += r.skippedNoRecipients;
  }
  return total;
}
