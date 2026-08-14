import { and, eq, lte, gte, sql } from "drizzle-orm";
import { db, delegationsTable } from "@workspace/db";

/**
 * Delegated authority, resolved for one user at this moment.
 *
 * Kept in its own module rather than inside `access.ts` so the delegation
 * rules have one home, but it is deliberately *called from* the existing
 * permission resolution rather than replacing it. There is still exactly one
 * answer to "what may this user do", and it is still `loadAuthUser`.
 *
 * A delegation counts only while every condition holds: it is active, not
 * deleted, and today falls inside its window. Nothing here reads a status
 * column alone — an "active" row whose end date has passed grants nothing,
 * which is what makes an expiry safe even if no scheduled job has run to
 * relabel it.
 */

/** Today as `YYYY-MM-DD`, matching the date columns. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Permission codes currently delegated *to* this user.
 *
 * Returns codes only — never a wildcard. The write path refuses to store one,
 * and this refuses to honour one, so a wildcard cannot reach a user through a
 * delegation even if a row were somehow written by hand.
 */
export async function delegatedPermissionsFor(userId: string): Promise<string[]> {
  const now = today();
  const rows = await db
    .select({ permissions: delegationsTable.permissions })
    .from(delegationsTable)
    .where(
      and(
        eq(delegationsTable.delegateUserId, userId),
        eq(delegationsTable.status, "active"),
        eq(delegationsTable.isDeleted, false),
        lte(delegationsTable.startDate, now),
        gte(delegationsTable.endDate, now),
      ),
    );
  const out = new Set<string>();
  for (const row of rows) {
    for (const code of row.permissions ?? []) {
      if (code !== "*") out.add(code);
    }
  }
  return [...out];
}

/**
 * Everything a user may currently do, roles and live delegations together.
 *
 * Used where a decision has to be made about a user other than the caller —
 * the permission inspector, and the re-check performed when a delegation is
 * activated. Request-time authorisation does not call this; it uses the
 * `AuthUser` the session already resolved.
 */
export async function effectivePermissionsFor(
  userId: string,
): Promise<{ codes: Set<string>; wildcard: boolean; delegated: Set<string> }> {
  const [roleRows, delegated] = await Promise.all([
    db.execute<{ permission: string }>(sql`
      select distinct unnest(r.permissions) as permission
      from user_roles ur
      join roles r on r.id = ur.role_id and r.is_deleted = false
      where ur.user_id = ${userId}
    `),
    delegatedPermissionsFor(userId),
  ]);
  const rolePerms = (roleRows.rows ?? []).map((r) => r.permission);
  const wildcard = rolePerms.includes("*");
  const codes = new Set<string>([...rolePerms, ...delegated]);
  return { codes, wildcard, delegated: new Set(delegated) };
}
