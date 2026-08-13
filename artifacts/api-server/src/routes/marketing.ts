import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  db,
  marketingCampaignsTable,
  marketingChannelsTable,
  marketingDistributionRulesTable,
  marketingDistributionAgentsTable,
  marketingDistributionLogsTable,
  leadSourcesTable,
  leadsTable,
} from "@workspace/db";
import {
  ListMarketingCampaignsResponse,
  GetMarketingCampaignResponse,
  CreateMarketingCampaignBody,
  UpdateMarketingCampaignBody,
  ListMarketingChannelsResponse,
  CreateMarketingChannelBody,
  GetMarketingChannelResponse,
  UpdateMarketingChannelBody,
  GetMarketingDashboardResponse,
  ListMarketingDistributionRulesResponse,
  CreateMarketingDistributionRuleBody,
  GetMarketingDistributionRuleResponse,
  UpdateMarketingDistributionRuleBody,
  ListMarketingDistributionAgentsResponse,
  CreateMarketingDistributionAgentBody,
  GetMarketingDistributionAgentResponse,
  UpdateMarketingDistributionAgentBody,
  ListMarketingDistributionLogsResponse,
  CreateMarketingLeadBody,
  GetLeadResponse,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { nextDocumentNumber } from "../lib/doc-number";
import { distributeLead } from "../lib/lead-distribution";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

// Marketing Management (إدارة التسويق): campaigns, marketing channels, and a
// live dashboard. Lead Sources are intentionally NOT defined here — they reuse
// the existing CRM `lead_sources` table and its `/lead-sources` endpoints, so
// Marketing surfaces the same single source of truth (no duplicate table).
// Generic CRUD per entity (soft-delete list with search/filters), each guarded
// by `${module}.${action}`, best-effort audit. serializeRow converts Date->ISO.

interface CrudSchema {
  parse: (v: unknown) => unknown;
  safeParse: (
    v: unknown,
  ) =>
    | { success: true; data: Record<string, unknown> }
    | { success: false; error: { message: string } };
}

import { registerCrud } from "../lib/register-crud";


// Marketing campaigns: custom create so `code` is auto-generated from the
// "MarketingCampaign" number sequence when the client omits it (mirrors the
// sales contract pattern). List/get/patch/delete reuse the generic CRUD.
type Row = Record<string, unknown>;

router.get("/marketing-campaigns", requirePermission("marketing.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(marketingCampaignsTable.isDeleted, false)];
  const search = qStr(q, "search");
  if (search) {
    const s = or(
      ilike(marketingCampaignsTable.code, `%${search}%`),
      ilike(marketingCampaignsTable.name, `%${search}%`),
    );
    if (s) filters.push(s);
  }
  for (const c of ["companyId", "branchId", "projectId", "campaignType", "status", "ownerUserId"] as const) {
    const v = qStr(q, c);
    if (v) filters.push(eq(marketingCampaignsTable[c], v));
  }
  const where = and(...filters);
  const countRes = (await db.select({ count: sql<number>`count(*)::int` }).from(marketingCampaignsTable).where(where)) as { count: number }[];
  const rows = (await db.select().from(marketingCampaignsTable).where(where).orderBy(desc(marketingCampaignsTable.createdAt)).limit(pageSize).offset(offset)) as Row[];
  res.json(ListMarketingCampaignsResponse.parse({ data: rows.map(serializeRow), total: countRes[0].count, page, pageSize }));
});

router.post("/marketing-campaigns", requirePermission("marketing.create"), async (req, res): Promise<void> => {
  const parsed = CreateMarketingCampaignBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data as Record<string, unknown>;
  const code = (data.code as string | undefined) || (await nextDocumentNumber("MarketingCampaign")) || `MKC-${Date.now()}`;
  const values = { ...data, code } as unknown as typeof marketingCampaignsTable.$inferInsert;
  const inserted = (await db.insert(marketingCampaignsTable).values(values).returning()) as Row[];
  const row = inserted[0];
  await recordAudit(req, { action: "create", entity: "marketingCampaign", entityId: String(row.id), newValue: row });
  res.status(201).json(GetMarketingCampaignResponse.parse(serializeRow(row)));
});

router.get("/marketing-campaigns/:id", requirePermission("marketing.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const found = (await db.select().from(marketingCampaignsTable).where(and(eq(marketingCampaignsTable.id, id), eq(marketingCampaignsTable.isDeleted, false)))) as Row[];
  const row = found[0];
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetMarketingCampaignResponse.parse(serializeRow(row)));
});

router.patch("/marketing-campaigns/:id", requirePermission("marketing.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateMarketingCampaignBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const found = (await db.select().from(marketingCampaignsTable).where(and(eq(marketingCampaignsTable.id, id), eq(marketingCampaignsTable.isDeleted, false)))) as Row[];
  const existing = found[0];
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data } as Record<string, unknown>;
  const row = Object.keys(update).length
    ? ((await db.update(marketingCampaignsTable).set(update).where(eq(marketingCampaignsTable.id, id)).returning()) as Row[])[0]
    : existing;
  await recordAudit(req, { action: "update", entity: "marketingCampaign", entityId: id, oldValue: existing, newValue: row });
  res.json(GetMarketingCampaignResponse.parse(serializeRow(row)));
});

router.delete("/marketing-campaigns/:id", requirePermission("marketing.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const updated = (await db.update(marketingCampaignsTable).set({ isDeleted: true, isActive: false }).where(and(eq(marketingCampaignsTable.id, id), eq(marketingCampaignsTable.isDeleted, false))).returning()) as Row[];
  if (!updated[0]) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "marketingCampaign", entityId: id });
  res.json({ success: true });
});

registerCrud(router, {
  base: "/marketing-channels",
  module: "marketingChannels",
  entity: "marketingChannel",
  table: marketingChannelsTable,
  searchCols: ["code", "name", "nameAr"],
  filterCols: ["companyId", "channelType"],
  listResp: ListMarketingChannelsResponse,
  createBody: CreateMarketingChannelBody,
  getResp: GetMarketingChannelResponse,
  updateBody: UpdateMarketingChannelBody,
});

// Smart Lead Distribution Engine: dynamic rules + the eligible agent roster are
// standard CRUD entities; the engine (lib/lead-distribution.ts) reads them at
// lead-intake time. Distribution logs are read-only (written only by the engine).
registerCrud(router, {
  base: "/marketing-distribution-rules",
  module: "marketingDistributionRules",
  entity: "marketingDistributionRule",
  table: marketingDistributionRulesTable,
  searchCols: ["code", "name", "nameAr"],
  filterCols: ["companyId", "strategy", "campaignId", "channelId"],
  listResp: ListMarketingDistributionRulesResponse,
  createBody: CreateMarketingDistributionRuleBody,
  getResp: GetMarketingDistributionRuleResponse,
  updateBody: UpdateMarketingDistributionRuleBody,
});

registerCrud(router, {
  base: "/marketing-distribution-agents",
  module: "marketingDistributionAgents",
  entity: "marketingDistributionAgent",
  table: marketingDistributionAgentsTable,
  searchCols: ["userId"],
  filterCols: ["companyId", "userId"],
  listResp: ListMarketingDistributionAgentsResponse,
  createBody: CreateMarketingDistributionAgentBody,
  getResp: GetMarketingDistributionAgentResponse,
  updateBody: UpdateMarketingDistributionAgentBody,
});

// Distribution logs: read-only audit of every automatic assignment decision.
router.get("/marketing-distribution-logs", requirePermission("marketingDistributionLogs.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(marketingDistributionLogsTable.isDeleted, false)];
  const search = qStr(q, "search");
  if (search) {
    const s = ilike(marketingDistributionLogsTable.reason, `%${search}%`);
    if (s) filters.push(s);
  }
  for (const c of ["companyId", "leadId", "ruleId", "assignedToUserId", "strategy"] as const) {
    const v = qStr(q, c);
    if (v) filters.push(eq(marketingDistributionLogsTable[c], v));
  }
  const where = and(...filters);
  const countRes = (await db.select({ count: sql<number>`count(*)::int` }).from(marketingDistributionLogsTable).where(where)) as { count: number }[];
  const rows = (await db.select().from(marketingDistributionLogsTable).where(where).orderBy(desc(marketingDistributionLogsTable.createdAt)).limit(pageSize).offset(offset)) as Record<string, unknown>[];
  res.json(ListMarketingDistributionLogsResponse.parse({ data: rows.map(serializeRow), total: countRes[0].count, page, pageSize }));
});

// Marketing lead intake: create a lead in the existing Sales Leads table with
// marketing attribution (campaign/channel/source) and auto-run the distribution
// engine — all in one transaction. The lead `code` is auto-generated from the
// "Lead" number sequence. Reuses the `leads.create` permission (it creates a
// lead). `autoDistribute` defaults to true; set false to leave it unassigned.
router.post("/marketing-leads", requirePermission("leads.create"), async (req, res): Promise<void> => {
  const parsed = CreateMarketingLeadBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data as Record<string, unknown>;
  const autoDistribute = data.autoDistribute !== false;
  const code = (await nextDocumentNumber("Lead")) || `LEAD-${Date.now()}`;
  const values = {
    companyId: data.companyId,
    branchId: data.branchId,
    fullName: data.fullName,
    phone: data.phone,
    email: data.email,
    sourceId: data.sourceId,
    campaignId: data.campaignId,
    channelId: data.channelId,
    budget: data.budget,
    notes: data.notes,
    code,
    status: "new",
  } as unknown as typeof leadsTable.$inferInsert;

  const finalLead = await db.transaction(async (tx) => {
    const inserted = await tx.insert(leadsTable).values(values).returning();
    let lead = inserted[0];
    if (autoDistribute) {
      // Best-effort: distribution must never block lead creation.
      try {
        await distributeLead(tx, lead, req.authUser?.id ?? null);
        const refreshed = await tx.select().from(leadsTable).where(eq(leadsTable.id, lead.id));
        if (refreshed[0]) lead = refreshed[0];
      } catch (err) {
        req.log.error({ err, leadId: lead.id }, "lead distribution failed");
      }
    }
    return lead;
  });

  await recordAudit(req, { action: "create", entity: "lead", entityId: finalLead.id, newValue: finalLead });
  res.status(201).json(GetLeadResponse.parse(serializeRow(finalLead)));
});

// Manually (re)run the distribution engine for an existing unassigned lead.
router.post("/marketing-leads/:id/distribute", requirePermission("leads.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const finalLead = await db.transaction(async (tx) => {
    const found = await tx.select().from(leadsTable).where(and(eq(leadsTable.id, id), eq(leadsTable.isDeleted, false)));
    const lead = found[0];
    if (!lead) return null;
    await distributeLead(tx, lead, req.authUser?.id ?? null);
    const refreshed = await tx.select().from(leadsTable).where(eq(leadsTable.id, id));
    return refreshed[0] ?? lead;
  });
  if (!finalLead) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "update", entity: "lead", entityId: id, newValue: finalLead });
  res.json(GetLeadResponse.parse(serializeRow(finalLead)));
});

// Marketing dashboard: live counts + budget totals. Permission-gated like the
// other per-module dashboards (uses the module's own view permission).
router.get("/marketing-dashboard", requirePermission("marketing.view"), async (req, res): Promise<void> => {
  const companyId = qStr(req.query as Record<string, unknown>, "companyId");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countOf = async (table: any, extra?: SQL): Promise<number> => {
    const f: SQL[] = [eq(table.isDeleted, false)];
    if (companyId) f.push(eq(table.companyId, companyId));
    if (extra) f.push(extra);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(table).where(and(...f));
    return count;
  };
  const moneyFilters: SQL[] = [eq(marketingCampaignsTable.isDeleted, false)];
  if (companyId) moneyFilters.push(eq(marketingCampaignsTable.companyId, companyId));
  const [
    campaignsCount,
    runningCampaignsCount,
    channelsCount,
    leadSourcesCount,
    [money],
  ] = await Promise.all([
    countOf(marketingCampaignsTable),
    countOf(marketingCampaignsTable, eq(marketingCampaignsTable.status, "active")),
    countOf(marketingChannelsTable),
    countOf(leadSourcesTable),
    db
      .select({
        totalBudget: sql<string>`coalesce(sum(${marketingCampaignsTable.budget}), 0)::text`,
        totalActualCost: sql<string>`coalesce(sum(${marketingCampaignsTable.actualCost}), 0)::text`,
      })
      .from(marketingCampaignsTable)
      .where(and(...moneyFilters)),
  ]);
  res.json(
    GetMarketingDashboardResponse.parse({
      campaignsCount,
      runningCampaignsCount,
      channelsCount,
      leadSourcesCount,
      totalBudget: money.totalBudget,
      totalActualCost: money.totalActualCost,
    }),
  );
});

export default router;
