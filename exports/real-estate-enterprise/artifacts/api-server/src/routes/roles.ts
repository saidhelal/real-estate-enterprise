import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, rolesTable, permissionsTable } from "@workspace/db";
import {
  ListRolesResponse,
  CreateRoleBody,
  GetRoleResponse,
  UpdateRoleBody,
  ListPermissionsResponse,
} from "@workspace/api-zod";
import { roleUserCounts } from "../lib/access";
import { toRole } from "../lib/presenters";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/roles", requirePermission("roles.view"), async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(rolesTable)
    .where(eq(rolesTable.isDeleted, false))
    .orderBy(rolesTable.createdAt);
  const counts = await roleUserCounts();
  res.json(ListRolesResponse.parse(rows.map((r) => toRole(r, counts.get(r.id) ?? 0))));
});

router.post("/roles", requirePermission("roles.create"), async (req, res): Promise<void> => {
  const parsed = CreateRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db
    .select({ id: rolesTable.id })
    .from(rolesTable)
    .where(and(eq(rolesTable.name, parsed.data.name), eq(rolesTable.isDeleted, false)));
  if (existing) {
    res.status(409).json({ error: "Role name already exists" });
    return;
  }
  const [row] = await db
    .insert(rolesTable)
    .values({
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      permissions: parsed.data.permissions ?? [],
    })
    .returning();
  await recordAudit(req, { action: "create", entity: "role", entityId: row.id, newValue: row });
  res.status(201).json(GetRoleResponse.parse(toRole(row, 0)));
});

router.get("/roles/:id", requirePermission("roles.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db
    .select()
    .from(rolesTable)
    .where(and(eq(rolesTable.id, id), eq(rolesTable.isDeleted, false)));
  if (!row) {
    res.status(404).json({ error: "Role not found" });
    return;
  }
  const counts = await roleUserCounts();
  res.json(GetRoleResponse.parse(toRole(row, counts.get(id) ?? 0)));
});

router.patch("/roles/:id", requirePermission("roles.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(rolesTable)
    .where(and(eq(rolesTable.id, id), eq(rolesTable.isDeleted, false)));
  if (!existing) {
    res.status(404).json({ error: "Role not found" });
    return;
  }
  const update: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.description !== undefined) update.description = parsed.data.description;
  if (parsed.data.permissions !== undefined) update.permissions = parsed.data.permissions;

  const [row] = Object.keys(update).length
    ? await db.update(rolesTable).set(update).where(eq(rolesTable.id, id)).returning()
    : [existing];

  await recordAudit(req, {
    action: "update",
    entity: "role",
    entityId: id,
    oldValue: existing,
    newValue: row,
  });
  const counts = await roleUserCounts();
  res.json(GetRoleResponse.parse(toRole(row, counts.get(id) ?? 0)));
});

router.delete("/roles/:id", requirePermission("roles.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [existing] = await db
    .select()
    .from(rolesTable)
    .where(and(eq(rolesTable.id, id), eq(rolesTable.isDeleted, false)));
  if (!existing) {
    res.status(404).json({ error: "Role not found" });
    return;
  }
  if (existing.isSystem) {
    res.status(400).json({ error: "System roles cannot be deleted" });
    return;
  }
  await db.update(rolesTable).set({ isDeleted: true }).where(eq(rolesTable.id, id));
  await recordAudit(req, { action: "delete", entity: "role", entityId: id });
  res.json({ success: true });
});

router.get("/permissions", requirePermission("roles.view"), async (_req, res): Promise<void> => {
  const rows = await db.select().from(permissionsTable).orderBy(permissionsTable.module);
  res.json(ListPermissionsResponse.parse(rows));
});

export default router;
