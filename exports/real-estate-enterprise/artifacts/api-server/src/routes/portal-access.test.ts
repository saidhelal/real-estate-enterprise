import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { inArray } from "drizzle-orm";
import {
  db,
  pool,
  customersTable,
  customerUsersTable,
  customerUploadsTable,
} from "@workspace/db";
import app from "../app";
import {
  PORTAL_ACCESS_COOKIE,
  signPortalAccessToken,
  hashPassword,
} from "../lib/portal-auth";

// Portal reachability boundary test ("can a logged-in customer still reach every
// portal surface?").
//
// The portal router (routes/portal.ts) manages its own auth (public endpoints +
// requireCustomerAuth) and is mounted in routes/index.ts BEFORE the ERP routers.
// Each ERP router applies a router-level `requireAuth` that, because every router
// is mounted path-less (`router.use(xxxRouter)`), runs for EVERY request flowing
// through it - so if the portal router were mounted AFTER an ERP router, or a new
// global guard were added above it, /portal/* traffic would be intercepted and a
// logged-in customer would get a stray 401 (ERP requireAuth) or 403 (ERP
// requirePermission) instead of their data.
//
// The ERP guards key off a DIFFERENT cookie (`erp_access`) and the ERP JWT
// audience, so they can never accept a portal token. That makes a valid portal
// token the perfect discriminator: if the request actually reaches the portal
// router it returns 200 (or 404 when the row is absent); if an ERP guard
// intercepts it first we get 401/403. We therefore probe a representative GET
// from each portal surface as an authenticated customer and assert the response
// is never blocked by an ERP guard.

const RUN = randomUUID().slice(0, 8);
const tag = `portal-access-${RUN}`;

const companyId = randomUUID();
const customerId = randomUUID();
const customerUserId = randomUUID();

// An upload owned by this customer so the file-serving surface passes its own
// ownership check and we exercise the route body (object storage may then 404/500
// depending on bucket config - either way it is not an ERP-guard 401/403).
const ownedObjectPath = `/objects/${tag}/sample.bin`;

// One representative authenticated GET per portal read surface. Each is scoped to
// the caller's customerId, so with no fixture rows the list endpoints return an
// empty 200 and the single-resource lookups return 404 - never 401/403.
const PROBES: { surface: string; path: string }[] = [
  { surface: "me", path: "/api/portal/me" },
  { surface: "dashboard", path: "/api/portal/dashboard" },
  { surface: "units", path: "/api/portal/units" },
  { surface: "contracts", path: "/api/portal/contracts" },
  { surface: "installments", path: "/api/portal/installments" },
  { surface: "collections", path: "/api/portal/collections" },
  { surface: "documents", path: "/api/portal/documents" },
  { surface: "maintenance-requests", path: "/api/portal/maintenance-requests" },
  { surface: "complaints", path: "/api/portal/complaints" },
  { surface: "notifications", path: "/api/portal/notifications" },
  { surface: "support-tickets", path: "/api/portal/support-tickets" },
  // Single-resource lookup with an id that does not exist -> a healthy portal
  // returns 404 (not an ERP-guard 401/403).
  { surface: "support-ticket-detail", path: `/api/portal/support-tickets/${randomUUID()}` },
];

function authCookie(): string {
  return `${PORTAL_ACCESS_COOKIE}=${signPortalAccessToken(customerUserId)}`;
}

beforeAll(async () => {
  const passwordHash = await hashPassword("Test@123456");

  await db.insert(customersTable).values({
    id: customerId,
    companyId,
    code: `${tag}-C`,
    fullName: "Portal Access Probe",
  });

  await db.insert(customerUsersTable).values({
    id: customerUserId,
    companyId,
    customerId,
    username: `${tag}-user`,
    email: `${tag}@t.co`,
    passwordHash,
    status: "active",
    isActive: true,
  });

  await db.insert(customerUploadsTable).values({
    companyId,
    customerId,
    customerUserId,
    objectPath: ownedObjectPath,
    fileName: "sample.bin",
  });
});

afterAll(async () => {
  await db
    .delete(customerUploadsTable)
    .where(inArray(customerUploadsTable.customerId, [customerId]));
  await db
    .delete(customerUsersTable)
    .where(inArray(customerUsersTable.id, [customerUserId]));
  await db.delete(customersTable).where(inArray(customersTable.id, [customerId]));
  await pool.end();
});

describe("a logged-in customer can reach every portal surface", () => {
  it("requires customer auth (an unauthenticated portal request is rejected)", async () => {
    const res = await request(app).get("/api/portal/dashboard");
    expect(res.status).toBe(401);
  });

  it("an ERP token can never satisfy portal auth (audience/cookie isolation)", async () => {
    // The ERP access cookie name is different, so it is simply ignored by the
    // portal middleware -> 401, never a leaked 200.
    const res = await request(app)
      .get("/api/portal/dashboard")
      .set("Cookie", `erp_access=${signPortalAccessToken(customerUserId)}`);
    expect(res.status).toBe(401);
  });

  it.each(PROBES)(
    "$surface: GET $path is never intercepted by an ERP guard",
    async ({ path }) => {
      const res = await request(app).get(path).set("Cookie", authCookie());
      // A 401 here would mean an ERP `requireAuth` intercepted the request before
      // the portal router; a 403 would mean an ERP `requirePermission` did. Either
      // means mount order or a new global guard broke portal access.
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(403);
      // With a valid portal token the request reaches the portal handler: list
      // surfaces return 200 (empty), the single-resource lookup returns 404.
      expect([200, 404]).toContain(res.status);
    },
  );

  it("file-serving surface reaches the portal handler (not an ERP guard)", async () => {
    // Ownership passes (we seeded the upload), so the route runs its own body.
    // Object storage may then succeed, 404, or 500 depending on bucket config -
    // none of which is an ERP-guard 401/403.
    const res = await request(app)
      .get(`/api/portal/files/${tag}/sample.bin`)
      .set("Cookie", authCookie());
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});
