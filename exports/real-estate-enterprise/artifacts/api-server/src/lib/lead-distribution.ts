import { and, eq, sql, asc, inArray, isNull } from "drizzle-orm";
import {
  leadsTable,
  leadAssignmentsTable,
  leadConversionsTable,
  marketingDistributionRulesTable,
  marketingDistributionAgentsTable,
  marketingDistributionLogsTable,
  type LeadRow,
} from "@workspace/db";
import type { Tx } from "./posting";

// --- Smart Lead Distribution Engine (Phase 3) ---
// Best-effort, idempotent auto-assignment of an incoming lead to a sales agent.
// Runs INSIDE the caller's transaction (mirrors lib/integrations.ts) so the
// lead create + assignment + log either all commit or all roll back.
//
// Flow: find the highest-priority active rule whose (nullable=wildcard) criteria
// match the lead, resolve the candidate agent pool, pick one per the rule's
// strategy, then update the lead, record a lead_assignment, and write a
// distribution log. If nothing matches (no rule / no eligible agent / already
// assigned) it returns null and leaves the lead untouched — distribution must
// never block lead creation.

// Statuses that still consume an agent's capacity (used by load_balanced).
const OPEN_LEAD_STATUSES = ["new", "contacted", "qualified", "negotiation", "proposal"];

export interface DistributionResult {
  assignedToUserId: string;
  ruleId: string | null;
  strategy: string;
  score: number | null;
  reason: string;
}

interface AgentStat {
  userId: string;
  weight: number;
  assignments: number; // lifetime assignments (round_robin)
  openLeads: number; // currently open leads (load_balanced)
  conversions: number; // lifetime conversions (performance)
}

function matchesLead(
  rule: typeof marketingDistributionRulesTable.$inferSelect,
  lead: LeadRow,
): boolean {
  if (rule.campaignId && rule.campaignId !== lead.campaignId) return false;
  if (rule.channelId && rule.channelId !== lead.channelId) return false;
  if (rule.sourceId && rule.sourceId !== lead.sourceId) return false;
  if (rule.branchId && rule.branchId !== lead.branchId) return false;
  return true;
}

async function loadAgentStats(
  tx: Tx,
  companyId: string,
  userIds: string[],
): Promise<Map<string, { assignments: number; openLeads: number; conversions: number }>> {
  const out = new Map<string, { assignments: number; openLeads: number; conversions: number }>();
  for (const id of userIds) out.set(id, { assignments: 0, openLeads: 0, conversions: 0 });
  if (userIds.length === 0) return out;

  const assignmentRows = await tx
    .select({
      userId: leadAssignmentsTable.assignedToUserId,
      count: sql<number>`count(*)::int`,
    })
    .from(leadAssignmentsTable)
    .where(
      and(
        eq(leadAssignmentsTable.companyId, companyId),
        eq(leadAssignmentsTable.isDeleted, false),
        inArray(leadAssignmentsTable.assignedToUserId, userIds),
      ),
    )
    .groupBy(leadAssignmentsTable.assignedToUserId);
  for (const r of assignmentRows) {
    const e = out.get(r.userId);
    if (e) e.assignments = r.count;
  }

  const openRows = await tx
    .select({
      userId: leadsTable.assignedToUserId,
      count: sql<number>`count(*)::int`,
    })
    .from(leadsTable)
    .where(
      and(
        eq(leadsTable.companyId, companyId),
        eq(leadsTable.isDeleted, false),
        inArray(leadsTable.assignedToUserId, userIds),
        inArray(leadsTable.status, OPEN_LEAD_STATUSES),
      ),
    )
    .groupBy(leadsTable.assignedToUserId);
  for (const r of openRows) {
    if (!r.userId) continue;
    const e = out.get(r.userId);
    if (e) e.openLeads = r.count;
  }

  const conversionRows = await tx
    .select({
      userId: leadConversionsTable.convertedByUserId,
      count: sql<number>`count(*)::int`,
    })
    .from(leadConversionsTable)
    .where(
      and(
        eq(leadConversionsTable.companyId, companyId),
        eq(leadConversionsTable.isDeleted, false),
        inArray(leadConversionsTable.convertedByUserId, userIds),
      ),
    )
    .groupBy(leadConversionsTable.convertedByUserId);
  for (const r of conversionRows) {
    if (!r.userId) continue;
    const e = out.get(r.userId);
    if (e) e.conversions = r.count;
  }

  return out;
}

// Pick the winning agent + a human-readable reason for a strategy.
function pickAgent(
  strategy: string,
  agents: AgentStat[],
  maxLeadsPerAgent: number | null,
): { agent: AgentStat; score: number | null; reason: string } | null {
  if (agents.length === 0) return null;

  if (strategy === "performance") {
    // Highest conversion rate (conversions / max(assignments,1)); tie -> least open.
    let best = agents[0];
    let bestRate = best.conversions / Math.max(best.assignments, 1);
    for (const a of agents.slice(1)) {
      const rate = a.conversions / Math.max(a.assignments, 1);
      if (rate > bestRate || (rate === bestRate && a.openLeads < best.openLeads)) {
        best = a;
        bestRate = rate;
      }
    }
    return {
      agent: best,
      score: Number(bestRate.toFixed(4)),
      reason: `performance: conversion rate ${(bestRate * 100).toFixed(1)}% (${best.conversions}/${best.assignments})`,
    };
  }

  if (strategy === "load_balanced") {
    // Fewest open leads per unit weight; honour the optional per-agent cap as a
    // HARD cap — if every agent is at/over the limit, leave the lead unassigned
    // rather than overfilling a saturated agent.
    const pool =
      maxLeadsPerAgent == null
        ? agents
        : agents.filter((a) => a.openLeads < maxLeadsPerAgent);
    if (pool.length === 0) return null;
    let best = pool[0];
    let bestLoad = best.openLeads / Math.max(best.weight, 1);
    for (const a of pool.slice(1)) {
      const load = a.openLeads / Math.max(a.weight, 1);
      if (load < bestLoad || (load === bestLoad && a.assignments < best.assignments)) {
        best = a;
        bestLoad = load;
      }
    }
    return {
      agent: best,
      score: Number(bestLoad.toFixed(4)),
      reason: `load_balanced: ${best.openLeads} open lead(s), weight ${best.weight}`,
    };
  }

  // Default: round_robin — fewest lifetime assignments per unit weight.
  let best = agents[0];
  let bestLoad = best.assignments / Math.max(best.weight, 1);
  for (const a of agents.slice(1)) {
    const load = a.assignments / Math.max(a.weight, 1);
    if (load < bestLoad || (load === bestLoad && a.openLeads < best.openLeads)) {
      best = a;
      bestLoad = load;
    }
  }
  return {
    agent: best,
    score: Number(bestLoad.toFixed(4)),
    reason: `round_robin: ${best.assignments} prior assignment(s), weight ${best.weight}`,
  };
}

// Distribute a (already-persisted) lead. Idempotent: a lead that already has an
// assignee is returned untouched. `assignedByUserId` is the acting user (or null
// for system/automatic intake).
export async function distributeLead(
  tx: Tx,
  lead: LeadRow,
  assignedByUserId: string | null,
): Promise<DistributionResult | null> {
  if (lead.assignedToUserId) return null; // already assigned -> idempotent no-op

  const rules = await tx
    .select()
    .from(marketingDistributionRulesTable)
    .where(
      and(
        eq(marketingDistributionRulesTable.companyId, lead.companyId),
        eq(marketingDistributionRulesTable.isDeleted, false),
        eq(marketingDistributionRulesTable.isActive, true),
      ),
    )
    .orderBy(
      asc(marketingDistributionRulesTable.priority),
      asc(marketingDistributionRulesTable.createdAt),
    );

  const rule = rules.find((r) => matchesLead(r, lead));
  if (!rule) return null;

  let chosenUserId: string;
  const strategy = rule.strategy;
  let score: number | null = null;
  let reason: string;

  if (rule.strategy === "direct") {
    if (!rule.targetUserId) return null;
    chosenUserId = rule.targetUserId;
    reason = "direct: rule target agent";
  } else {
    const roster = await tx
      .select({
        userId: marketingDistributionAgentsTable.userId,
        weight: marketingDistributionAgentsTable.weight,
      })
      .from(marketingDistributionAgentsTable)
      .where(
        and(
          eq(marketingDistributionAgentsTable.companyId, lead.companyId),
          eq(marketingDistributionAgentsTable.isDeleted, false),
          eq(marketingDistributionAgentsTable.isActive, true),
        ),
      );
    if (roster.length === 0) return null; // no eligible agents -> leave unassigned

    const statsById = await loadAgentStats(
      tx,
      lead.companyId,
      roster.map((a) => a.userId),
    );
    const agents: AgentStat[] = roster.map((a) => {
      const s = statsById.get(a.userId) ?? { assignments: 0, openLeads: 0, conversions: 0 };
      return { userId: a.userId, weight: a.weight, ...s };
    });

    const picked = pickAgent(rule.strategy, agents, rule.maxLeadsPerAgent);
    if (!picked) return null;
    chosenUserId = picked.agent.userId;
    score = picked.score;
    reason = picked.reason;
  }

  // Concurrency-safe claim: only assign if the lead is still unassigned. Under
  // concurrent /distribute calls the loser's UPDATE matches zero rows, so it
  // bails out before writing a duplicate assignment/log (idempotent).
  const claimed = await tx
    .update(leadsTable)
    .set({ assignedToUserId: chosenUserId })
    .where(and(eq(leadsTable.id, lead.id), isNull(leadsTable.assignedToUserId)))
    .returning({ id: leadsTable.id });
  if (claimed.length === 0) return null;

  await tx.insert(leadAssignmentsTable).values({
    companyId: lead.companyId,
    leadId: lead.id,
    assignedToUserId: chosenUserId,
    assignedByUserId: assignedByUserId ?? undefined,
    notes: `Auto-distributed via rule ${rule.code} (${strategy})`,
  });

  await tx.insert(marketingDistributionLogsTable).values({
    companyId: lead.companyId,
    leadId: lead.id,
    ruleId: rule.id,
    assignedToUserId: chosenUserId,
    strategy,
    score: score == null ? undefined : String(score),
    reason,
  });

  return { assignedToUserId: chosenUserId, ruleId: rule.id, strategy, score, reason };
}
