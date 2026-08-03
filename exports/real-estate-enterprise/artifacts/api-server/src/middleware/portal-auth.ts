import type { Request, Response, NextFunction } from "express";
import { and, eq } from "drizzle-orm";
import { db, customerUsersTable } from "@workspace/db";
import {
  PORTAL_ACCESS_COOKIE,
  verifyPortalAccessToken,
  type PortalAuthUser,
} from "../lib/portal-auth";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      portalUser?: PortalAuthUser;
    }
  }
}

/**
 * Resolve the portal access token from either the httpOnly cookie (web) or the
 * `Authorization: Bearer <token>` header (mobile / P18). Cookie wins if present.
 */
function extractToken(req: Request): string | null {
  const cookieToken = req.cookies?.[PORTAL_ACCESS_COOKIE];
  if (cookieToken) return cookieToken;
  const header = req.get("authorization");
  if (header && header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }
  return null;
}

/**
 * Require a valid portal access token. Loads the customer-user, enforces account
 * state, and attaches { id, customerId, companyId } to req.portalUser. Every
 * downstream query must scope to req.portalUser.customerId so a customer can
 * never read another customer's data.
 */
export async function requireCustomerAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const customerUserId = verifyPortalAccessToken(token);
  if (!customerUserId) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  const [user] = await db
    .select()
    .from(customerUsersTable)
    .where(
      and(
        eq(customerUsersTable.id, customerUserId),
        eq(customerUsersTable.isDeleted, false),
      ),
    );

  const lockedNow = !!user?.lockedUntil && user.lockedUntil.getTime() > Date.now();
  if (!user || !user.isActive || user.status !== "active" || lockedNow) {
    res.status(401).json({ error: "Account is not active." });
    return;
  }

  req.portalUser = {
    id: user.id,
    customerId: user.customerId,
    companyId: user.companyId,
  };
  next();
}
