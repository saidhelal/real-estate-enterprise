import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, rolesTable, permissionsTable, userRolesTable, usersTable } from "@workspace/db";
import {
  ListRolesResponse,
  CreateRoleBody,
  GetRoleResponse,
  UpdateRoleBody,
  ListPermissionsResponse,
  ListRoleUsersResponse,
} from "@workspace/api-zod";
import { roleUserCounts } from "../lib/access";
import { toRole } from "../lib/presenters";
import { recordAudit } from "../lib/audit";
import { companyScope } from "../lib/register-crud";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

/**
 * Refuse a permission change that reaches beyond what the editor holds.
 *
 * Without this, `roles.update` is the only permission anyone ever needs: hold
 * it, add `*` to your own role, and you hold everything. That is not a
 * theoretical escalation — the permission matrix screen exists precisely to
 * make bulk permission edits easy, so the guard has to live on the server
 * where both the matrix and the role editor pass through it.
 *
 * The rule is applied to the *difference*, not the result: an editor may only
 * grant, and only revoke, permissions they themselves hold. Revocation is
 * included deliberately — being able to strip a permission you cannot see is
 * its own way to take a system apart. A holder of `*` is unrestricted.
 */
function permissionDeltaBeyondCaller(
  held: string[],
  before: string[],
  after: string[],
): string[] {
  if (held.includes("*")) return [];
  const mine = new Set(held);
  const was = new Set(before);
  const now = new Set(after);
  const changed = [
    ...after.filter((p) => !was.has(p)),
    ...before.filter((p) => !now.has(p)),
  ];
  return Array.from(new Set(changed.filter((p) => !mine.has(p))));
}

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
  const requested = parsed.data.permissions ?? [];
  const beyond = permissionDeltaBeyondCaller(req.authUser?.permissions ?? [], [], requested);
  if (beyond.length) {
    res.status(403).json({
      error: `You cannot grant permissions you do not hold: ${beyond.join(", ")}`,
    });
    return;
  }
  const [row] = await db
    .insert(rolesTable)
    .values({
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      permissions: requested,
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
  if (parsed.data.permissions !== undefined) {
    const beyond = permissionDeltaBeyondCaller(
      req.authUser?.permissions ?? [],
      existing.permissions,
      parsed.data.permissions,
    );
    if (beyond.length) {
      res.status(403).json({
        error: `You cannot change permissions you do not hold: ${beyond.join(", ")}`,
      });
      return;
    }
    update.permissions = parsed.data.permissions;
  }

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

/**
 * Who actually holds this role.
 *
 * The list screen already shows a count; the count is what prompts the
 * question. Answering it needs `users.view` as well as `roles.view` — the rows
 * returned are user records, and someone allowed to read the role catalogue is
 * not thereby allowed to enumerate staff.
 */
router.get(
  "/roles/:id/users",
  requirePermission("users.view"),
  async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const [role] = await db
      .select({ id: rolesTable.id })
      .from(rolesTable)
      .where(and(eq(rolesTable.id, id), eq(rolesTable.isDeleted, false)));
    if (!role) {
      res.status(404).json({ error: "Role not found" });
      return;
    }
    const conds = [eq(userRolesTable.roleId, id), eq(usersTable.isDeleted, false)];
    // A company-pinned caller sees only their own company's holders.
    const scope = req.authUser?.companyId;
    // One shared rule, so no endpoint can forget the tenant filter.
    const scoped = companyScope(usersTable, req);
    if (scoped) conds.push(scoped);
    const rows = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        fullName: usersTable.fullName,
        email: usersTable.email,
        isActive: usersTable.isActive,
        status: usersTable.status,
        companyId: usersTable.companyId,
      })
      .from(userRolesTable)
      .innerJoin(usersTable, eq(usersTable.id, userRolesTable.userId))
      .where(and(...conds))
      .orderBy(usersTable.fullName);
    res.json(ListRoleUsersResponse.parse(rows));
  },
);

router.get("/permissions", requirePermission("roles.view"), async (_req, res): Promise<void> => {
  const rows = await db.select().from(permissionsTable).orderBy(permissionsTable.module);
  res.json(ListPermissionsResponse.parse(rows));
});

export default router;
