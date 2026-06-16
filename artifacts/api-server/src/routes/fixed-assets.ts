import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  db,
  assetCategoriesTable,
  fixedAssetsTable,
  assetTransfersTable,
  assetDepreciationsTable,
  assetInventoryCountsTable,
  assetDisposalsTable,
} from "@workspace/db";
import {
  ListAssetCategoriesResponse,
  CreateAssetCategoryBody,
  GetAssetCategoryResponse,
  UpdateAssetCategoryBody,
  ListFixedAssetsResponse,
  CreateFixedAssetBody,
  GetFixedAssetResponse,
  UpdateFixedAssetBody,
  ListAssetTransfersResponse,
  CreateAssetTransferBody,
  GetAssetTransferResponse,
  UpdateAssetTransferBody,
  ListAssetDepreciationsResponse,
  CreateAssetDepreciationBody,
  GetAssetDepreciationResponse,
  UpdateAssetDepreciationBody,
  ListAssetInventoryCountsResponse,
  CreateAssetInventoryCountBody,
  GetAssetInventoryCountResponse,
  UpdateAssetInventoryCountBody,
  ListAssetDisposalsResponse,
  CreateAssetDisposalBody,
  GetAssetDisposalResponse,
  UpdateAssetDisposalBody,
  GetFixedAssetsDashboardResponse,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

// ----- assetCategories -----
router.get("/asset-categories", requirePermission("assetCategories.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(assetCategoriesTable.isDeleted, false)];
  const search = qStr(q, "search");
  if (search) {
    const s = or(ilike(assetCategoriesTable.code, `%${search}%`), ilike(assetCategoriesTable.name, `%${search}%`), ilike(assetCategoriesTable.nameAr, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(assetCategoriesTable.companyId, companyId));
  const depreciationMethod = qStr(q, "depreciationMethod");
  if (depreciationMethod) filters.push(eq(assetCategoriesTable.depreciationMethod, depreciationMethod));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(assetCategoriesTable).where(where);
  const rows = await db.select().from(assetCategoriesTable).where(where).orderBy(desc(assetCategoriesTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListAssetCategoriesResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/asset-categories", requirePermission("assetCategories.create"), async (req, res): Promise<void> => {
  const parsed = CreateAssetCategoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(assetCategoriesTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "assetCategory", entityId: row.id, newValue: row });
  res.status(201).json(GetAssetCategoryResponse.parse(serializeRow(row)));
});

router.get("/asset-categories/:id", requirePermission("assetCategories.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(assetCategoriesTable).where(and(eq(assetCategoriesTable.id, id), eq(assetCategoriesTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetAssetCategoryResponse.parse(serializeRow(row)));
});

router.patch("/asset-categories/:id", requirePermission("assetCategories.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateAssetCategoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(assetCategoriesTable).where(and(eq(assetCategoriesTable.id, id), eq(assetCategoriesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(assetCategoriesTable).set(update).where(eq(assetCategoriesTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "assetCategory", entityId: id, oldValue: existing, newValue: row });
  res.json(GetAssetCategoryResponse.parse(serializeRow(row)));
});

router.delete("/asset-categories/:id", requirePermission("assetCategories.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(assetCategoriesTable).set({ isDeleted: true, isActive: false }).where(and(eq(assetCategoriesTable.id, id), eq(assetCategoriesTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "assetCategory", entityId: id });
  res.json({ success: true });
});

// ----- fixedAssets -----
router.get("/fixed-assets", requirePermission("fixedAssets.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(fixedAssetsTable.isDeleted, false)];
  const search = qStr(q, "search");
  if (search) {
    const s = or(ilike(fixedAssetsTable.code, `%${search}%`), ilike(fixedAssetsTable.name, `%${search}%`), ilike(fixedAssetsTable.nameAr, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(fixedAssetsTable.companyId, companyId));
  const categoryId = qStr(q, "categoryId");
  if (categoryId) filters.push(eq(fixedAssetsTable.categoryId, categoryId));
  const branchId = qStr(q, "branchId");
  if (branchId) filters.push(eq(fixedAssetsTable.branchId, branchId));
  const costCenterId = qStr(q, "costCenterId");
  if (costCenterId) filters.push(eq(fixedAssetsTable.costCenterId, costCenterId));
  const depreciationMethod = qStr(q, "depreciationMethod");
  if (depreciationMethod) filters.push(eq(fixedAssetsTable.depreciationMethod, depreciationMethod));
  const status = qStr(q, "status");
  if (status) filters.push(eq(fixedAssetsTable.status, status));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(fixedAssetsTable).where(where);
  const rows = await db.select().from(fixedAssetsTable).where(where).orderBy(desc(fixedAssetsTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListFixedAssetsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/fixed-assets", requirePermission("fixedAssets.create"), async (req, res): Promise<void> => {
  const parsed = CreateFixedAssetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(fixedAssetsTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "fixedAsset", entityId: row.id, newValue: row });
  res.status(201).json(GetFixedAssetResponse.parse(serializeRow(row)));
});

router.get("/fixed-assets/:id", requirePermission("fixedAssets.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(fixedAssetsTable).where(and(eq(fixedAssetsTable.id, id), eq(fixedAssetsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetFixedAssetResponse.parse(serializeRow(row)));
});

router.patch("/fixed-assets/:id", requirePermission("fixedAssets.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateFixedAssetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(fixedAssetsTable).where(and(eq(fixedAssetsTable.id, id), eq(fixedAssetsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(fixedAssetsTable).set(update).where(eq(fixedAssetsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "fixedAsset", entityId: id, oldValue: existing, newValue: row });
  res.json(GetFixedAssetResponse.parse(serializeRow(row)));
});

router.delete("/fixed-assets/:id", requirePermission("fixedAssets.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(fixedAssetsTable).set({ isDeleted: true, isActive: false }).where(and(eq(fixedAssetsTable.id, id), eq(fixedAssetsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "fixedAsset", entityId: id });
  res.json({ success: true });
});

// ----- assetTransfers -----
router.get("/asset-transfers", requirePermission("assetTransfers.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(assetTransfersTable.isDeleted, false)];
  const search = qStr(q, "search");
  if (search) {
    const s = or(ilike(assetTransfersTable.code, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(assetTransfersTable.companyId, companyId));
  const assetId = qStr(q, "assetId");
  if (assetId) filters.push(eq(assetTransfersTable.assetId, assetId));
  const status = qStr(q, "status");
  if (status) filters.push(eq(assetTransfersTable.status, status));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(assetTransfersTable).where(where);
  const rows = await db.select().from(assetTransfersTable).where(where).orderBy(desc(assetTransfersTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListAssetTransfersResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/asset-transfers", requirePermission("assetTransfers.create"), async (req, res): Promise<void> => {
  const parsed = CreateAssetTransferBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(assetTransfersTable).values({ ...parsed.data, status: "pending" }).returning();
  await recordAudit(req, { action: "create", entity: "assetTransfer", entityId: row.id, newValue: row });
  res.status(201).json(GetAssetTransferResponse.parse(serializeRow(row)));
});

router.get("/asset-transfers/:id", requirePermission("assetTransfers.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(assetTransfersTable).where(and(eq(assetTransfersTable.id, id), eq(assetTransfersTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetAssetTransferResponse.parse(serializeRow(row)));
});

router.patch("/asset-transfers/:id", requirePermission("assetTransfers.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateAssetTransferBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (parsed.data.status === "approved") {
    res.status(403).json({ error: "Use the approve endpoint to approve a transfer" });
    return;
  }
  const [existing] = await db.select().from(assetTransfersTable).where(and(eq(assetTransfersTable.id, id), eq(assetTransfersTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(assetTransfersTable).set(update).where(eq(assetTransfersTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "assetTransfer", entityId: id, oldValue: existing, newValue: row });
  res.json(GetAssetTransferResponse.parse(serializeRow(row)));
});

router.delete("/asset-transfers/:id", requirePermission("assetTransfers.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(assetTransfersTable).set({ isDeleted: true, isActive: false }).where(and(eq(assetTransfersTable.id, id), eq(assetTransfersTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "assetTransfer", entityId: id });
  res.json({ success: true });
});

router.post("/asset-transfers/:id/approve", requirePermission("assetTransfers.approve"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [existing] = await db.select().from(assetTransfersTable).where(and(eq(assetTransfersTable.id, id), eq(assetTransfersTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status === "approved") { res.status(409).json({ error: "Already approved" }); return; }
  const [row] = await db.update(assetTransfersTable).set({ status: "approved" }).where(eq(assetTransfersTable.id, id)).returning();
  await recordAudit(req, { action: "approve", entity: "assetTransfer", entityId: id, oldValue: existing, newValue: row });
  res.json(GetAssetTransferResponse.parse(serializeRow(row)));
});

// ----- assetDepreciations -----
router.get("/asset-depreciations", requirePermission("assetDepreciations.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(assetDepreciationsTable.isDeleted, false)];
  const search = qStr(q, "search");
  if (search) {
    const s = or(ilike(assetDepreciationsTable.code, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(assetDepreciationsTable.companyId, companyId));
  const assetId = qStr(q, "assetId");
  if (assetId) filters.push(eq(assetDepreciationsTable.assetId, assetId));
  const status = qStr(q, "status");
  if (status) filters.push(eq(assetDepreciationsTable.status, status));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(assetDepreciationsTable).where(where);
  const rows = await db.select().from(assetDepreciationsTable).where(where).orderBy(desc(assetDepreciationsTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListAssetDepreciationsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/asset-depreciations", requirePermission("assetDepreciations.create"), async (req, res): Promise<void> => {
  const parsed = CreateAssetDepreciationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(assetDepreciationsTable).values({ ...parsed.data, status: "draft" }).returning();
  await recordAudit(req, { action: "create", entity: "assetDepreciation", entityId: row.id, newValue: row });
  res.status(201).json(GetAssetDepreciationResponse.parse(serializeRow(row)));
});

router.get("/asset-depreciations/:id", requirePermission("assetDepreciations.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(assetDepreciationsTable).where(and(eq(assetDepreciationsTable.id, id), eq(assetDepreciationsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetAssetDepreciationResponse.parse(serializeRow(row)));
});

router.patch("/asset-depreciations/:id", requirePermission("assetDepreciations.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateAssetDepreciationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (parsed.data.status === "posted" || parsed.data.status === "reversed") {
    res.status(403).json({ error: "Use the post/reverse endpoint to change depreciation status" });
    return;
  }
  const [existing] = await db.select().from(assetDepreciationsTable).where(and(eq(assetDepreciationsTable.id, id), eq(assetDepreciationsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(assetDepreciationsTable).set(update).where(eq(assetDepreciationsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "assetDepreciation", entityId: id, oldValue: existing, newValue: row });
  res.json(GetAssetDepreciationResponse.parse(serializeRow(row)));
});

router.delete("/asset-depreciations/:id", requirePermission("assetDepreciations.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(assetDepreciationsTable).set({ isDeleted: true, isActive: false }).where(and(eq(assetDepreciationsTable.id, id), eq(assetDepreciationsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "assetDepreciation", entityId: id });
  res.json({ success: true });
});

router.post("/asset-depreciations/:id/post", requirePermission("assetDepreciations.post"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [existing] = await db.select().from(assetDepreciationsTable).where(and(eq(assetDepreciationsTable.id, id), eq(assetDepreciationsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status !== "draft") { res.status(409).json({ error: "Only draft entries can be posted" }); return; }
  const [row] = await db.update(assetDepreciationsTable).set({ status: "posted" }).where(eq(assetDepreciationsTable.id, id)).returning();
  await recordAudit(req, { action: "post", entity: "assetDepreciation", entityId: id, oldValue: existing, newValue: row });
  res.json(GetAssetDepreciationResponse.parse(serializeRow(row)));
});

router.post("/asset-depreciations/:id/reverse", requirePermission("assetDepreciations.reverse"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [existing] = await db.select().from(assetDepreciationsTable).where(and(eq(assetDepreciationsTable.id, id), eq(assetDepreciationsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status !== "posted") { res.status(409).json({ error: "Only posted entries can be reversed" }); return; }
  const [row] = await db.update(assetDepreciationsTable).set({ status: "reversed" }).where(eq(assetDepreciationsTable.id, id)).returning();
  await recordAudit(req, { action: "reverse", entity: "assetDepreciation", entityId: id, oldValue: existing, newValue: row });
  res.json(GetAssetDepreciationResponse.parse(serializeRow(row)));
});

// ----- assetInventoryCounts -----
router.get("/asset-inventory-counts", requirePermission("assetInventoryCounts.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(assetInventoryCountsTable.isDeleted, false)];
  const search = qStr(q, "search");
  if (search) {
    const s = or(ilike(assetInventoryCountsTable.code, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(assetInventoryCountsTable.companyId, companyId));
  const assetId = qStr(q, "assetId");
  if (assetId) filters.push(eq(assetInventoryCountsTable.assetId, assetId));
  const branchId = qStr(q, "branchId");
  if (branchId) filters.push(eq(assetInventoryCountsTable.branchId, branchId));
  const status = qStr(q, "status");
  if (status) filters.push(eq(assetInventoryCountsTable.status, status));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(assetInventoryCountsTable).where(where);
  const rows = await db.select().from(assetInventoryCountsTable).where(where).orderBy(desc(assetInventoryCountsTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListAssetInventoryCountsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/asset-inventory-counts", requirePermission("assetInventoryCounts.create"), async (req, res): Promise<void> => {
  const parsed = CreateAssetInventoryCountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(assetInventoryCountsTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "assetInventoryCount", entityId: row.id, newValue: row });
  res.status(201).json(GetAssetInventoryCountResponse.parse(serializeRow(row)));
});

router.get("/asset-inventory-counts/:id", requirePermission("assetInventoryCounts.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(assetInventoryCountsTable).where(and(eq(assetInventoryCountsTable.id, id), eq(assetInventoryCountsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetAssetInventoryCountResponse.parse(serializeRow(row)));
});

router.patch("/asset-inventory-counts/:id", requirePermission("assetInventoryCounts.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateAssetInventoryCountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(assetInventoryCountsTable).where(and(eq(assetInventoryCountsTable.id, id), eq(assetInventoryCountsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(assetInventoryCountsTable).set(update).where(eq(assetInventoryCountsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "assetInventoryCount", entityId: id, oldValue: existing, newValue: row });
  res.json(GetAssetInventoryCountResponse.parse(serializeRow(row)));
});

router.delete("/asset-inventory-counts/:id", requirePermission("assetInventoryCounts.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(assetInventoryCountsTable).set({ isDeleted: true, isActive: false }).where(and(eq(assetInventoryCountsTable.id, id), eq(assetInventoryCountsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "assetInventoryCount", entityId: id });
  res.json({ success: true });
});

// ----- assetDisposals -----
router.get("/asset-disposals", requirePermission("assetDisposals.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(assetDisposalsTable.isDeleted, false)];
  const search = qStr(q, "search");
  if (search) {
    const s = or(ilike(assetDisposalsTable.code, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(assetDisposalsTable.companyId, companyId));
  const assetId = qStr(q, "assetId");
  if (assetId) filters.push(eq(assetDisposalsTable.assetId, assetId));
  const disposalType = qStr(q, "disposalType");
  if (disposalType) filters.push(eq(assetDisposalsTable.disposalType, disposalType));
  const status = qStr(q, "status");
  if (status) filters.push(eq(assetDisposalsTable.status, status));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(assetDisposalsTable).where(where);
  const rows = await db.select().from(assetDisposalsTable).where(where).orderBy(desc(assetDisposalsTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListAssetDisposalsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/asset-disposals", requirePermission("assetDisposals.create"), async (req, res): Promise<void> => {
  const parsed = CreateAssetDisposalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(assetDisposalsTable).values({ ...parsed.data, status: "pending" }).returning();
  await recordAudit(req, { action: "create", entity: "assetDisposal", entityId: row.id, newValue: row });
  res.status(201).json(GetAssetDisposalResponse.parse(serializeRow(row)));
});

router.get("/asset-disposals/:id", requirePermission("assetDisposals.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(assetDisposalsTable).where(and(eq(assetDisposalsTable.id, id), eq(assetDisposalsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetAssetDisposalResponse.parse(serializeRow(row)));
});

router.patch("/asset-disposals/:id", requirePermission("assetDisposals.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateAssetDisposalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (parsed.data.status === "approved") {
    res.status(403).json({ error: "Use the approve endpoint to approve a disposal" });
    return;
  }
  const [existing] = await db.select().from(assetDisposalsTable).where(and(eq(assetDisposalsTable.id, id), eq(assetDisposalsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(assetDisposalsTable).set(update).where(eq(assetDisposalsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "assetDisposal", entityId: id, oldValue: existing, newValue: row });
  res.json(GetAssetDisposalResponse.parse(serializeRow(row)));
});

router.delete("/asset-disposals/:id", requirePermission("assetDisposals.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(assetDisposalsTable).set({ isDeleted: true, isActive: false }).where(and(eq(assetDisposalsTable.id, id), eq(assetDisposalsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "assetDisposal", entityId: id });
  res.json({ success: true });
});

router.post("/asset-disposals/:id/approve", requirePermission("assetDisposals.approve"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [existing] = await db.select().from(assetDisposalsTable).where(and(eq(assetDisposalsTable.id, id), eq(assetDisposalsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.status === "approved") { res.status(409).json({ error: "Already approved" }); return; }
  const [row] = await db.update(assetDisposalsTable).set({ status: "approved" }).where(eq(assetDisposalsTable.id, id)).returning();
  await recordAudit(req, { action: "approve", entity: "assetDisposal", entityId: id, oldValue: existing, newValue: row });
  res.json(GetAssetDisposalResponse.parse(serializeRow(row)));
});

router.get("/fixed-assets-dashboard", requirePermission("fixedAssets.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const companyId = qStr(q, "companyId");
  const base: SQL[] = [eq(fixedAssetsTable.isDeleted, false)];
  if (companyId) base.push(eq(fixedAssetsTable.companyId, companyId));
  const where = and(...base);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(fixedAssetsTable).where(where);
  const [agg] = await db.select({ cost: sql<string>`coalesce(sum(${fixedAssetsTable.acquisitionCost}),0)::text`, book: sql<string>`coalesce(sum(${fixedAssetsTable.bookValue}),0)::text`, accum: sql<string>`coalesce(sum(${fixedAssetsTable.accumulatedDepreciation}),0)::text` }).from(fixedAssetsTable).where(where);
  const byStatusRows = await db.select({ status: fixedAssetsTable.status, count: sql<number>`count(*)::int` }).from(fixedAssetsTable).where(where).groupBy(fixedAssetsTable.status);
  res.json(GetFixedAssetsDashboardResponse.parse({ totalAssets: count, totalAcquisitionCost: agg.cost, totalBookValue: agg.book, totalAccumulatedDepreciation: agg.accum, byStatus: byStatusRows.map((r) => ({ status: r.status, count: r.count })) }));
});

export default router;
