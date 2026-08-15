import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Testing Mode must write nothing to production.
 *
 * The sandbox routes every database access to an isolated `demo` schema, and
 * the routing was established inside `requireAuth` — which is mounted on each
 * router, i.e. *after* the governance middleware. Governance writes change
 * requests of its own, so it ran outside the context and parked every sandbox
 * deletion in `public`. Two hundred and fifty-six of them reached production
 * from sessions that believed they were isolated.
 *
 * The behaviour is verified live (a governed delete in the sandbox moves
 * `demo.change_requests` and leaves `public.change_requests` untouched). What
 * this file guards is the thing that made it possible: middleware order. A
 * mount that drifts back above `tenantContext` reintroduces the whole bug
 * silently, and no functional test of governance would notice, because
 * governance keeps working — it just works in the wrong schema.
 */

const APP = readFileSync(join(import.meta.dirname, "..", "src", "app.ts"), "utf8");
const AUTH = readFileSync(
  join(import.meta.dirname, "..", "src", "middleware", "auth.ts"),
  "utf8",
);

describe("the sandbox cannot write to production", () => {
  it("chooses the schema before governance can write", () => {
    const tenant = APP.indexOf("app.use(\"/api\", tenantContext)");
    const governance = APP.indexOf("app.use(\"/api\", governanceMiddleware)");

    expect(tenant, "tenantContext is not mounted at all").toBeGreaterThan(-1);
    expect(governance, "governanceMiddleware is not mounted").toBeGreaterThan(-1);
    expect(
      tenant,
      "governanceMiddleware is mounted before tenantContext, so a governed " +
        "delete inside Testing Mode writes its change request to production. " +
        "tenantContext must come first.",
    ).toBeLessThan(governance);
  });

  it("chooses the schema before the routers, not inside them", () => {
    const tenant = APP.indexOf("app.use(\"/api\", tenantContext)");
    const routers = APP.indexOf("app.use(\"/api\", router)");
    expect(tenant).toBeLessThan(routers);
  });

  it("still requires both the cookie and a real super admin", () => {
    // The fix moved *where* the decision is made. Loosening *what* it decides
    // would turn a stale cookie into a way of reaching the sandbox, so the two
    // conditions are asserted to still be joined.
    const decision = AUTH.slice(AUTH.indexOf("export async function tenantContext"));
    expect(decision).toMatch(/permissions\.includes\("\*"\)/);
    expect(decision).toMatch(/TESTING_COOKIE/);
    expect(decision).toMatch(/&&/);
  });

  it("resolves the caller once rather than three times", () => {
    // Governance, the tenant decision and requireAuth each used to look the
    // same user up. Three lookups are three chances to disagree about who is
    // calling — and the tenant decision is made from that answer.
    const governance = readFileSync(
      join(import.meta.dirname, "..", "src", "middleware", "governance.ts"),
      "utf8",
    );
    expect(governance).toContain("resolveRequestUser");
    expect(governance).not.toMatch(/loadAuthUser\s*\(/);
  });
});
