import { Router, type IRouter } from "express";
import { and, eq, lte, gte } from "drizzle-orm";
import { db, usersTable, delegationsTable } from "@workspace/db";
import { InspectUserPermissionsResponse } from "@workspace/api-zod";
import { requireAuth, requirePermission } from "../middleware/auth";
import { rolesApiForUser } from "../lib/access";
import { serializeRow } from "../lib/serialize";

/**
 * The permission inspector.
 *
 * Read-only, and owns nothing. Every fact it reports is read from the system
 * that already holds it — roles from the RBAC store, delegated codes from the
 * delegations register, company from the user row. Its whole contribution is
 * to answer the question none of them answers alone: *why* does this person
 * hold this permission, and is that a problem.
 *
 * There is no permission engine here. It does not decide access; it explains
 * the decisions the existing one already makes.
 */

const router: IRouter = Router();
router.use(requireAuth);

/** Today as `YYYY-MM-DD`, matching the delegation date columns. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

router.get(
  "/permission-inspector/:userId",
  // Reading another account's full authority is a security review, so it is
  // gated on the users permission rather than on merely being able to see the
  // role catalogue.
  requirePermission("users.view"),
  async (req, res): Promise<void> => {
    const userId = String(req.params.userId);
    const [user] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.id, userId), eq(usersTable.isDeleted, false)));

    const scope = req.authUser?.companyId ?? null;
    // Answered as "not found" rather than "forbidden": a 403 on a foreign id
    // confirms the account exists, which is an enumeration oracle over
    // another tenant's staff.
    if (!user || (scope && user.companyId !== scope)) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const roles = await rolesApiForUser(userId);
    const wildcard = roles.some((r) => r.permissions.includes("*"));

    const now = today();
    const liveDelegations = (await db
      .select()
      .from(delegationsTable)
      .where(
        and(
          eq(delegationsTable.delegateUserId, userId),
          eq(delegationsTable.status, "active"),
          eq(delegationsTable.isDeleted, false),
          lte(delegationsTable.startDate, now),
          gte(delegationsTable.endDate, now),
        ),
      )) as Record<string, unknown>[];

    /**
     * Every code the user holds, with where each one came from. A code held
     * through two roles and a delegation lists all three — which is the point:
     * revoking one source does not necessarily remove the access.
     */
    const grants = new Map<string, { kind: string; label: string; expiresOn: string | null }[]>();
    const add = (code: string, source: { kind: string; label: string; expiresOn: string | null }) => {
      grants.set(code, [...(grants.get(code) ?? []), source]);
    };
    for (const role of roles) {
      for (const code of role.permissions) {
        add(code, { kind: "role", label: role.name, expiresOn: null });
      }
    }
    for (const d of liveDelegations) {
      for (const code of (d.permissions as string[]) ?? []) {
        add(code, {
          kind: "delegation",
          label: String(d.code),
          expiresOn: String(d.endDate),
        });
      }
    }

    /**
     * What a reviewer should look at. Stated as observations, not verdicts —
     * each one can be legitimate, and the screen says why it was flagged so a
     * human decides.
     */
    const riskFlags: string[] = [];
    if (wildcard) riskFlags.push("holds_wildcard");
    if (roles.length === 0) riskFlags.push("no_roles");
    if (!user.companyId) riskFlags.push("no_company_scope");
    if (!user.employeeId) riskFlags.push("no_employee_link");
    if (!user.isActive || user.status !== "active") riskFlags.push("inactive_account");
    if (liveDelegations.length > 0) riskFlags.push("holds_live_delegation");
    // A permission reachable through both a role and a delegation means the
    // delegation is currently redundant — worth seeing before it is renewed.
    const redundant = [...grants.entries()].filter(
      ([, sources]) =>
        sources.some((s) => s.kind === "delegation") && sources.some((s) => s.kind === "role"),
    );
    if (redundant.length > 0) riskFlags.push("delegation_duplicates_role");

    res.json(
      InspectUserPermissionsResponse.parse({
        userId: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        isActive: user.isActive,
        status: user.status,
        companyId: user.companyId,
        employeeId: user.employeeId,
        wildcard,
        roles,
        grants: [...grants.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([code, sources]) => ({ code, sources })),
        delegations: liveDelegations.map(serializeRow),
        riskFlags,
      }),
    );
  },
);

export default router;
