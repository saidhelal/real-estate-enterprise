import type { Request } from "express";
import { db, auditLogsTable } from "@workspace/db";

interface AuditInput {
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}

function serialize(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    const json = JSON.stringify(value, (key, v) =>
      key === "passwordHash" || key === "password" ? undefined : v,
    );
    return json ?? null;
  } catch {
    return null;
  }
}

/**
 * The actor recorded for work with no human behind it. Scheduled sweeps must be
 * attributable, but attributing them to a real user would be a lie in the audit
 * trail — so they carry a reserved name and a null user id, which is already how
 * `recordAudit` represents an unauthenticated caller.
 */
export const SYSTEM_ACTOR = "system";

/**
 * Record an audit entry for an action with no HTTP request behind it — the
 * scheduler's task runs.
 *
 * Shares the table, the shape and the secret-stripping serializer with
 * `recordAudit`; the only difference is the absence of a request to read the
 * actor and logger from. Deliberately not a second audit engine.
 *
 * Best-effort, like its sibling: an audit failure must never fail the task it
 * was describing.
 */
export async function recordSystemAudit(input: AuditInput): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      userId: null,
      userName: SYSTEM_ACTOR,
      ipAddress: null,
      oldValue: serialize(input.oldValue),
      newValue: serialize(input.newValue),
    });
  } catch {
    // No request logger here. Swallowing is correct: the caller (the scheduler)
    // already records the run's own outcome to its state table and its logger.
  }
}

/**
 * Record an audit-trail entry for a mutating action. Best-effort: failures are
 * logged but never block the request.
 */
export async function recordAudit(req: Request, input: AuditInput): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      userId: req.authUser?.id ?? null,
      userName: req.authUser?.username ?? "system",
      ipAddress: req.ip ?? null,
      oldValue: serialize(input.oldValue),
      newValue: serialize(input.newValue),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to record audit log");
  }
}
