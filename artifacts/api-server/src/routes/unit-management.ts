import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  db,
  unitPriceListsTable,
  unitPricingTable,
  unitDiscountsTable,
  unitsTable,
  unitStatusesTable,
} from "@workspace/db";
import {
  ListUnitPriceListsResponse,
  CreateUnitPriceListBody,
  GetUnitPriceListResponse,
  UpdateUnitPriceListBody,
  ListUnitPricingsResponse,
  CreateUnitPricingBody,
  GetUnitPricingResponse,
  UpdateUnitPricingBody,
  ListUnitDiscountsResponse,
  CreateUnitDiscountBody,
  GetUnitDiscountResponse,
  UpdateUnitDiscountBody,
  GetUnitAvailabilityResponse,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { nextNumber } from "../lib/doc-number";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

// ----- unitPriceLists -----
router.get("/unit-price-lists", requirePermission("unitPriceLists.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(unitPriceListsTable.isDeleted, false)];
  if (search) {
    const s = or(ilike(unitPriceListsTable.code, `%${search}%`), ilike(unitPriceListsTable.name, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(unitPriceListsTable.companyId, companyId));
  const projectId = qStr(q, "projectId");
  if (projectId) filters.push(eq(unitPriceListsTable.projectId, projectId));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(unitPriceListsTable)
    .where(where);
  const rows = await db
    .select()
    .from(unitPriceListsTable)
    .where(where)
    .orderBy(desc(unitPriceListsTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListUnitPriceListsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/unit-price-lists", requirePermission("unitPriceLists.create"), async (req, res): Promise<void> => {
  const parsed = CreateUnitPriceListBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(unitPriceListsTable).values({ ...parsed.data, code: (await nextNumber("unitPriceList", req.authUser?.companyId ?? null)).value }).returning();
  await recordAudit(req, { action: "create", entity: "unitPriceList", entityId: row.id, newValue: row });
  res.status(201).json(GetUnitPriceListResponse.parse(serializeRow(row)));
});

router.get("/unit-price-lists/:id", requirePermission("unitPriceLists.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(unitPriceListsTable).where(and(eq(unitPriceListsTable.id, id), eq(unitPriceListsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetUnitPriceListResponse.parse(serializeRow(row)));
});

router.patch("/unit-price-lists/:id", requirePermission("unitPriceLists.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateUnitPriceListBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(unitPriceListsTable).where(and(eq(unitPriceListsTable.id, id), eq(unitPriceListsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  // The code belongs to the sequence that issued it, not to the editor.
  delete (update as Record<string, unknown>).code;
  const [row] = Object.keys(update).length
    ? await db.update(unitPriceListsTable).set(update).where(eq(unitPriceListsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "unitPriceList", entityId: id, oldValue: existing, newValue: row });
  res.json(GetUnitPriceListResponse.parse(serializeRow(row)));
});

router.delete("/unit-price-lists/:id", requirePermission("unitPriceLists.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(unitPriceListsTable).set({ isDeleted: true, isActive: false }).where(and(eq(unitPriceListsTable.id, id), eq(unitPriceListsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "unitPriceList", entityId: id });
  res.json({ success: true });
});

// ----- unitPricing -----
router.get("/unit-pricing", requirePermission("unitPricing.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(unitPricingTable.isDeleted, false)];
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(unitPricingTable.companyId, companyId));
  const priceListId = qStr(q, "priceListId");
  if (priceListId) filters.push(eq(unitPricingTable.priceListId, priceListId));
  const unitId = qStr(q, "unitId");
  if (unitId) filters.push(eq(unitPricingTable.unitId, unitId));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(unitPricingTable)
    .where(where);
  const rows = await db
    .select()
    .from(unitPricingTable)
    .where(where)
    .orderBy(desc(unitPricingTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListUnitPricingsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/unit-pricing", requirePermission("unitPricing.create"), async (req, res): Promise<void> => {
  const parsed = CreateUnitPricingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(unitPricingTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "unitPricing", entityId: row.id, newValue: row });
  res.status(201).json(GetUnitPricingResponse.parse(serializeRow(row)));
});

router.get("/unit-pricing/:id", requirePermission("unitPricing.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(unitPricingTable).where(and(eq(unitPricingTable.id, id), eq(unitPricingTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetUnitPricingResponse.parse(serializeRow(row)));
});

router.patch("/unit-pricing/:id", requirePermission("unitPricing.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateUnitPricingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(unitPricingTable).where(and(eq(unitPricingTable.id, id), eq(unitPricingTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(unitPricingTable).set(update).where(eq(unitPricingTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "unitPricing", entityId: id, oldValue: existing, newValue: row });
  res.json(GetUnitPricingResponse.parse(serializeRow(row)));
});

router.delete("/unit-pricing/:id", requirePermission("unitPricing.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(unitPricingTable).set({ isDeleted: true, isActive: false }).where(and(eq(unitPricingTable.id, id), eq(unitPricingTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "unitPricing", entityId: id });
  res.json({ success: true });
});

// ----- unitDiscounts -----
router.get("/unit-discounts", requirePermission("unitDiscounts.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(unitDiscountsTable.isDeleted, false)];
  if (search) {
    const s = or(ilike(unitDiscountsTable.code, `%${search}%`), ilike(unitDiscountsTable.name, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(unitDiscountsTable.companyId, companyId));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(unitDiscountsTable)
    .where(where);
  const rows = await db
    .select()
    .from(unitDiscountsTable)
    .where(where)
    .orderBy(desc(unitDiscountsTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListUnitDiscountsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/unit-discounts", requirePermission("unitDiscounts.create"), async (req, res): Promise<void> => {
  const parsed = CreateUnitDiscountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(unitDiscountsTable).values({ ...parsed.data, code: (await nextNumber("unitDiscount", req.authUser?.companyId ?? null)).value }).returning();
  await recordAudit(req, { action: "create", entity: "unitDiscount", entityId: row.id, newValue: row });
  res.status(201).json(GetUnitDiscountResponse.parse(serializeRow(row)));
});

router.get("/unit-discounts/:id", requirePermission("unitDiscounts.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(unitDiscountsTable).where(and(eq(unitDiscountsTable.id, id), eq(unitDiscountsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetUnitDiscountResponse.parse(serializeRow(row)));
});

router.patch("/unit-discounts/:id", requirePermission("unitDiscounts.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateUnitDiscountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(unitDiscountsTable).where(and(eq(unitDiscountsTable.id, id), eq(unitDiscountsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  // The code belongs to the sequence that issued it, not to the editor.
  delete (update as Record<string, unknown>).code;
  const [row] = Object.keys(update).length
    ? await db.update(unitDiscountsTable).set(update).where(eq(unitDiscountsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "unitDiscount", entityId: id, oldValue: existing, newValue: row });
  res.json(GetUnitDiscountResponse.parse(serializeRow(row)));
});

router.delete("/unit-discounts/:id", requirePermission("unitDiscounts.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(unitDiscountsTable).set({ isDeleted: true, isActive: false }).where(and(eq(unitDiscountsTable.id, id), eq(unitDiscountsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "unitDiscount", entityId: id });
  res.json({ success: true });
});

// ----- unit availability summary -----
router.get("/unit-availability", requirePermission("units.view"), async (_req, res): Promise<void> => {
  const rows = await db
    .select({ code: unitStatusesTable.code, count: sql<number>`count(*)::int` })
    .from(unitsTable)
    .leftJoin(unitStatusesTable, eq(unitsTable.unitStatusId, unitStatusesTable.id))
    .where(and(eq(unitsTable.isDeleted, false)))
    .groupBy(unitStatusesTable.code);
  let total = 0;
  let available = 0;
  let reserved = 0;
  let sold = 0;
  for (const r of rows) {
    total += r.count;
    if (r.code === "available") available += r.count;
    else if (r.code === "reserved") reserved += r.count;
    else if (r.code === "sold") sold += r.count;
  }
  const other = total - (available + reserved + sold);
  res.json(GetUnitAvailabilityResponse.parse({ total, available, reserved, sold, other }));
});

export default router;
