import { and, eq, inArray, sql } from "drizzle-orm";
import { db, usersTable, rolesTable, userRolesTable, userScopesTable } from "@workspace/db";
import type { AuthUser, UserScopes } from "./auth";
import { toRole, type RoleApi } from "./presenters";
import { delegatedPermissionsFor } from "./delegation-access";

/** Load a user's branch/department/project scope grants. */
export async function loadUserScopes(userId: string): Promise<UserScopes> {
  const rows = await db
    .select({ scopeType: userScopesTable.scopeType, scopeId: userScopesTable.scopeId })
    .from(userScopesTable)
    .where(eq(userScopesTable.userId, userId));
  const scopes: UserScopes = { branchIds: [], departmentIds: [], projectIds: [] };
  for (const r of rows) {
    if (r.scopeType === "branch") scopes.branchIds.push(r.scopeId);
    else if (r.scopeType === "department") scopes.departmentIds.push(r.scopeId);
    else if (r.scopeType === "project") scopes.projectIds.push(r.scopeId);
  }
  return scopes;
}

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

  // Live delegations are added on top of the roles, in the one place the
  // answer to "what may this user do" is produced. Putting them anywhere else
  // would mean some call sites honoured a delegation and others did not.
  // `delegatedPermissionsFor` never returns the wildcard, so a delegation can
  // widen what someone may do but can never make them an administrator.
  for (const perm of await delegatedPermissionsFor(user.id)) permissionSet.add(perm);

  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    roles: roleNames,
    permissions: Array.from(permissionSet),
    mustChangePassword: user.mustChangePassword,
    scopes: await loadUserScopes(user.id),
    companyId: user.companyId ?? null,
  };
}
