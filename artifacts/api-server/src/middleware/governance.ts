import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { db, changeRequestsTable } from "@workspace/db";
import { ACCESS_COOKIE, verifyAccessToken } from "../lib/auth";
import { loadAuthUser } from "../lib/access";
import { toChangeRequest } from "../lib/presenters";
import { recordAudit } from "../lib/audit";

/**
 * Boot-generated secret. The change-request approval flow re-dispatches the
 * original HTTP call internally with this header so the governance middleware
 * lets it through and the real route handler executes. Clients cannot forge it
 * because it never leaves the server process.
 */
const EXECUTE_SECRET = crypto.randomUUID();
export const EXECUTE_HEADER = "x-governance-execute";

/** Headers an internal re-dispatch must send to bypass governance. */
export function internalExecuteHeaders(): Record<string, string> {
  return { [EXECUTE_HEADER]: EXECUTE_SECRET };
}

// Resource segments whose direct EDIT (PATCH /<seg>/:id) is forbidden and must
// go through an approved edit request. Direct DELETE is forbidden for ALL
// resources; this list only adds edit-governance for protected financial data.
const PROTECTED_EDIT = new Set([
  "contracts",
  "installment-plans",
  "installment-schedules",
  "installment-collections",
  "receipts",
  "journal-entries",
  "customer-invoices",
  "supplier-invoices",
  "payment-vouchers",
  "cheques",
]);

// Paths (relative to /api) that are never governed.
const EXEMPT_PREFIXES = ["/change-requests", "/auth", "/portal"];

// Matches exactly "/<resource>/<id>" (no further segments).
const RESOURCE_ID = /^\/([a-z0-9-]+)\/([^/]+)$/;

function isExempt(path: string): boolean {
  return EXEMPT_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

/**
 * Governs destructive/protected writes. Mounted under /api BEFORE the routers.
 * A direct DELETE on any resource, or a direct PATCH on a protected financial
 * resource, is converted into a pending change request (HTTP 202) instead of
 * executing. Internal re-dispatches (carrying the execute secret) pass through.
 */
export async function governanceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Internal execution re-dispatch: let it through untouched.
  if (req.headers[EXECUTE_HEADER] === EXECUTE_SECRET) {
    next();
    return;
  }

  const method = req.method;
  if (method !== "DELETE" && method !== "PATCH") {
    next();
    return;
  }

  const path = req.path; // relative to /api mount
  if (isExempt(path)) {
    next();
    return;
  }

  const match = RESOURCE_ID.exec(path);
  if (!match) {
    next();
    return;
  }
  const [, entity, entityId] = match;

  const requestType = method === "DELETE" ? "delete" : "edit";
  if (requestType === "edit" && !PROTECTED_EDIT.has(entity)) {
    // Editing a non-protected resource is allowed directly.
    next();
    return;
  }

  // Resolve the requesting user from the access-token cookie. If we cannot,
  // defer to the downstream requireAuth (which will respond 401).
  const token = req.cookies?.[ACCESS_COOKIE];
  const userId = token ? verifyAccessToken(token) : null;
  const user = userId ? await loadAuthUser(userId) : null;
  if (!user) {
    next();
    return;
  }
  req.authUser = user;

  const reasonHeader = req.headers["x-change-reason"];
  const labelHeader = req.headers["x-change-entity-label"];
  const reason = typeof reasonHeader === "string" ? reasonHeader : "";
  const entityLabel = typeof labelHeader === "string" ? labelHeader : null;
  const fullPath = req.originalUrl.split("?")[0];

  const companyId =
    req.body && typeof req.body === "object" && typeof req.body.companyId === "string"
      ? (req.body.companyId as string)
      : null;

  const [row] = await db
    .insert(changeRequestsTable)
    .values({
      companyId,
      requestType,
      entity,
      entityId,
      entityLabel,
      method,
      path: fullPath,
      payload: requestType === "edit" ? (req.body ?? null) : null,
      reason,
      requestedBy: user.id,
      requestedByName: user.fullName,
    })
    .returning();

  await recordAudit(req, {
    action: requestType === "delete" ? "delete-request" : "edit-request",
    entity,
    entityId,
    newValue: { reason, requestId: row.id },
  });

  res.status(202).json({ pendingApproval: true, requestId: row.id, request: toChangeRequest(row) });
}
