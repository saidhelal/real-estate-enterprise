import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  db,
  marketingCampaignsTable,
  marketingChannelsTable,
  leadSourcesTable,
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
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { nextDocumentNumber } from "../lib/doc-number";
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

function registerCrud(opts: {
  base: string;
  module: string;
  entity: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any;
  searchCols: string[];
  filterCols: string[];
  listResp: CrudSchema;
  createBody: CrudSchema;
  getResp: CrudSchema;
  updateBody: CrudSchema;
}): void {
  const { base, module, entity, table, searchCols, filterCols, listResp, createBody, getResp, updateBody } = opts;
  type Row = Record<string, unknown>;

  router.get(base, requirePermission(`${module}.view`), async (req, res): Promise<void> => {
    const q = req.query as Record<string, unknown>;
    const { page, pageSize, offset } = pageParams(q);
    const filters: SQL[] = [eq(table.isDeleted, false)];
    const search = qStr(q, "search");
    if (search) {
      const s = or(...searchCols.map((c) => ilike(table[c], `%${search}%`)));
      if (s) filters.push(s);
    }
    for (const c of filterCols) {
      const v = qStr(q, c);
      if (v) filters.push(eq(table[c], v));
    }
    const where = and(...filters);
    const countRes = (await db.select({ count: sql<number>`count(*)::int` }).from(table).where(where)) as { count: number }[];
    const rows = (await db.select().from(table).where(where).orderBy(desc(table.createdAt)).limit(pageSize).offset(offset)) as Row[];
    res.json(listResp.parse({ data: rows.map(serializeRow), total: countRes[0].count, page, pageSize }));
  });

  router.post(base, requirePermission(`${module}.create`), async (req, res): Promise<void> => {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
    const inserted = (await db.insert(table).values({ ...parsed.data }).returning()) as Row[];
    const row = inserted[0];
    await recordAudit(req, { action: "create", entity, entityId: String(row.id), newValue: row });
    res.status(201).json(getResp.parse(serializeRow(row)));
  });

  router.get(`${base}/:id`, requirePermission(`${module}.view`), async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const found = (await db.select().from(table).where(and(eq(table.id, id), eq(table.isDeleted, false)))) as Row[];
    const row = found[0];
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(getResp.parse(serializeRow(row)));
  });

  router.patch(`${base}/:id`, requirePermission(`${module}.update`), async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const parsed = updateBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
    const found = (await db.select().from(table).where(and(eq(table.id, id), eq(table.isDeleted, false)))) as Row[];
    const existing = found[0];
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }
    const update = { ...parsed.data };
    const row = Object.keys(update).length
      ? ((await db.update(table).set(update).where(eq(table.id, id)).returning()) as Row[])[0]
      : existing;
    await recordAudit(req, { action: "update", entity, entityId: id, oldValue: existing, newValue: row });
    res.json(getResp.parse(serializeRow(row)));
  });

  router.delete(`${base}/:id`, requirePermission(`${module}.delete`), async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const updated = (await db.update(table).set({ isDeleted: true, isActive: false }).where(and(eq(table.id, id), eq(table.isDeleted, false))).returning()) as Row[];
    if (!updated[0]) { res.status(404).json({ error: "Not found" }); return; }
    await recordAudit(req, { action: "delete", entity, entityId: id });
    res.json({ success: true });
  });
}

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
  const inserted = (await db.insert(marketingCampaignsTable).values({ ...data, code }).returning()) as Row[];
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

registerCrud({
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
