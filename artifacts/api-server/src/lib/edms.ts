import { and, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import {
  db,
  documentsTable,
  documentVersionsTable,
  notificationsTable,
} from "@workspace/db";
import type { AuthUser } from "./auth";
import { serializeRow } from "./serialize";

/* -------------------------------------------------------------------------- */
/* Electronic Document Management System (EDMS) — shared helpers              */
/* إدارة الأرشيف الإلكتروني وإدارة المستندات                                   */
/* -------------------------------------------------------------------------- */

export const MODULE = "documents";

type Row = Record<string, unknown>;

/**
 * Generate the next human document number for a company (DOC-000001). Counts
 * every row ever created for the company (including soft-deleted) so numbers
 * are never reused.
 */
export async function generateDocumentNumber(companyId: string): Promise<string> {
  const rows = (await db
    .select({ count: sql<number>`count(*)::int` })
    .from(documentsTable)
    .where(eq(documentsTable.companyId, companyId))) as { count: number }[];
  const next = (rows[0]?.count ?? 0) + 1;
  return `DOC-${String(next).padStart(6, "0")}`;
}

/**
 * Build the scoped-visibility predicate for a user over the documents table.
 * A user with "*" (super admin) or the explicit `documents.viewAll` grant sees
 * everything (returns undefined — no extra filter). Otherwise a user sees only:
 *   - public documents, OR
 *   - documents they own or created, OR
 *   - documents whose branch / department / project is in their scope grants.
 */
export function documentScopeFilter(user: AuthUser): SQL | undefined {
  if (user.permissions.includes("*") || user.permissions.includes("documents.viewAll")) {
    return undefined;
  }
  const conds: SQL[] = [eq(documentsTable.classification, "public")];
  if (user.id) {
    conds.push(eq(documentsTable.ownerUserId, user.id));
    conds.push(eq(documentsTable.createdByUserId, user.id));
  }
  const s = user.scopes;
  if (s.branchIds.length) conds.push(inArray(documentsTable.branchId, s.branchIds));
  if (s.departmentIds.length) conds.push(inArray(documentsTable.departmentId, s.departmentIds));
  if (s.projectIds.length) conds.push(inArray(documentsTable.projectId, s.projectIds));
  return or(...conds);
}

/** True when the user is allowed to see this already-loaded document. */
export function canSeeDocument(user: AuthUser, doc: Row): boolean {
  if (user.permissions.includes("*") || user.permissions.includes("documents.viewAll")) {
    return true;
  }
  if (doc.classification === "public") return true;
  if (user.id && (doc.ownerUserId === user.id || doc.createdByUserId === user.id)) return true;
  const s = user.scopes;
  if (doc.branchId && s.branchIds.includes(String(doc.branchId))) return true;
  if (doc.departmentId && s.departmentIds.includes(String(doc.departmentId))) return true;
  if (doc.projectId && s.projectIds.includes(String(doc.projectId))) return true;
  return false;
}

/**
 * Enrich a document row with the denormalized current-version fields and the
 * version count the API contract exposes (these are derived, not stored).
 */
export function presentDocument(doc: Row, versions: Row[]): Record<string, unknown> {
  const out = serializeRow(doc);
  const live = versions.filter((v) => !v.isDeleted);
  const current = live.find((v) => String(v.id) === String(doc.currentVersionId)) ?? null;
  out.currentVersionNumber = current ? Number(current.versionNumber) : null;
  out.currentFileObjectPath = current ? (current.fileObjectPath ?? null) : null;
  out.currentFileName = current ? (current.fileName ?? null) : null;
  out.currentFileFormat = current ? (current.fileFormat ?? null) : null;
  out.currentMimeType = current ? (current.mimeType ?? null) : null;
  out.currentFileSize =
    current && current.fileSize != null ? Number(current.fileSize) : null;
  out.versionCount = live.length;
  if (out.tags == null) out.tags = [];
  return out;
}

/** Serialize a version row, flagging the live one and coercing bigint size. */
export function presentVersion(v: Row, currentVersionId: unknown): Record<string, unknown> {
  const out = serializeRow(v);
  out.isCurrent = String(v.id) === String(currentVersionId);
  if (out.fileSize != null) out.fileSize = Number(out.fileSize);
  return out;
}

/** Load all (non-deleted) versions for a document, newest first. */
export async function loadVersions(documentId: string): Promise<Row[]> {
  return (await db
    .select()
    .from(documentVersionsTable)
    .where(
      and(
        eq(documentVersionsTable.documentId, documentId),
        eq(documentVersionsTable.isDeleted, false),
      ),
    )
    .orderBy(sql`${documentVersionsTable.versionNumber} desc`)) as Row[];
}

/**
 * Best-effort internal notification. Never throws (mirrors recordAudit): a
 * notification failure must not block the underlying document action. Skips
 * cleanly when there is no recipient.
 */
export async function notifyUser(input: {
  companyId?: string | null;
  recipientUserId?: string | null;
  actorUserId?: string | null;
  eventType: string;
  title: string;
  body?: string | null;
  sourceId?: string | null;
  sourceRef?: string | null;
  priority?: string;
}): Promise<boolean> {
  if (!input.recipientUserId) return false;
  try {
    await db.insert(notificationsTable).values({
      companyId: input.companyId ?? null,
      recipientUserId: input.recipientUserId,
      actorUserId: input.actorUserId ?? null,
      category: "general_admin",
      eventType: input.eventType,
      priority: input.priority ?? "normal",
      channel: "in_app",
      title: input.title,
      body: input.body ?? null,
      sourceModule: "documents",
      sourceId: input.sourceId ?? null,
      sourceRef: input.sourceRef ?? null,
      link: input.sourceId ? `/documents/${input.sourceId}` : null,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * On-demand expiry scan for a company. Flips past-due active/approved documents
 * to "expired" and emits an in-app notification to each affected owner for both
 * already-expired and near-expiry (within `nearDays`) documents.
 */
export async function scanDocumentExpiry(
  companyId: string,
  nearDays: number,
  actorUserId: string | null,
): Promise<{ scanned: number; expired: number; nearExpiry: number; notified: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const near = new Date(today);
  near.setDate(near.getDate() + Math.max(0, nearDays));

  const rows = (await db
    .select()
    .from(documentsTable)
    .where(
      and(
        eq(documentsTable.companyId, companyId),
        eq(documentsTable.isDeleted, false),
        sql`${documentsTable.expiryDate} is not null`,
        sql`${documentsTable.status} <> 'archived'`,
      ),
    )) as Row[];

  let expired = 0;
  let nearExpiry = 0;
  let notified = 0;

  for (const doc of rows) {
    const exp = doc.expiryDate ? new Date(`${String(doc.expiryDate)}T00:00:00`) : null;
    if (!exp || Number.isNaN(exp.getTime())) continue;
    const ref = String(doc.documentNumber ?? doc.name ?? "");
    if (exp.getTime() < today.getTime()) {
      expired += 1;
      if (doc.status !== "expired") {
        await db
          .update(documentsTable)
          .set({ status: "expired" })
          .where(eq(documentsTable.id, String(doc.id)));
      }
      const ok = await notifyUser({
        companyId,
        recipientUserId: (doc.ownerUserId as string) ?? (doc.createdByUserId as string) ?? null,
        actorUserId,
        eventType: "document_expired",
        title: `Document expired: ${ref}`,
        body: `${String(doc.name)} expired on ${String(doc.expiryDate)}.`,
        sourceId: String(doc.id),
        sourceRef: ref,
        priority: "high",
      });
      if (ok) notified += 1;
    } else if (exp.getTime() <= near.getTime()) {
      nearExpiry += 1;
      const ok = await notifyUser({
        companyId,
        recipientUserId: (doc.ownerUserId as string) ?? (doc.createdByUserId as string) ?? null,
        actorUserId,
        eventType: "document_near_expiry",
        title: `Document expiring soon: ${ref}`,
        body: `${String(doc.name)} expires on ${String(doc.expiryDate)}.`,
        sourceId: String(doc.id),
        sourceRef: ref,
        priority: "medium",
      });
      if (ok) notified += 1;
    }
  }

  return { scanned: rows.length, expired, nearExpiry, notified };
}
