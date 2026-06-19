import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  db,
  projectsTable,
  phasesTable,
  buildingsTable,
  floorsTable,
  unitsTable,
  unitTypesTable,
  unitStatusesTable,
} from "@workspace/db";
import {
  ListProjectsResponse,
  CreateProjectBody,
  GetProjectResponse,
  UpdateProjectBody,
  ListPhasesResponse,
  CreatePhaseBody,
  GetPhaseResponse,
  UpdatePhaseBody,
  ListBuildingsResponse,
  CreateBuildingBody,
  GetBuildingResponse,
  UpdateBuildingBody,
  ListFloorsResponse,
  CreateFloorBody,
  GetFloorResponse,
  UpdateFloorBody,
  ListUnitsResponse,
  CreateUnitBody,
  GetUnitResponse,
  UpdateUnitBody,
  ListUnitTypesResponse,
  CreateUnitTypeBody,
  GetUnitTypeResponse,
  UpdateUnitTypeBody,
  ListUnitStatusesResponse,
  CreateUnitStatusBody,
  GetUnitStatusResponse,
  UpdateUnitStatusBody,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

// ----- projects -----
router.get("/projects", requirePermission("projects.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(projectsTable.isDeleted, false)];
  if (search) {
    const s = or(ilike(projectsTable.code, `%${search}%`), ilike(projectsTable.name, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(projectsTable.companyId, companyId));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(projectsTable)
    .where(where);
  const rows = await db
    .select()
    .from(projectsTable)
    .where(where)
    .orderBy(desc(projectsTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListProjectsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/projects", requirePermission("projects.create"), async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(projectsTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "project", entityId: row.id, newValue: row });
  res.status(201).json(GetProjectResponse.parse(serializeRow(row)));
});

router.get("/projects/:id", requirePermission("projects.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetProjectResponse.parse(serializeRow(row)));
});

router.patch("/projects/:id", requirePermission("projects.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, id), eq(projectsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(projectsTable).set(update).where(eq(projectsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "project", entityId: id, oldValue: existing, newValue: row });
  res.json(GetProjectResponse.parse(serializeRow(row)));
});

router.delete("/projects/:id", requirePermission("projects.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(projectsTable).set({ isDeleted: true, isActive: false }).where(and(eq(projectsTable.id, id), eq(projectsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "project", entityId: id });
  res.json({ success: true });
});

// ----- phases -----
router.get("/phases", requirePermission("phases.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(phasesTable.isDeleted, false)];
  if (search) {
    const s = or(ilike(phasesTable.code, `%${search}%`), ilike(phasesTable.name, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(phasesTable.companyId, companyId));
  const projectId = qStr(q, "projectId");
  if (projectId) filters.push(eq(phasesTable.projectId, projectId));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(phasesTable)
    .where(where);
  const rows = await db
    .select()
    .from(phasesTable)
    .where(where)
    .orderBy(desc(phasesTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListPhasesResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/phases", requirePermission("phases.create"), async (req, res): Promise<void> => {
  const parsed = CreatePhaseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(phasesTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "phase", entityId: row.id, newValue: row });
  res.status(201).json(GetPhaseResponse.parse(serializeRow(row)));
});

router.get("/phases/:id", requirePermission("phases.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(phasesTable).where(and(eq(phasesTable.id, id), eq(phasesTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetPhaseResponse.parse(serializeRow(row)));
});

router.patch("/phases/:id", requirePermission("phases.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdatePhaseBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(phasesTable).where(and(eq(phasesTable.id, id), eq(phasesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(phasesTable).set(update).where(eq(phasesTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "phase", entityId: id, oldValue: existing, newValue: row });
  res.json(GetPhaseResponse.parse(serializeRow(row)));
});

router.delete("/phases/:id", requirePermission("phases.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(phasesTable).set({ isDeleted: true, isActive: false }).where(and(eq(phasesTable.id, id), eq(phasesTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "phase", entityId: id });
  res.json({ success: true });
});

// ----- buildings -----
router.get("/buildings", requirePermission("buildings.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(buildingsTable.isDeleted, false)];
  if (search) {
    const s = or(ilike(buildingsTable.code, `%${search}%`), ilike(buildingsTable.name, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(buildingsTable.companyId, companyId));
  const projectId = qStr(q, "projectId");
  if (projectId) filters.push(eq(buildingsTable.projectId, projectId));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(buildingsTable)
    .where(where);
  const rows = await db
    .select()
    .from(buildingsTable)
    .where(where)
    .orderBy(desc(buildingsTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListBuildingsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/buildings", requirePermission("buildings.create"), async (req, res): Promise<void> => {
  const parsed = CreateBuildingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(buildingsTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "building", entityId: row.id, newValue: row });
  res.status(201).json(GetBuildingResponse.parse(serializeRow(row)));
});

router.get("/buildings/:id", requirePermission("buildings.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(buildingsTable).where(and(eq(buildingsTable.id, id), eq(buildingsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetBuildingResponse.parse(serializeRow(row)));
});

router.patch("/buildings/:id", requirePermission("buildings.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateBuildingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(buildingsTable).where(and(eq(buildingsTable.id, id), eq(buildingsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(buildingsTable).set(update).where(eq(buildingsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "building", entityId: id, oldValue: existing, newValue: row });
  res.json(GetBuildingResponse.parse(serializeRow(row)));
});

router.delete("/buildings/:id", requirePermission("buildings.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(buildingsTable).set({ isDeleted: true, isActive: false }).where(and(eq(buildingsTable.id, id), eq(buildingsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "building", entityId: id });
  res.json({ success: true });
});

// ----- floors -----
router.get("/floors", requirePermission("floors.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(floorsTable.isDeleted, false)];
  if (search) {
    const s = or(ilike(floorsTable.code, `%${search}%`), ilike(floorsTable.name, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(floorsTable.companyId, companyId));
  const buildingId = qStr(q, "buildingId");
  if (buildingId) filters.push(eq(floorsTable.buildingId, buildingId));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(floorsTable)
    .where(where);
  const rows = await db
    .select()
    .from(floorsTable)
    .where(where)
    .orderBy(desc(floorsTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListFloorsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

// Resolve a floor's place in the hierarchy from its parent building so
// floors.projectId / floors.phaseId always match the building they belong to,
// regardless of what the client sent.
async function deriveFloorHierarchy(
  buildingId: string,
): Promise<{ projectId: string; phaseId: string | null } | null> {
  const [b] = await db
    .select({ projectId: buildingsTable.projectId, phaseId: buildingsTable.phaseId })
    .from(buildingsTable)
    .where(and(eq(buildingsTable.id, buildingId), eq(buildingsTable.isDeleted, false)));
  if (!b) return null;
  return { projectId: b.projectId, phaseId: b.phaseId ?? null };
}

router.post("/floors", requirePermission("floors.create"), async (req, res): Promise<void> => {
  const parsed = CreateFloorBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const hierarchy = await deriveFloorHierarchy(parsed.data.buildingId);
  if (!hierarchy) { res.status(400).json({ error: "Invalid building" }); return; }
  const [row] = await db
    .insert(floorsTable)
    .values({ ...parsed.data, projectId: hierarchy.projectId, phaseId: hierarchy.phaseId })
    .returning();
  await recordAudit(req, { action: "create", entity: "floor", entityId: row.id, newValue: row });
  res.status(201).json(GetFloorResponse.parse(serializeRow(row)));
});

router.get("/floors/:id", requirePermission("floors.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(floorsTable).where(and(eq(floorsTable.id, id), eq(floorsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetFloorResponse.parse(serializeRow(row)));
});

router.patch("/floors/:id", requirePermission("floors.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateFloorBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(floorsTable).where(and(eq(floorsTable.id, id), eq(floorsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update: Record<string, unknown> = { ...parsed.data };
  // Keep projectId/phaseId in lockstep with the (possibly changed) building.
  const targetBuildingId = parsed.data.buildingId ?? existing.buildingId;
  const hierarchy = await deriveFloorHierarchy(targetBuildingId);
  if (!hierarchy) { res.status(400).json({ error: "Invalid building" }); return; }
  update.projectId = hierarchy.projectId;
  update.phaseId = hierarchy.phaseId;
  const [row] = await db.update(floorsTable).set(update).where(eq(floorsTable.id, id)).returning();
  await recordAudit(req, { action: "update", entity: "floor", entityId: id, oldValue: existing, newValue: row });
  res.json(GetFloorResponse.parse(serializeRow(row)));
});

router.delete("/floors/:id", requirePermission("floors.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(floorsTable).set({ isDeleted: true, isActive: false }).where(and(eq(floorsTable.id, id), eq(floorsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "floor", entityId: id });
  res.json({ success: true });
});

// ----- units -----
router.get("/units", requirePermission("units.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(unitsTable.isDeleted, false)];
  if (search) {
    const s = or(ilike(unitsTable.code, `%${search}%`), ilike(unitsTable.name, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(unitsTable.companyId, companyId));
  const projectId = qStr(q, "projectId");
  if (projectId) filters.push(eq(unitsTable.projectId, projectId));
  const buildingId = qStr(q, "buildingId");
  if (buildingId) filters.push(eq(unitsTable.buildingId, buildingId));
  const floorId = qStr(q, "floorId");
  if (floorId) filters.push(eq(unitsTable.floorId, floorId));
  const branchId = qStr(q, "branchId");
  if (branchId) filters.push(eq(unitsTable.branchId, branchId));
  const unitTypeId = qStr(q, "unitTypeId");
  if (unitTypeId) filters.push(eq(unitsTable.unitTypeId, unitTypeId));
  const unitStatusId = qStr(q, "unitStatusId");
  if (unitStatusId) filters.push(eq(unitsTable.unitStatusId, unitStatusId));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(unitsTable)
    .where(where);
  const rows = await db
    .select()
    .from(unitsTable)
    .where(where)
    .orderBy(desc(unitsTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListUnitsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

// Resolve a unit's place in the hierarchy from its parent floor (floor ->
// building -> project/phase) so a unit can never be wired to a floor/building/
// project that disagree. The client's floorId is authoritative; the rest is
// derived server-side.
async function deriveUnitHierarchy(
  floorId: string,
): Promise<{ buildingId: string; projectId: string; phaseId: string | null } | null> {
  const [f] = await db
    .select({ buildingId: floorsTable.buildingId })
    .from(floorsTable)
    .where(and(eq(floorsTable.id, floorId), eq(floorsTable.isDeleted, false)));
  if (!f) return null;
  const [b] = await db
    .select({ projectId: buildingsTable.projectId, phaseId: buildingsTable.phaseId })
    .from(buildingsTable)
    .where(and(eq(buildingsTable.id, f.buildingId), eq(buildingsTable.isDeleted, false)));
  if (!b) return null;
  return { buildingId: f.buildingId, projectId: b.projectId, phaseId: b.phaseId ?? null };
}

router.post("/units", requirePermission("units.create"), async (req, res): Promise<void> => {
  const parsed = CreateUnitBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const hierarchy = await deriveUnitHierarchy(parsed.data.floorId);
  if (!hierarchy) { res.status(400).json({ error: "Invalid floor" }); return; }
  const [row] = await db
    .insert(unitsTable)
    .values({
      ...parsed.data,
      buildingId: hierarchy.buildingId,
      projectId: hierarchy.projectId,
      phaseId: hierarchy.phaseId,
    })
    .returning();
  await recordAudit(req, { action: "create", entity: "unit", entityId: row.id, newValue: row });
  res.status(201).json(GetUnitResponse.parse(serializeRow(row)));
});

router.get("/units/:id", requirePermission("units.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(unitsTable).where(and(eq(unitsTable.id, id), eq(unitsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetUnitResponse.parse(serializeRow(row)));
});

router.patch("/units/:id", requirePermission("units.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateUnitBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(unitsTable).where(and(eq(unitsTable.id, id), eq(unitsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update: Record<string, unknown> = { ...parsed.data };
  // Always re-derive (and overwrite) the building/project/phase chain from the
  // effective floor — the incoming floorId if present, otherwise the existing
  // one. This prevents a client from patching buildingId/projectId/phaseId
  // alone and persisting a chain that disagrees with the floor.
  const effectiveFloorId = parsed.data.floorId ?? existing.floorId;
  const hierarchy = await deriveUnitHierarchy(effectiveFloorId);
  if (!hierarchy) { res.status(400).json({ error: "Invalid floor" }); return; }
  update.floorId = effectiveFloorId;
  update.buildingId = hierarchy.buildingId;
  update.projectId = hierarchy.projectId;
  update.phaseId = hierarchy.phaseId;
  const [row] = Object.keys(update).length
    ? await db.update(unitsTable).set(update).where(eq(unitsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "unit", entityId: id, oldValue: existing, newValue: row });
  res.json(GetUnitResponse.parse(serializeRow(row)));
});

router.delete("/units/:id", requirePermission("units.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(unitsTable).set({ isDeleted: true, isActive: false }).where(and(eq(unitsTable.id, id), eq(unitsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "unit", entityId: id });
  res.json({ success: true });
});

// ----- unit types -----
router.get("/unit-types", requirePermission("unitTypes.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(unitTypesTable.isDeleted, false)];
  if (search) {
    const s = or(ilike(unitTypesTable.code, `%${search}%`), ilike(unitTypesTable.name, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(unitTypesTable.companyId, companyId));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(unitTypesTable)
    .where(where);
  const rows = await db
    .select()
    .from(unitTypesTable)
    .where(where)
    .orderBy(desc(unitTypesTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListUnitTypesResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/unit-types", requirePermission("unitTypes.create"), async (req, res): Promise<void> => {
  const parsed = CreateUnitTypeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(unitTypesTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "unitType", entityId: row.id, newValue: row });
  res.status(201).json(GetUnitTypeResponse.parse(serializeRow(row)));
});

router.get("/unit-types/:id", requirePermission("unitTypes.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(unitTypesTable).where(and(eq(unitTypesTable.id, id), eq(unitTypesTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetUnitTypeResponse.parse(serializeRow(row)));
});

router.patch("/unit-types/:id", requirePermission("unitTypes.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateUnitTypeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(unitTypesTable).where(and(eq(unitTypesTable.id, id), eq(unitTypesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(unitTypesTable).set(update).where(eq(unitTypesTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "unitType", entityId: id, oldValue: existing, newValue: row });
  res.json(GetUnitTypeResponse.parse(serializeRow(row)));
});

router.delete("/unit-types/:id", requirePermission("unitTypes.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(unitTypesTable).set({ isDeleted: true, isActive: false }).where(and(eq(unitTypesTable.id, id), eq(unitTypesTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "unitType", entityId: id });
  res.json({ success: true });
});

// ----- unit statuses -----
router.get("/unit-statuses", requirePermission("unitStatuses.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(unitStatusesTable.isDeleted, false)];
  if (search) {
    const s = or(ilike(unitStatusesTable.code, `%${search}%`), ilike(unitStatusesTable.name, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(unitStatusesTable.companyId, companyId));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(unitStatusesTable)
    .where(where);
  const rows = await db
    .select()
    .from(unitStatusesTable)
    .where(where)
    .orderBy(desc(unitStatusesTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListUnitStatusesResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/unit-statuses", requirePermission("unitStatuses.create"), async (req, res): Promise<void> => {
  const parsed = CreateUnitStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(unitStatusesTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "unitStatus", entityId: row.id, newValue: row });
  res.status(201).json(GetUnitStatusResponse.parse(serializeRow(row)));
});

router.get("/unit-statuses/:id", requirePermission("unitStatuses.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(unitStatusesTable).where(and(eq(unitStatusesTable.id, id), eq(unitStatusesTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetUnitStatusResponse.parse(serializeRow(row)));
});

router.patch("/unit-statuses/:id", requirePermission("unitStatuses.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateUnitStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(unitStatusesTable).where(and(eq(unitStatusesTable.id, id), eq(unitStatusesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(unitStatusesTable).set(update).where(eq(unitStatusesTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "unitStatus", entityId: id, oldValue: existing, newValue: row });
  res.json(GetUnitStatusResponse.parse(serializeRow(row)));
});

router.delete("/unit-statuses/:id", requirePermission("unitStatuses.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(unitStatusesTable).set({ isDeleted: true, isActive: false }).where(and(eq(unitStatusesTable.id, id), eq(unitStatusesTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "unitStatus", entityId: id });
  res.json({ success: true });
});

export default router;
