import type { Request, Response, NextFunction } from "express";
import {
  ACCESS_COOKIE,
  TESTING_COOKIE,
  OWNER_COOKIE,
  verifyAccessToken,
  verifyOwnerToken,
  type AuthUser,
} from "../lib/auth";
import { loadAuthUser } from "../lib/access";
import { runWithTenant } from "@workspace/db";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: AuthUser;
      /** True when this request is served from the isolated demo sandbox. */
      testingMode?: boolean;
      /**
       * The caller as production knows them, resolved once per request.
       * `null` means the cookie was missing or invalid — distinct from
       * `undefined`, which means nobody has looked yet.
       */
      resolvedUser?: AuthUser | null;
    }
  }
}

/**
 * Who is calling, according to production, resolved at most once per request.
 *
 * Three places need this — the tenant decision, governance, and requireAuth —
 * and each used to look it up for itself, so a governed DELETE cost three
 * identical queries and, worse, three chances to answer differently.
 *
 * Identity always lives in production, never in the sandbox: the lookup is
 * pinned there so a request already routed to `demo` still authenticates
 * against the real user table.
 */
export async function resolveRequestUser(req: Request): Promise<AuthUser | null> {
  if (req.resolvedUser !== undefined) return req.resolvedUser;

  const token = req.cookies?.[ACCESS_COOKIE];
  const userId = token ? verifyAccessToken(token) : null;
  const user = userId ? await runWithTenant("production", () => loadAuthUser(userId)) : null;
  req.resolvedUser = user;
  return user;
}

/**
 * Choose the schema this request writes to, before anything writes.
 *
 * Testing Mode routes every database access to an isolated `demo` schema. That
 * routing was established inside `requireAuth`, which is mounted per-router —
 * so the governance middleware, which runs *ahead* of the routers, was outside
 * the context and parked its change requests in `public`. A sandbox that
 * writes real rows is not a sandbox: 256 change requests reached production
 * from sessions that believed they were isolated.
 *
 * Mounted once, before governance, so everything downstream inherits one
 * decision. The rule itself is unchanged — both the testing cookie and a real
 * super-admin production identity are still required, which is what keeps this
 * from being a way to get elevated permissions.
 */
export async function tenantContext(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const user = await resolveRequestUser(req);
  const testing = !!user?.permissions.includes("*") && req.cookies?.[TESTING_COOKIE] === "1";
  req.testingMode = testing;

  if (testing) runWithTenant("demo", () => next());
  else next();
}

/**
 * Require a valid access-token cookie. Attaches the resolved user (with roles
 * and permissions) to req.authUser, or responds 401.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const userId = verifyAccessToken(token);
  if (!userId) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  // Identity always lives in production; `resolveRequestUser` pins the lookup
  // there. Several ERP sub-routers each apply their own router-level
  // requireAuth and are mounted without a path prefix, so by the time this runs
  // the request may already be inside the demo tenant — without the pin,
  // the lookup would query demo.users for a production user id and 401.
  const user = await resolveRequestUser(req);
  if (!user) {
    res.status(401).json({ error: "User no longer exists" });
    return;
  }

  // Enforce forced-password-change server-side: a flagged user may only reach
  // the endpoints needed to view their identity, change the password, or log
  // out. Everything else is blocked until the flag clears — the client-side
  // redirect is convenience, this is the real control. `/auth/login` and
  // `/auth/refresh` do not pass through requireAuth, so they are unaffected.
  if (user.mustChangePassword) {
    const allowed = ["/auth/me", "/auth/change-password", "/auth/logout"];
    if (!allowed.some((p) => req.path.endsWith(p))) {
      res.status(403).json({
        error: "Password change required",
        mustChangePassword: true,
      });
      return;
    }
  }

  // Which schema this request writes to was decided by `tenantContext`, before
  // governance ran. Deciding it again here would be a second answer to the same
  // question — and it was the *absence* of a decision upstream that let the
  // sandbox write change requests into production.
  //
  // `testingMode` is only undefined if `tenantContext` was not mounted, which
  // no path through this app allows; the same rule is applied as a fallback so
  // a future mount order cannot silently drop the sandbox routing.
  const testing =
    req.testingMode ??
    (user.permissions.includes("*") && req.cookies?.[TESTING_COOKIE] === "1");
  req.testingMode = testing;

  if (testing) {
    // Inside the isolated demo sandbox the session is given full super-admin
    // permissions so every module can be exercised end-to-end. Because only a
    // real super admin can ever reach this branch, this is not a privilege
    // escalation — it is a request-scoped value on the in-memory user only.
    // Production role records and stored permissions are never modified, and
    // every db access in downstream handlers resolves to the demo schema.
    req.authUser = { ...user, permissions: ["*"] };
    // The context is already `demo` when tenantContext ran; re-entering it is a
    // no-op that also covers the fallback path above.
    runWithTenant("demo", () => next());
  } else {
    req.authUser = user;
    next();
  }
}

/**
 * Does this user hold at least one of these permissions?
 *
 * The same question `requirePermission` asks, exposed for the handlers that
 * cannot ask it as middleware — when which permission applies depends on the
 * request body, middleware runs too early to know. One answer either way:
 * `requirePermission` is this function plus a response.
 */
export function hasPermission(
  user: Request["authUser"],
  ...required: string[]
): boolean {
  if (!user) return false;
  if (user.permissions.includes("*")) return true;
  return required.some((perm) => user.permissions.includes(perm));
}

/**
 * Require that the authenticated user holds at least one of the given
 * permissions. A user whose permission set contains "*" (super admin) passes
 * any check. Must be mounted after requireAuth. Responds 403 when the user is
 * authenticated but lacks the permission, or 401 when not authenticated.
 */
export function requirePermission(...required: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.authUser;
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!hasPermission(user, ...required)) {
      res.status(403).json({ error: "You do not have permission to perform this action." });
      return;
    }
    next();
  };
}

/**
 * Require an active, step-up-verified Owner Mode session: a valid owner cookie
 * whose subject matches the authenticated user, who must also hold full ("*")
 * permissions. The owner cookie is only ever issued by /auth/owner-mode/verify
 * to an owner-tier account, so this gates owner-exclusive actions without a
 * second password prompt. Must be mounted after requireAuth. Responds 401 when
 * unauthenticated, 403 when Owner Mode is not active.
 */
export function requireOwnerMode(req: Request, res: Response, next: NextFunction): void {
  const user = req.authUser;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const token = req.cookies?.[OWNER_COOKIE];
  const ownerId = token ? verifyOwnerToken(token) : null;
  if (!ownerId || ownerId !== user.id || !user.permissions.includes("*")) {
    res.status(403).json({ error: "Owner Mode is required for this action." });
    return;
  }
  next();
}
