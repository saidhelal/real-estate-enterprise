import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { inArray } from "drizzle-orm";
import { db, pool, usersTable, rolesTable, userRolesTable } from "@workspace/db";
import app from "../app";
import { ACCESS_COOKIE, TESTING_COOKIE, signAccessToken, hashPassword } from "../lib/auth";

// Cross-module access boundary test ("can a normal role actually reach each
// module?").
//
// Every route module is mounted path-less in routes/index.ts
// (`router.use(xxxRouter)`). With Express 5 a sub-router's top-level
// `router.use(mw)` middleware runs for EVERY request that flows through it -
// even requests destined for a *different* module mounted after it. So a bare,
// unscoped `router.use(requirePermission("xyz.view"))` inside one module would
// silently 403 every module mounted below it for any user lacking "xyz.view".
// This regression is invisible when testing as the super admin (the "*" role
// bypasses all permission checks), which is exactly how it slipped through once
// already (a /bi guard leaked onto notifications + eight other modules).
//
// Strategy: for each authenticated module we probe a representative GET endpoint
// using a NON-"*" user that holds ONLY that endpoint's own permission (or no
// permissions at all for the auth-only endpoints). Because each probe user lacks
// every *other* module's permission, any sibling guard that leaks across mounts
// will 403 the probe -> the test fails. The probe must come back 200 or 404
// (the row may legitimately not exist), never a stray 403. The last-mounted
// probe (/testing/status, auth-only) covers leaks from every router before it.

type ModuleProbe = {
  module: string;
  /** Path under the /api prefix. */
  path: string;
  /** The single permission the probe user is granted; null = auth only. */
  permission: string | null;
};

// One representative authenticated GET per module, in mount order. Permission
// strings match each route's own `requirePermission(...)` guard so the probe's
// OWN guard passes - any 403 therefore comes from a leaking sibling guard.
const PROBES: ModuleProbe[] = [
  { module: "users", path: "/api/users", permission: "users.view" },
  { module: "roles", path: "/api/roles", permission: "roles.view" },
  { module: "companies", path: "/api/companies", permission: "companies.view" },
  { module: "branches", path: "/api/branches", permission: "branches.view" },
  { module: "fiscal-years", path: "/api/fiscal-years", permission: "fiscalYears.view" },
  { module: "currencies", path: "/api/currencies", permission: "currencies.view" },
  { module: "settings", path: "/api/settings", permission: "settings.view" },
  { module: "number-sequences", path: "/api/number-sequences", permission: "numberSequences.view" },
  { module: "audit", path: "/api/audit-logs", permission: "audit.view" },
  { module: "dashboard", path: "/api/dashboard/summary", permission: null },
  { module: "real-estate", path: "/api/projects", permission: "projects.view" },
  { module: "crm", path: "/api/leads", permission: "leads.view" },
  { module: "customers", path: "/api/customers", permission: "customers.view" },
  { module: "sales", path: "/api/contracts", permission: "contracts.view" },
  { module: "installments", path: "/api/installment-plans", permission: "installmentPlans.view" },
  { module: "unit-management", path: "/api/unit-price-lists", permission: "unitPriceLists.view" },
  { module: "finance", path: "/api/cashboxes", permission: "cashboxes.view" },
  { module: "cheques", path: "/api/cheques", permission: "cheques.view" },
  { module: "accounting", path: "/api/accounts", permission: "accounts.view" },
  { module: "ar-ap", path: "/api/tax-codes", permission: "taxCodes.view" },
  { module: "engineering", path: "/api/engineering-disciplines", permission: "engineeringDisciplines.view" },
  { module: "construction", path: "/api/contractors", permission: "contractors.view" },
  { module: "procurement", path: "/api/suppliers", permission: "suppliers.view" },
  { module: "inventory", path: "/api/warehouses", permission: "warehouses.view" },
  { module: "hr", path: "/api/departments", permission: "departments.view" },
  { module: "legal", path: "/api/legal-contracts", permission: "legalContracts.view" },
  { module: "bi", path: "/api/bi/executive-dashboard", permission: "bi.view" },
  { module: "ai", path: "/api/ai/conversations", permission: "ai.view" },
  { module: "land-bank", path: "/api/land-parcels", permission: "landParcels.view" },
  { module: "handover", path: "/api/handover-requests", permission: "handoverRequests.view" },
  { module: "customer-service", path: "/api/complaints", permission: "complaints.view" },
  { module: "fixed-assets", path: "/api/asset-categories", permission: "assetCategories.view" },
  { module: "general-admin", path: "/api/correspondence", permission: "correspondence.view" },
  { module: "insurance", path: "/api/employee-insurances", permission: "employeeInsurances.view" },
  { module: "master-data", path: "/api/lookup-types", permission: "masterData.view" },
  { module: "change-requests", path: "/api/change-requests", permission: "approvals.approve" },
  { module: "executive-oversight", path: "/api/executive-oversight/dashboard", permission: "executiveOversight.view" },
  { module: "documents", path: "/api/documents", permission: "documents.view" },
  { module: "form-templates", path: "/api/form-templates", permission: "formTemplates.view" },
  { module: "print-jobs", path: "/api/print-jobs", permission: "formTemplates.view" },
  { module: "notifications", path: "/api/notifications", permission: null },
  { module: "testing", path: "/api/testing/status", permission: null },
];

const RUN = randomUUID().slice(0, 8);
const tag = `modaccess-${RUN}`;

// Per-probe ids: a dedicated role + user so each probe user holds exactly one
// (or zero) permission and nothing leaks between probes.
const probeIds = PROBES.map((p) => ({
  ...p,
  roleId: randomUUID(),
  userId: randomUUID(),
}));

const allRoleIds = probeIds.map((p) => p.roleId);
const allUserIds = probeIds.map((p) => p.userId);

function authCookie(userId: string): string {
  return `${ACCESS_COOKIE}=${signAccessToken(userId)}`;
}

beforeAll(async () => {
  const passwordHash = await hashPassword("Test@123456");

  await db.insert(rolesTable).values(
    probeIds.map((p, i) => ({
      id: p.roleId,
      name: `${tag}-${p.module}-${i}`,
      permissions: p.permission ? [p.permission] : [],
    })),
  );

  await db.insert(usersTable).values(
    probeIds.map((p, i) => ({
      id: p.userId,
      username: `${tag}-${i}`,
      fullName: `Probe ${p.module}`,
      email: `${tag}-${i}@t.co`,
      passwordHash,
    })),
  );

  await db.insert(userRolesTable).values(
    probeIds.map((p) => ({ userId: p.userId, roleId: p.roleId })),
  );
});

afterAll(async () => {
  await db.delete(userRolesTable).where(inArray(userRolesTable.userId, allUserIds));
  await db.delete(usersTable).where(inArray(usersTable.id, allUserIds));
  await db.delete(rolesTable).where(inArray(rolesTable.id, allRoleIds));
  await pool.end();
});

describe("a basic (non-'*') role can reach every module it's allowed to", () => {
  it("requires authentication (no leak makes an unauthenticated request pass)", async () => {
    const res = await request(app).get("/api/companies");
    expect(res.status).toBe(401);
  });

  it.each(probeIds)(
    "$module: GET $path is never blocked by a sibling module's permission guard",
    async (p) => {
      const res = await request(app).get(p.path).set("Cookie", authCookie(p.userId));
      // A 403 here means some OTHER module's `router.use(requirePermission(...))`
      // leaked across the path-less mount and blocked this module.
      expect(res.status).not.toBe(403);
      // The probe user holds this endpoint's own permission (or it is auth-only),
      // so the request must succeed - 200, or 404 when the resource is absent.
      expect([200, 404]).toContain(res.status);
    },
  );
});

// Testing Mode is a super-admin-only capability. These probes assert that a
// non-"*" user can NEITHER enter/reset the demo sandbox NOR be elevated by
// merely presenting a forged testing cookie. The cookie alone must never grant
// the demo tenant or "*" — the middleware gates Testing Mode on the real
// production permission set, so the prior "any session in Testing Mode is
// elevated" bypass cannot be reintroduced.
describe("Testing Mode is super-admin only", () => {
  // Reuse a probe user that holds zero permissions (definitely not "*").
  const nonAdmin = probeIds.find((p) => p.module === "testing")!;

  it("status reports canTest:false for a non-super-admin", async () => {
    const res = await request(app)
      .get("/api/testing/status")
      .set("Cookie", authCookie(nonAdmin.userId));
    expect(res.status).toBe(200);
    expect(res.body.canTest).toBe(false);
    expect(res.body.testing).toBe(false);
  });

  it("rejects /testing/enter for a non-super-admin", async () => {
    const res = await request(app)
      .post("/api/testing/enter")
      .set("Cookie", authCookie(nonAdmin.userId));
    expect(res.status).toBe(403);
  });

  it("rejects /testing/reset for a non-super-admin", async () => {
    const res = await request(app)
      .post("/api/testing/reset")
      .set("Cookie", authCookie(nonAdmin.userId));
    expect(res.status).toBe(403);
  });

  it("a forged testing cookie cannot elevate or route a non-super-admin", async () => {
    const cookie = `${authCookie(nonAdmin.userId)}; ${TESTING_COOKIE}=1`;
    const status = await request(app).get("/api/testing/status").set("Cookie", cookie);
    expect(status.status).toBe(200);
    // Cookie present but user is not "*": neither routed to demo nor elevated.
    expect(status.body.testing).toBe(false);
    expect(status.body.canTest).toBe(false);
    const enter = await request(app).post("/api/testing/enter").set("Cookie", cookie);
    expect(enter.status).toBe(403);
    const reset = await request(app).post("/api/testing/reset").set("Cookie", cookie);
    expect(reset.status).toBe(403);
  });
});
