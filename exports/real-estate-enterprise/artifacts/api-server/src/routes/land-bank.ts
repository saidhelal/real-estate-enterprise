import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  db,
  landParcelsTable,
  landOwnershipsTable,
  landLegalStatusesTable,
  landUtilizationsTable,
  landDocumentsTable,
  landAcquisitionsTable,
} from "@workspace/db";
import {
  ListLandParcelsResponse,
  CreateLandParcelBody,
  GetLandParcelResponse,
  UpdateLandParcelBody,
  ListLandOwnershipsResponse,
  CreateLandOwnershipBody,
  GetLandOwnershipResponse,
  UpdateLandOwnershipBody,
  ListLandLegalStatusesResponse,
  CreateLandLegalStatusBody,
  GetLandLegalStatusResponse,
  UpdateLandLegalStatusBody,
  ListLandUtilizationsResponse,
  CreateLandUtilizationBody,
  GetLandUtilizationResponse,
  UpdateLandUtilizationBody,
  ListLandDocumentsResponse,
  CreateLandDocumentBody,
  GetLandDocumentResponse,
  UpdateLandDocumentBody,
  ListLandAcquisitionsResponse,
  CreateLandAcquisitionBody,
  GetLandAcquisitionResponse,
  UpdateLandAcquisitionBody,
  GetLandBankDashboardResponse,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

// ----- landParcels -----
router.get("/land-parcels", requirePermission("landParcels.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(landParcelsTable.isDeleted, false)];
  const search = qStr(q, "search");
  if (search) {
    const s = or(ilike(landParcelsTable.code, `%${search}%`), ilike(landParcelsTable.name, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(landParcelsTable.companyId, companyId));
  const projectId = qStr(q, "projectId");
  if (projectId) filters.push(eq(landParcelsTable.projectId, projectId));
  const status = qStr(q, "status");
  if (status) filters.push(eq(landParcelsTable.status, status));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(landParcelsTable).where(where);
  const rows = await db.select().from(landParcelsTable).where(where).orderBy(desc(landParcelsTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListLandParcelsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/land-parcels", requirePermission("landParcels.create"), async (req, res): Promise<void> => {
  const parsed = CreateLandParcelBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(landParcelsTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "landParcel", entityId: row.id, newValue: row });
  res.status(201).json(GetLandParcelResponse.parse(serializeRow(row)));
});

router.get("/land-parcels/:id", requirePermission("landParcels.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(landParcelsTable).where(and(eq(landParcelsTable.id, id), eq(landParcelsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetLandParcelResponse.parse(serializeRow(row)));
});

router.patch("/land-parcels/:id", requirePermission("landParcels.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateLandParcelBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(landParcelsTable).where(and(eq(landParcelsTable.id, id), eq(landParcelsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(landParcelsTable).set(update).where(eq(landParcelsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "landParcel", entityId: id, oldValue: existing, newValue: row });
  res.json(GetLandParcelResponse.parse(serializeRow(row)));
});

router.delete("/land-parcels/:id", requirePermission("landParcels.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(landParcelsTable).set({ isDeleted: true, isActive: false }).where(and(eq(landParcelsTable.id, id), eq(landParcelsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "landParcel", entityId: id });
  res.json({ success: true });
});

// ----- landOwnerships -----
router.get("/land-ownerships", requirePermission("landOwnerships.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(landOwnershipsTable.isDeleted, false)];
  const search = qStr(q, "search");
  if (search) {
    const s = or(ilike(landOwnershipsTable.ownerName, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(landOwnershipsTable.companyId, companyId));
  const parcelId = qStr(q, "parcelId");
  if (parcelId) filters.push(eq(landOwnershipsTable.parcelId, parcelId));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(landOwnershipsTable).where(where);
  const rows = await db.select().from(landOwnershipsTable).where(where).orderBy(desc(landOwnershipsTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListLandOwnershipsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/land-ownerships", requirePermission("landOwnerships.create"), async (req, res): Promise<void> => {
  const parsed = CreateLandOwnershipBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(landOwnershipsTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "landOwnership", entityId: row.id, newValue: row });
  res.status(201).json(GetLandOwnershipResponse.parse(serializeRow(row)));
});

router.get("/land-ownerships/:id", requirePermission("landOwnerships.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(landOwnershipsTable).where(and(eq(landOwnershipsTable.id, id), eq(landOwnershipsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetLandOwnershipResponse.parse(serializeRow(row)));
});

router.patch("/land-ownerships/:id", requirePermission("landOwnerships.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateLandOwnershipBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(landOwnershipsTable).where(and(eq(landOwnershipsTable.id, id), eq(landOwnershipsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(landOwnershipsTable).set(update).where(eq(landOwnershipsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "landOwnership", entityId: id, oldValue: existing, newValue: row });
  res.json(GetLandOwnershipResponse.parse(serializeRow(row)));
});

router.delete("/land-ownerships/:id", requirePermission("landOwnerships.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(landOwnershipsTable).set({ isDeleted: true, isActive: false }).where(and(eq(landOwnershipsTable.id, id), eq(landOwnershipsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "landOwnership", entityId: id });
  res.json({ success: true });
});

// ----- landLegalStatuses -----
router.get("/land-legal-statuses", requirePermission("landLegalStatuses.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(landLegalStatusesTable.isDeleted, false)];
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(landLegalStatusesTable.companyId, companyId));
  const parcelId = qStr(q, "parcelId");
  if (parcelId) filters.push(eq(landLegalStatusesTable.parcelId, parcelId));
  const status = qStr(q, "status");
  if (status) filters.push(eq(landLegalStatusesTable.status, status));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(landLegalStatusesTable).where(where);
  const rows = await db.select().from(landLegalStatusesTable).where(where).orderBy(desc(landLegalStatusesTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListLandLegalStatusesResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/land-legal-statuses", requirePermission("landLegalStatuses.create"), async (req, res): Promise<void> => {
  const parsed = CreateLandLegalStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(landLegalStatusesTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "landLegalStatus", entityId: row.id, newValue: row });
  res.status(201).json(GetLandLegalStatusResponse.parse(serializeRow(row)));
});

router.get("/land-legal-statuses/:id", requirePermission("landLegalStatuses.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(landLegalStatusesTable).where(and(eq(landLegalStatusesTable.id, id), eq(landLegalStatusesTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetLandLegalStatusResponse.parse(serializeRow(row)));
});

router.patch("/land-legal-statuses/:id", requirePermission("landLegalStatuses.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateLandLegalStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(landLegalStatusesTable).where(and(eq(landLegalStatusesTable.id, id), eq(landLegalStatusesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(landLegalStatusesTable).set(update).where(eq(landLegalStatusesTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "landLegalStatus", entityId: id, oldValue: existing, newValue: row });
  res.json(GetLandLegalStatusResponse.parse(serializeRow(row)));
});

router.delete("/land-legal-statuses/:id", requirePermission("landLegalStatuses.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(landLegalStatusesTable).set({ isDeleted: true, isActive: false }).where(and(eq(landLegalStatusesTable.id, id), eq(landLegalStatusesTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "landLegalStatus", entityId: id });
  res.json({ success: true });
});

// ----- landUtilizations -----
router.get("/land-utilizations", requirePermission("landUtilizations.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(landUtilizationsTable.isDeleted, false)];
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(landUtilizationsTable.companyId, companyId));
  const parcelId = qStr(q, "parcelId");
  if (parcelId) filters.push(eq(landUtilizationsTable.parcelId, parcelId));
  const projectId = qStr(q, "projectId");
  if (projectId) filters.push(eq(landUtilizationsTable.projectId, projectId));
  const status = qStr(q, "status");
  if (status) filters.push(eq(landUtilizationsTable.status, status));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(landUtilizationsTable).where(where);
  const rows = await db.select().from(landUtilizationsTable).where(where).orderBy(desc(landUtilizationsTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListLandUtilizationsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/land-utilizations", requirePermission("landUtilizations.create"), async (req, res): Promise<void> => {
  const parsed = CreateLandUtilizationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(landUtilizationsTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "landUtilization", entityId: row.id, newValue: row });
  res.status(201).json(GetLandUtilizationResponse.parse(serializeRow(row)));
});

router.get("/land-utilizations/:id", requirePermission("landUtilizations.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(landUtilizationsTable).where(and(eq(landUtilizationsTable.id, id), eq(landUtilizationsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetLandUtilizationResponse.parse(serializeRow(row)));
});

router.patch("/land-utilizations/:id", requirePermission("landUtilizations.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateLandUtilizationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(landUtilizationsTable).where(and(eq(landUtilizationsTable.id, id), eq(landUtilizationsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(landUtilizationsTable).set(update).where(eq(landUtilizationsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "landUtilization", entityId: id, oldValue: existing, newValue: row });
  res.json(GetLandUtilizationResponse.parse(serializeRow(row)));
});

router.delete("/land-utilizations/:id", requirePermission("landUtilizations.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(landUtilizationsTable).set({ isDeleted: true, isActive: false }).where(and(eq(landUtilizationsTable.id, id), eq(landUtilizationsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "landUtilization", entityId: id });
  res.json({ success: true });
});

// ----- landDocuments -----
router.get("/land-documents", requirePermission("landDocuments.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(landDocumentsTable.isDeleted, false)];
  const search = qStr(q, "search");
  if (search) {
    const s = or(ilike(landDocumentsTable.title, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(landDocumentsTable.companyId, companyId));
  const parcelId = qStr(q, "parcelId");
  if (parcelId) filters.push(eq(landDocumentsTable.parcelId, parcelId));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(landDocumentsTable).where(where);
  const rows = await db.select().from(landDocumentsTable).where(where).orderBy(desc(landDocumentsTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListLandDocumentsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/land-documents", requirePermission("landDocuments.create"), async (req, res): Promise<void> => {
  const parsed = CreateLandDocumentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(landDocumentsTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "landDocument", entityId: row.id, newValue: row });
  res.status(201).json(GetLandDocumentResponse.parse(serializeRow(row)));
});

router.get("/land-documents/:id", requirePermission("landDocuments.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(landDocumentsTable).where(and(eq(landDocumentsTable.id, id), eq(landDocumentsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetLandDocumentResponse.parse(serializeRow(row)));
});

router.patch("/land-documents/:id", requirePermission("landDocuments.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateLandDocumentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(landDocumentsTable).where(and(eq(landDocumentsTable.id, id), eq(landDocumentsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(landDocumentsTable).set(update).where(eq(landDocumentsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "landDocument", entityId: id, oldValue: existing, newValue: row });
  res.json(GetLandDocumentResponse.parse(serializeRow(row)));
});

router.delete("/land-documents/:id", requirePermission("landDocuments.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(landDocumentsTable).set({ isDeleted: true, isActive: false }).where(and(eq(landDocumentsTable.id, id), eq(landDocumentsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "landDocument", entityId: id });
  res.json({ success: true });
});

// ----- landAcquisitions -----
router.get("/land-acquisitions", requirePermission("landAcquisitions.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(landAcquisitionsTable.isDeleted, false)];
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(landAcquisitionsTable.companyId, companyId));
  const parcelId = qStr(q, "parcelId");
  if (parcelId) filters.push(eq(landAcquisitionsTable.parcelId, parcelId));
  const paymentStatus = qStr(q, "paymentStatus");
  if (paymentStatus) filters.push(eq(landAcquisitionsTable.paymentStatus, paymentStatus));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(landAcquisitionsTable).where(where);
  const rows = await db.select().from(landAcquisitionsTable).where(where).orderBy(desc(landAcquisitionsTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListLandAcquisitionsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/land-acquisitions", requirePermission("landAcquisitions.create"), async (req, res): Promise<void> => {
  const parsed = CreateLandAcquisitionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(landAcquisitionsTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "landAcquisition", entityId: row.id, newValue: row });
  res.status(201).json(GetLandAcquisitionResponse.parse(serializeRow(row)));
});

router.get("/land-acquisitions/:id", requirePermission("landAcquisitions.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(landAcquisitionsTable).where(and(eq(landAcquisitionsTable.id, id), eq(landAcquisitionsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetLandAcquisitionResponse.parse(serializeRow(row)));
});

router.patch("/land-acquisitions/:id", requirePermission("landAcquisitions.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateLandAcquisitionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(landAcquisitionsTable).where(and(eq(landAcquisitionsTable.id, id), eq(landAcquisitionsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(landAcquisitionsTable).set(update).where(eq(landAcquisitionsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "landAcquisition", entityId: id, oldValue: existing, newValue: row });
  res.json(GetLandAcquisitionResponse.parse(serializeRow(row)));
});

router.delete("/land-acquisitions/:id", requirePermission("landAcquisitions.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(landAcquisitionsTable).set({ isDeleted: true, isActive: false }).where(and(eq(landAcquisitionsTable.id, id), eq(landAcquisitionsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "landAcquisition", entityId: id });
  res.json({ success: true });
});

router.get("/land-bank-dashboard", requirePermission("landParcels.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const companyId = qStr(q, "companyId");
  const base: SQL[] = [eq(landParcelsTable.isDeleted, false)];
  if (companyId) base.push(eq(landParcelsTable.companyId, companyId));
  const where = and(...base);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(landParcelsTable).where(where);
  const [agg] = await db.select({ area: sql<string>`coalesce(sum(${landParcelsTable.area}),0)::text`, market: sql<string>`coalesce(sum(${landParcelsTable.marketValue}),0)::text` }).from(landParcelsTable).where(where);
  const acqWhere = and(eq(landAcquisitionsTable.isDeleted, false), ...(companyId ? [eq(landAcquisitionsTable.companyId, companyId)] : []));
  const [acq] = await db.select({ cost: sql<string>`coalesce(sum(${landAcquisitionsTable.cost}),0)::text` }).from(landAcquisitionsTable).where(acqWhere);
  const byStatusRows = await db.select({ status: landParcelsTable.status, count: sql<number>`count(*)::int` }).from(landParcelsTable).where(where).groupBy(landParcelsTable.status);
  res.json(GetLandBankDashboardResponse.parse({ totalParcels: count, totalArea: agg.area, totalMarketValue: agg.market, totalAcquisitionCost: acq.cost, byStatus: byStatusRows.map((r) => ({ status: r.status, count: r.count })) }));
});

export default router;
