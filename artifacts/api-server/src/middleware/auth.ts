import type { Request, Response, NextFunction } from "express";
import { ACCESS_COOKIE, verifyAccessToken, type AuthUser } from "../lib/auth";
import { loadAuthUser } from "../lib/access";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: AuthUser;
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

  const user = await loadAuthUser(userId);
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
  next();
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
