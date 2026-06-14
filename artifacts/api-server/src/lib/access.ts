import { and, eq, inArray, sql } from "drizzle-orm";
import { db, usersTable, rolesTable, userRolesTable } from "@workspace/db";
import type { AuthUser } from "./auth";
import { toRole, type RoleApi } from "./presenters";

/** Count of (non-deleted) users assigned to each role, keyed by role id. */
export async function roleUserCounts(): Promise<Map<string, number>> {
  const rows = await db
    .select({
      roleId: userRolesTable.roleId,
      count: sql<number>`count(*)::int`,
    })
    .from(userRolesTable)
    .innerJoin(usersTable, eq(usersTable.id, userRolesTable.userId))
    .where(eq(usersTable.isDeleted, false))
    .groupBy(userRolesTable.roleId);
  return new Map(rows.map((r) => [r.roleId, r.count]));
}

/** Resolve the API-shaped roles assigned to a single user. */
export async function rolesApiForUser(
  userId: string,
  counts?: Map<string, number>,
): Promise<RoleApi[]> {
  const links = await db
    .select({ roleId: userRolesTable.roleId })
    .from(userRolesTable)
    .where(eq(userRolesTable.userId, userId));
  const roleIds = links.map((l) => l.roleId);
  if (roleIds.length === 0) return [];
  const roles = await db
    .select()
    .from(rolesTable)
    .where(and(inArray(rolesTable.id, roleIds), eq(rolesTable.isDeleted, false)));
  return roles.map((r) => toRole(r, counts?.get(r.id) ?? 0));
}

/**
 * Load a user together with the roles and the flattened set of permissions
 * granted through those roles. Returns null when the user does not exist or
 * has been soft-deleted. A role permission of "*" grants all permissions.
 */
export async function loadAuthUser(userId: string): Promise<AuthUser | null> {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, userId), eq(usersTable.isDeleted, false)));

  if (!user) return null;
  // Deny access to deactivated or currently-locked accounts even when they
  // still hold a valid (unexpired) access token.
  if (!user.isActive || user.status === "inactive") return null;
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) return null;

  const links = await db
    .select({ roleId: userRolesTable.roleId })
    .from(userRolesTable)
    .where(eq(userRolesTable.userId, userId));

  const roleIds = links.map((l) => l.roleId);

  let roleNames: string[] = [];
  const permissionSet = new Set<string>();

  if (roleIds.length > 0) {
    const roles = await db
      .select()
      .from(rolesTable)
      .where(and(inArray(rolesTable.id, roleIds), eq(rolesTable.isDeleted, false)));

    roleNames = roles.map((r) => r.name);
    for (const role of roles) {
      for (const perm of role.permissions) permissionSet.add(perm);
    }
  }

  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    roles: roleNames,
    permissions: Array.from(permissionSet),
  };
}
