import { Router, type IRouter } from "express";
import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db, lookupTypesTable, lookupValuesTable } from "@workspace/db";
import {
  CreateLookupTypeBody,
  UpdateLookupTypeBody,
  ListLookupTypesResponse,
  CreateLookupValueBody,
  UpdateLookupValueBody,
  ListLookupValuesResponse,
  ReorderLookupValuesBody,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

const MODULE = "masterData";

/** Read a tri-state boolean query param ("true"/"false"); undefined when absent. */
function qBool(query: Record<string, unknown>, key: string): boolean | undefined {
  const v = query[key];
  if (typeof v !== "string") return undefined;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

/* ===================================================================== */
/* Lookup types                                                          */
/* ===================================================================== */

router.get("/lookup-types", requirePermission(`${MODULE}.view`), async (req, res): Promise<void> => {
  const query = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(query);
  const search = qStr(query, "search");
  const companyId = qStr(query, "companyId");
  const moduleFilter = qStr(query, "module");
  const active = qBool(query, "active");

  const conds: SQL[] = [eq(lookupTypesTable.isDeleted, false)];
  if (companyId) conds.push(eq(lookupTypesTable.companyId, companyId));
  if (moduleFilter) conds.push(eq(lookupTypesTable.module, moduleFilter));
  if (active !== undefined) conds.push(eq(lookupTypesTable.isActive, active));
  if (search) {
    const like = `%${search}%`;
    const combined = or(
      ilike(lookupTypesTable.code, like),
      ilike(lookupTypesTable.nameEn, like),
      ilike(lookupTypesTable.nameAr, like),
    );
    if (combined) conds.push(combined);
  }
  const where = and(...conds);
  const rows = (await db
    .select()
    .from(lookupTypesTable)
    .where(where)
    .orderBy(asc(lookupTypesTable.sortOrder), asc(lookupTypesTable.nameEn))
    .limit(pageSize)
    .offset(offset)) as Record<string, unknown>[];
  const countRows = (await db
    .select({ count: sql<number>`count(*)::int` })
    .from(lookupTypesTable)
    .where(where)) as { count: number }[];
  res.json(
    ListLookupTypesResponse.parse({
      data: rows.map(serializeRow),
      total: countRows[0].count,
      page,
      pageSize,
    }),
  );
});

router.post("/lookup-types", requirePermission(`${MODULE}.create`), async (req, res): Promise<void> => {
  const parsed = CreateLookupTypeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const inserted = (await db
    .insert(lookupTypesTable)
    .values(parsed.data as typeof lookupTypesTable.$inferInsert)
    .returning()) as Record<string, unknown>[];
  const row = inserted[0];
  await recordAudit(req, { action: "create", entity: "lookupType", entityId: row.id as string, newValue: row });
  res.status(201).json(serializeRow(row));
});

router.get("/lookup-types/:id", requirePermission(`${MODULE}.view`), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const rows = (await db
    .select()
    .from(lookupTypesTable)
    .where(and(eq(lookupTypesTable.id, id), eq(lookupTypesTable.isDeleted, false)))) as Record<string, unknown>[];
  const row = rows[0];
  if (!row) {
    res.status(404).json({ error: "lookupType not found" });
    return;
  }
  res.json(serializeRow(row));
});

router.patch("/lookup-types/:id", requirePermission(`${MODULE}.update`), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateLookupTypeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existingRows = (await db
    .select()
    .from(lookupTypesTable)
    .where(and(eq(lookupTypesTable.id, id), eq(lookupTypesTable.isDeleted, false)))) as Record<string, unknown>[];
  const existing = existingRows[0];
  if (!existing) {
    res.status(404).json({ error: "lookupType not found" });
    return;
  }
  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data as Record<string, unknown>)) {
    if (v !== undefined) update[k] = v;
  }
  let row = existing;
  if (Object.keys(update).length) {
    const updated = (await db
      .update(lookupTypesTable)
      .set(update)
      .where(eq(lookupTypesTable.id, id))
      .returning()) as Record<string, unknown>[];
    row = updated[0];
  }
  await recordAudit(req, { action: "update", entity: "lookupType", entityId: id, oldValue: existing, newValue: row });
  res.json(serializeRow(row));
});

router.delete("/lookup-types/:id", requirePermission(`${MODULE}.delete`), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const existingRows = (await db
    .select()
    .from(lookupTypesTable)
    .where(and(eq(lookupTypesTable.id, id), eq(lookupTypesTable.isDeleted, false)))) as Record<string, unknown>[];
  const existing = existingRows[0];
  if (!existing) {
    res.status(404).json({ error: "lookupType not found" });
    return;
  }
  if (existing.isSystem) {
    res.status(409).json({ error: "A system lookup type cannot be deleted" });
    return;
  }
  await db.update(lookupTypesTable).set({ isDeleted: true, isActive: false }).where(eq(lookupTypesTable.id, id));
  await recordAudit(req, { action: "delete", entity: "lookupType", entityId: id, oldValue: existing });
  res.json({ success: true });
});

/* ===================================================================== */
/* Lookup values                                                         */
/* ===================================================================== */

router.get("/lookup-values", requirePermission(`${MODULE}.view`), async (req, res): Promise<void> => {
  const query = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(query);
  const search = qStr(query, "search");
  const companyId = qStr(query, "companyId");
  const typeId = qStr(query, "typeId");
  const typeCode = qStr(query, "typeCode");
  const active = qBool(query, "active");
  const archived = qBool(query, "archived");

  const conds: SQL[] = [eq(lookupValuesTable.isDeleted, false)];
  if (companyId) conds.push(eq(lookupValuesTable.companyId, companyId));
  if (typeId) conds.push(eq(lookupValuesTable.typeId, typeId));
  if (active !== undefined) conds.push(eq(lookupValuesTable.isActive, active));
  if (archived !== undefined) conds.push(eq(lookupValuesTable.isArchived, archived));

  // Resolve typeCode -> typeId (code is globally unique). An unknown code yields
  // an empty result set rather than ignoring the filter.
  if (typeCode) {
    const typeRows = (await db
      .select({ id: lookupTypesTable.id })
      .from(lookupTypesTable)
      .where(and(eq(lookupTypesTable.code, typeCode), eq(lookupTypesTable.isDeleted, false)))) as { id: string }[];
    const resolved = typeRows[0]?.id;
    if (!resolved) {
      res.json(ListLookupValuesResponse.parse({ data: [], total: 0, page, pageSize }));
      return;
    }
    conds.push(eq(lookupValuesTable.typeId, resolved));
  }

  if (search) {
    const like = `%${search}%`;
    const combined = or(
      ilike(lookupValuesTable.code, like),
      ilike(lookupValuesTable.labelEn, like),
      ilike(lookupValuesTable.labelAr, like),
    );
    if (combined) conds.push(combined);
  }
  const where = and(...conds);
  const rows = (await db
    .select()
    .from(lookupValuesTable)
    .where(where)
    .orderBy(asc(lookupValuesTable.sortOrder), asc(lookupValuesTable.labelEn))
    .limit(pageSize)
    .offset(offset)) as Record<string, unknown>[];
  const countRows = (await db
    .select({ count: sql<number>`count(*)::int` })
    .from(lookupValuesTable)
    .where(where)) as { count: number }[];
  res.json(
    ListLookupValuesResponse.parse({
      data: rows.map(serializeRow),
      total: countRows[0].count,
      page,
      pageSize,
    }),
  );
});

router.post("/lookup-values", requirePermission(`${MODULE}.create`), async (req, res): Promise<void> => {
  const parsed = CreateLookupValueBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = parsed.data as Record<string, unknown>;
  const typeRows = (await db
    .select({ id: lookupTypesTable.id })
    .from(lookupTypesTable)
    .where(
      and(eq(lookupTypesTable.id, data.typeId as string), eq(lookupTypesTable.isDeleted, false)),
    )) as { id: string }[];
  if (!typeRows[0]) {
    res.status(400).json({ error: "typeId does not reference an existing lookup type" });
    return;
  }
  const inserted = (await db
    .insert(lookupValuesTable)
    .values(data as typeof lookupValuesTable.$inferInsert)
    .returning()) as Record<string, unknown>[];
  const row = inserted[0];
  await recordAudit(req, { action: "create", entity: "lookupValue", entityId: row.id as string, newValue: row });
  res.status(201).json(serializeRow(row));
});

// Bulk reorder. Registered before the `:id` routes for clarity; the path does
// not collide because no POST /lookup-values/:id route exists.
router.post("/lookup-values/reorder", requirePermission(`${MODULE}.reorder`), async (req, res): Promise<void> => {
  const parsed = ReorderLookupValuesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const items = (parsed.data as { items: { id: string; sortOrder: number }[] }).items;
  await db.transaction(async (tx) => {
    for (const item of items) {
      await tx
        .update(lookupValuesTable)
        .set({ sortOrder: item.sortOrder })
        .where(and(eq(lookupValuesTable.id, item.id), eq(lookupValuesTable.isDeleted, false)));
    }
  });
  await recordAudit(req, {
    action: "reorder",
    entity: "lookupValue",
    entityId: items[0]?.id ?? "",
    newValue: { items },
  });
  res.json({ success: true });
});

router.get("/lookup-values/:id", requirePermission(`${MODULE}.view`), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const rows = (await db
    .select()
    .from(lookupValuesTable)
    .where(and(eq(lookupValuesTable.id, id), eq(lookupValuesTable.isDeleted, false)))) as Record<string, unknown>[];
  const row = rows[0];
  if (!row) {
    res.status(404).json({ error: "lookupValue not found" });
    return;
  }
  res.json(serializeRow(row));
});

router.patch("/lookup-values/:id", requirePermission(`${MODULE}.update`), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateLookupValueBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existingRows = (await db
    .select()
    .from(lookupValuesTable)
    .where(and(eq(lookupValuesTable.id, id), eq(lookupValuesTable.isDeleted, false)))) as Record<string, unknown>[];
  const existing = existingRows[0];
  if (!existing) {
    res.status(404).json({ error: "lookupValue not found" });
    return;
  }
  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data as Record<string, unknown>)) {
    if (v !== undefined) update[k] = v;
  }
  let row = existing;
  if (Object.keys(update).length) {
    const updated = (await db
      .update(lookupValuesTable)
      .set(update)
      .where(eq(lookupValuesTable.id, id))
      .returning()) as Record<string, unknown>[];
    row = updated[0];
  }
  await recordAudit(req, { action: "update", entity: "lookupValue", entityId: id, oldValue: existing, newValue: row });
  res.json(serializeRow(row));
});

router.delete("/lookup-values/:id", requirePermission(`${MODULE}.delete`), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const existingRows = (await db
    .select()
    .from(lookupValuesTable)
    .where(and(eq(lookupValuesTable.id, id), eq(lookupValuesTable.isDeleted, false)))) as Record<string, unknown>[];
  const existing = existingRows[0];
  if (!existing) {
    res.status(404).json({ error: "lookupValue not found" });
    return;
  }
  if (existing.isSystem) {
    res.status(409).json({ error: "A system lookup value cannot be deleted; archive it instead" });
    return;
  }
  await db.update(lookupValuesTable).set({ isDeleted: true, isActive: false }).where(eq(lookupValuesTable.id, id));
  await recordAudit(req, { action: "delete", entity: "lookupValue", entityId: id, oldValue: existing });
  res.json({ success: true });
});

/* ----------------------------- Value lifecycle actions ---------------- */

async function setValueFlags(
  req: import("express").Request,
  res: import("express").Response,
  id: string,
  patch: Record<string, unknown>,
  action: string,
): Promise<void> {
  const existingRows = (await db
    .select()
    .from(lookupValuesTable)
    .where(and(eq(lookupValuesTable.id, id), eq(lookupValuesTable.isDeleted, false)))) as Record<string, unknown>[];
  const existing = existingRows[0];
  if (!existing) {
    res.status(404).json({ error: "lookupValue not found" });
    return;
  }
  const updated = (await db
    .update(lookupValuesTable)
    .set(patch)
    .where(eq(lookupValuesTable.id, id))
    .returning()) as Record<string, unknown>[];
  const row = updated[0];
  await recordAudit(req, { action, entity: "lookupValue", entityId: id, oldValue: existing, newValue: row });
  res.json(serializeRow(row));
}

router.post("/lookup-values/:id/activate", requirePermission(`${MODULE}.update`), async (req, res): Promise<void> => {
  await setValueFlags(req, res, String(req.params.id), { isActive: true }, "activate");
});

router.post("/lookup-values/:id/deactivate", requirePermission(`${MODULE}.update`), async (req, res): Promise<void> => {
  await setValueFlags(req, res, String(req.params.id), { isActive: false }, "deactivate");
});

router.post("/lookup-values/:id/archive", requirePermission(`${MODULE}.archive`), async (req, res): Promise<void> => {
  await setValueFlags(req, res, String(req.params.id), { isArchived: true }, "archive");
});

router.post("/lookup-values/:id/unarchive", requirePermission(`${MODULE}.archive`), async (req, res): Promise<void> => {
  await setValueFlags(req, res, String(req.params.id), { isArchived: false }, "unarchive");
});

export default router;
