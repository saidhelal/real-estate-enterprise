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
    }
  }
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

  // Identity always lives in production. Force the lookup onto the production
  // tenant: several ERP sub-routers each apply their own router-level requireAuth
  // and are mounted without a path prefix, so an earlier sibling router may have
  // already wrapped this request's continuation in the demo tenant. Without this
  // pin, loadAuthUser would query demo.users for a production user id and 401.
  const user = await runWithTenant("production", () => loadAuthUser(userId));
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

  // Tenant routing: auth itself ran on production (loadAuthUser above). From here
  // on, if the browser is in Testing Mode every db access in the downstream
  // handlers resolves to the isolated demo schema. The selection is captured in
  // AsyncLocalStorage for the rest of the request. A request is in Testing Mode
  // purely by the presence of the testing cookie (set only via /testing/enter);
  // this is safe because the demo schema is a fully isolated sandbox that can
  // never reach production data, and the default/no-cookie path stays on
  // production.
  const testing = req.cookies?.[TESTING_COOKIE] === "1";
  req.testingMode = testing;

  if (testing) {
    // Demo permission elevation: while operating inside the isolated demo sandbox
    // the session is granted full super-admin permissions across every module
    // (and AI/BI), so any account — including a non-super-admin demo user — can
    // exercise the entire product end-to-end. This is a request-scoped override
    // of the in-memory user only: production role records and the user's stored
    // permissions are never modified, and the elevation applies exclusively to
    // these demo-routed requests. Outside Testing Mode the user keeps exactly
    // their production permissions.
    req.authUser = { ...user, permissions: ["*"] };
    runWithTenant("demo", () => next());
  } else {
    req.authUser = user;
    next();
  }
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
    if (user.permissions.includes("*")) {
      next();
      return;
    }
    const allowed = required.some((perm) => user.permissions.includes(perm));
    if (!allowed) {
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
