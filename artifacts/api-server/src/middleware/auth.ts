import type { Request, Response, NextFunction } from "express";
import { ACCESS_COOKIE, TESTING_COOKIE, verifyAccessToken, type AuthUser } from "../lib/auth";
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

/** A user holding "*" is a super admin — the only role allowed into Testing Mode. */
function isSuperAdmin(user: AuthUser): boolean {
  return user.permissions.includes("*");
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

  req.authUser = user;

  // Tenant routing: auth itself ran on production (loadAuthUser above). From here
  // on, if the browser is in Testing Mode AND the user is a super admin, every
  // db access in the downstream handlers resolves to the isolated demo schema.
  // The selection is captured in AsyncLocalStorage for the rest of the request;
  // any non-super-admin (even with a forged cookie) stays on production.
  const testing = req.cookies?.[TESTING_COOKIE] === "1" && isSuperAdmin(user);
  req.testingMode = testing;
  if (testing) {
    runWithTenant("demo", () => next());
  } else {
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
