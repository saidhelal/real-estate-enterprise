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
