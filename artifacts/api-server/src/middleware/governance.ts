import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { db, changeRequestsTable } from "@workspace/db";
import { ACCESS_COOKIE, verifyAccessToken, OWNER_COOKIE, verifyOwnerToken } from "../lib/auth";
import { resolveRequestUser } from "./auth";
import { toChangeRequest } from "../lib/presenters";
import { recordAudit } from "../lib/audit";
import { notify, recipientsByPermission } from "../lib/notify";

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

// Paths (relative to /api) that are never governed. Notifications are a personal
// inbox: delete = move to trash (soft, restorable per-user), so it must not be
// parked as an approval change request.
const EXEMPT_PREFIXES = ["/change-requests", "/auth", "/portal", "/notifications"];

// Matches exactly "/<resource>/<id>" (no further segments).
const RESOURCE_ID = /^\/([a-z0-9-]+)\/([^/]+)$/;

function isExempt(path: string): boolean {
  return EXEMPT_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

/** Convert a kebab-case URL resource segment to the camelCase permission module. */
function toPermissionModule(segment: string): string {
  return segment.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
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

  // Resolve the requesting user. If we cannot, defer to the downstream
  // requireAuth (which will respond 401).
  //
  // One resolution per request, shared with the tenant decision and with
  // requireAuth: three separate lookups of the same user were three chances to
  // answer differently, and one query where there had been three.
  const user = await resolveRequestUser(req);
  if (!user) {
    next();
    return;
  }
  req.authUser = user;

  // Owner-in-Owner-Mode bypass: an owner-tier account ("*") with an active,
  // step-up-verified Owner Mode session deletes directly, skipping the approval
  // workflow entirely. This is deliberately narrow — it requires BOTH full
  // permissions AND a valid owner cookie bound to this same user — so ordinary
  // users, and even a super admin who is NOT currently in Owner Mode, still go
  // through governance. Scoped to DELETE only; protected edits stay governed.
  if (requestType === "delete" && user.permissions.includes("*")) {
    const ownerToken = req.cookies?.[OWNER_COOKIE];
    const ownerId = ownerToken ? verifyOwnerToken(ownerToken) : null;
    if (ownerId && ownerId === user.id) {
      next();
      return;
    }
  }

  // Authorize the REQUESTER before parking a change request. The governance
  // middleware runs ahead of the route's own requirePermission guard, so
  // without this a user could submit delete/edit requests for actions they are
  // not permitted to perform (and an approver could unknowingly execute them).
  // The required permission mirrors the route convention `${module}.${action}`.
  const action = method === "DELETE" ? "delete" : "update";
  const requiredPermission = `${toPermissionModule(entity)}.${action}`;
  if (!user.permissions.includes("*") && !user.permissions.includes(requiredPermission)) {
    res.status(403).json({ error: "You do not have permission to perform this action." });
    return;
  }

  const reasonHeader = req.headers["x-change-reason"];
  const labelHeader = req.headers["x-change-entity-label"];
  const reason = typeof reasonHeader === "string" ? reasonHeader.trim() : "";
  const entityLabel = typeof labelHeader === "string" ? labelHeader : null;

  // A justification is mandatory for every governed change request.
  if (!reason) {
    res.status(400).json({ error: "A reason is required to submit this request." });
    return;
  }

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

  // Notify the approvers (anyone who governs the queue) that a request is
  // waiting. Best-effort: a notification failure must not block parking the
  // request. Idempotent per (approvals, requestId, change_request_submitted).
  try {
    const approvers = await recipientsByPermission(db, "approvals.approve");
    await notify(db, {
      recipientUserIds: approvers.filter((id) => id !== user.id),
      companyId,
      actorUserId: user.id,
      category: "approvals",
      eventType: "change_request_submitted",
      priority: "high",
      title: "طلب موافقة جديد / New approval request",
      body: `${requestType} · ${entityLabel ?? entity}${reason ? ` · ${reason}` : ""}`,
      sourceModule: "approvals",
      sourceId: row.id,
      sourceRef: entityLabel ?? entity,
      link: "/approvals",
    });
  } catch (err) {
    req.log.error({ err }, "Failed to emit change-request-submitted notification");
  }

  res.status(202).json({ pendingApproval: true, requestId: row.id, request: toChangeRequest(row) });
}
