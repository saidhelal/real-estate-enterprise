import { Router, type IRouter } from "express";
import { and, eq, ilike, or } from "drizzle-orm";
import { db, usersTable, userRolesTable, userScopesTable } from "@workspace/db";
import {
  ListUsersResponse,
  CreateUserBody,
  GetUserResponse,
  UpdateUserBody,
  SetUserStatusBody,
  ResetUserPasswordBody,
  SetUserScopesBody,
  GetUserScopesResponse,
  SetUserScopesResponse,
} from "@workspace/api-zod";
import { hashPassword, validatePasswordPolicy } from "../lib/auth";
import { roleUserCounts, rolesApiForUser, loadUserScopes } from "../lib/access";
import { toUser } from "../lib/presenters";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/users", requirePermission("users.view"), async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const status = typeof req.query.status === "string" ? req.query.status : "";

  const filters = [eq(usersTable.isDeleted, false)];
  if (status === "active" || status === "inactive" || status === "locked") {
    filters.push(eq(usersTable.status, status));
  }
  if (search) {
    const like = `%${search}%`;
    const term = or(
      ilike(usersTable.username, like),
      ilike(usersTable.fullName, like),
      ilike(usersTable.email, like),
    );
    if (term) filters.push(term);
  }

  const rows = await db
    .select()
    .from(usersTable)
    .where(and(...filters))
    .orderBy(usersTable.createdAt);

  const counts = await roleUserCounts();
  const result = await Promise.all(
    rows.map(async (row) => toUser(row, await rolesApiForUser(row.id, counts))),
  );
  res.json(ListUsersResponse.parse(result));
});

router.post("/users", requirePermission("users.create"), async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const policyError = validatePasswordPolicy(parsed.data.password);
  if (policyError) {
    res.status(400).json({ error: policyError });
    return;
  }

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.username, parsed.data.username), eq(usersTable.isDeleted, false)));
  if (existing) {
    res.status(409).json({ error: "Username already exists" });
    return;
  }

  const [row] = await db
    .insert(usersTable)
    .values({
      username: parsed.data.username,
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone ?? null,
      companyId: parsed.data.companyId ?? null,
      passwordHash: await hashPassword(parsed.data.password),
    })
    .returning();

  const roleIds = parsed.data.roleIds ?? [];
  if (roleIds.length > 0) {
    await db.insert(userRolesTable).values(roleIds.map((roleId) => ({ userId: row.id, roleId })));
  }

  await recordAudit(req, { action: "create", entity: "user", entityId: row.id, newValue: row });
  res.status(201).json(GetUserResponse.parse(toUser(row, await rolesApiForUser(row.id))));
});

router.get("/users/:id", requirePermission("users.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, id), eq(usersTable.isDeleted, false)));
  if (!row) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(GetUserResponse.parse(toUser(row, await rolesApiForUser(row.id))));
});

router.patch("/users/:id", requirePermission("users.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, id), eq(usersTable.isDeleted, false)));
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.fullName !== undefined) update.fullName = parsed.data.fullName;
  if (parsed.data.email !== undefined) update.email = parsed.data.email;
  if (parsed.data.phone !== undefined) update.phone = parsed.data.phone;
  if (parsed.data.companyId !== undefined) update.companyId = parsed.data.companyId;

  const [row] = Object.keys(update).length
    ? await db.update(usersTable).set(update).where(eq(usersTable.id, id)).returning()
    : [existing];

  if (parsed.data.roleIds !== undefined) {
    await db.delete(userRolesTable).where(eq(userRolesTable.userId, id));
    if (parsed.data.roleIds.length > 0) {
      await db
        .insert(userRolesTable)
        .values(parsed.data.roleIds.map((roleId) => ({ userId: id, roleId })));
    }
  }

  await recordAudit(req, {
    action: "update",
    entity: "user",
    entityId: id,
    oldValue: existing,
    newValue: row,
  });
  res.json(GetUserResponse.parse(toUser(row, await rolesApiForUser(id))));
});

router.delete("/users/:id", requirePermission("users.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db
    .update(usersTable)
    .set({ isDeleted: true, isActive: false })
    .where(and(eq(usersTable.id, id), eq(usersTable.isDeleted, false)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  await recordAudit(req, { action: "delete", entity: "user", entityId: id });
  res.json({ success: true });
});

router.patch("/users/:id/status", requirePermission("users.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = SetUserStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const isActive = parsed.data.status === "active";
  const [row] = await db
    .update(usersTable)
    .set({
      status: parsed.data.status,
      isActive,
      failedAttempts: 0,
      lockedUntil: null,
    })
    .where(and(eq(usersTable.id, id), eq(usersTable.isDeleted, false)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  await recordAudit(req, {
    action: "status",
    entity: "user",
    entityId: id,
    newValue: { status: parsed.data.status },
  });
  res.json(GetUserResponse.parse(toUser(row, await rolesApiForUser(id))));
});

// Administrative password reset. Sets a temporary password and, by default,
// forces the user to change it on next login.
router.post(
  "/users/:id/reset-password",
  requirePermission("users.update"),
  async (req, res): Promise<void> => {
    const parsed = ResetUserPasswordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const policyError = validatePasswordPolicy(parsed.data.newPassword);
    if (policyError) {
      res.status(400).json({ error: policyError });
      return;
    }
    const id = String(req.params.id);
    const mustChange = parsed.data.mustChangePassword ?? true;
    const [row] = await db
      .update(usersTable)
      .set({
        passwordHash: await hashPassword(parsed.data.newPassword),
        mustChangePassword: mustChange,
        failedAttempts: 0,
        lockedUntil: null,
        status: "active",
      })
      .where(and(eq(usersTable.id, id), eq(usersTable.isDeleted, false)))
      .returning();
    if (!row) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    await recordAudit(req, {
      action: "reset-password",
      entity: "users",
      entityId: id,
      newValue: { mustChangePassword: mustChange },
    });
    res.json(GetUserResponse.parse(toUser(row, await rolesApiForUser(id))));
  },
);

router.get(
  "/users/:id/scopes",
  requirePermission("users.view"),
  async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const [row] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.id, id), eq(usersTable.isDeleted, false)))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(GetUserScopesResponse.parse(await loadUserScopes(id)));
  },
);

router.put(
  "/users/:id/scopes",
  requirePermission("users.update"),
  async (req, res): Promise<void> => {
    const parsed = SetUserScopesBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const id = String(req.params.id);
    const [row] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.id, id), eq(usersTable.isDeleted, false)))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const { branchIds, departmentIds, projectIds } = parsed.data;
    const inserts = [
      ...branchIds.map((scopeId) => ({ userId: id, scopeType: "branch", scopeId })),
      ...departmentIds.map((scopeId) => ({ userId: id, scopeType: "department", scopeId })),
      ...projectIds.map((scopeId) => ({ userId: id, scopeType: "project", scopeId })),
    ];

    await db.transaction(async (tx) => {
      await tx.delete(userScopesTable).where(eq(userScopesTable.userId, id));
      if (inserts.length > 0) await tx.insert(userScopesTable).values(inserts);
    });

    await recordAudit(req, {
      action: "set-scopes",
      entity: "users",
      entityId: id,
      newValue: { branchIds, departmentIds, projectIds },
    });

    res.json(SetUserScopesResponse.parse(await loadUserScopes(id)));
  },
);

export default router;
