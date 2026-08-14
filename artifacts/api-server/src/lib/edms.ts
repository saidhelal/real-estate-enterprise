import { and, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import {
  db,
  documentsTable,
  documentVersionsTable,
  documentObjectOwnersTable,
} from "@workspace/db";
import type { AuthUser } from "./auth";
import { notify } from "./notify";
import { nextNumber } from "./doc-number";
import { serializeRow } from "./serialize";

/** A Drizzle transaction handle (or the base db) for owner-claim writes. */
type DbLike = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

export type ObjectClaimResult =
  | { ok: true }
  | { ok: false; reason: "missing" | "forbidden" | "bound" };

/**
 * Bind a server-minted object path to a document immutably. The owner row is
 * created at upload-presign time with `documentId = null` and the minting
 * user's id. Claiming enforces that the path:
 *   - exists and is not soft-deleted,
 *   - was minted by the same actor (no hijacking another user's upload),
 *   - is unbound OR already bound to THIS document (idempotent retry only) —
 *     never re-pointed from one document to another.
 * The row is locked FOR UPDATE so concurrent claims cannot race. On success it
 * sets documentId/companyId/purpose; on failure nothing is written.
 */
export async function claimObjectOwnership(
  tx: DbLike,
  opts: {
    objectPath: string;
    documentId: string;
    companyId: string | null;
    purpose: "version" | "signature" | "stamp";
    actorId: string | null;
  },
): Promise<ObjectClaimResult> {
  const [row] = (await tx
    .select()
    .from(documentObjectOwnersTable)
    .where(eq(documentObjectOwnersTable.objectPath, opts.objectPath))
    .for("update")
    .limit(1)) as Row[];
  if (!row || row.isDeleted) return { ok: false, reason: "missing" };
  if (row.uploadedByUserId && String(row.uploadedByUserId) !== opts.actorId) {
    return { ok: false, reason: "forbidden" };
  }
  if (row.documentId && String(row.documentId) !== opts.documentId) {
    return { ok: false, reason: "bound" };
  }
  await tx
    .update(documentObjectOwnersTable)
    .set({
      documentId: opts.documentId,
      companyId: opts.companyId,
      purpose: opts.purpose,
    })
    .where(eq(documentObjectOwnersTable.id, String(row.id)));
  return { ok: true };
}

/**
 * Thrown inside a transaction when an object-ownership claim fails, so the tx
 * rolls back. Carries the HTTP status + message the route should respond with.
 */
export class ObjectClaimError extends Error {
  status: number;
  constructor(reason: "missing" | "forbidden" | "bound") {
    let status = 403;
    let message = "You did not upload this file.";
    if (reason === "missing") {
      status = 400;
      message = "Unknown or expired upload reference.";
    } else if (reason === "bound") {
      status = 409;
      message = "This file is already attached to another document.";
    }
    super(message);
    this.name = "ObjectClaimError";
    this.status = status;
  }
}

/* -------------------------------------------------------------------------- */
/* Electronic Document Management System (EDMS) — shared helpers              */
/* إدارة الأرشيف الإلكتروني وإدارة المستندات                                   */
/* -------------------------------------------------------------------------- */

export const MODULE = "documents";

type Row = Record<string, unknown>;

/**
 * The next document number for a company, from the one central engine.
 *
 * It used to be `count(*) + 1` over the documents table. That is not a
 * sequence: two uploads a moment apart both counted the same total and both
 * became `DOC-000001`, and nothing in the schema was watching — the column is
 * `notNull` but not unique, so the duplicate would simply be stored. Counting
 * also made the number a function of how many rows exist, so a hard delete
 * would hand a live document's number to the next one created.
 *
 * The engine gives a real counter: advisory-locked, scoped per company,
 * transaction-safe, and never reissuing a value.
 */
export async function generateDocumentNumber(companyId: string): Promise<string> {
  return (await nextNumber("document", companyId)).value;
}

/**
 * Build the scoped-visibility predicate for a user over the documents table.
 * A user with "*" (super admin) or the explicit `documents.viewAll` grant sees
 * everything (returns undefined — no extra filter). Otherwise a user sees only:
 *   - public documents WITHIN THEIR OWN COMPANY, OR
 *   - documents they own or created, OR
 *   - documents whose branch / department / project is in their scope grants.
 *
 * `public` is a sensitivity level ("visible to all employees"), NOT a
 * cross-tenant flag: it is always bounded to the user's company so a scoped
 * user can never enumerate another company's public documents — even when the
 * caller omits the optional companyId list filter. Branch/department/project
 * grants are inherently company-specific, so they need no extra company bound.
 */
export function documentScopeFilter(user: AuthUser): SQL | undefined {
  if (user.permissions.includes("*") || user.permissions.includes("documents.viewAll")) {
    return undefined;
  }
  const conds: SQL[] = [];
  if (user.companyId) {
    conds.push(
      and(
        eq(documentsTable.classification, "public"),
        eq(documentsTable.companyId, user.companyId),
      ) as SQL,
    );
  }
  if (user.id) {
    conds.push(eq(documentsTable.ownerUserId, user.id));
    conds.push(eq(documentsTable.createdByUserId, user.id));
  }
  const s = user.scopes;
  if (s.branchIds.length) conds.push(inArray(documentsTable.branchId, s.branchIds));
  if (s.departmentIds.length) conds.push(inArray(documentsTable.departmentId, s.departmentIds));
  if (s.projectIds.length) conds.push(inArray(documentsTable.projectId, s.projectIds));
  // No visibility grants at all → match nothing (a false predicate).
  if (conds.length === 0) return sql`false`;
  return or(...conds);
}

/**
 * True when the user may run privileged company-wide operations (e.g. the
 * expiry scan, which mutates document status + emits notifications) against
 * `companyId`. A `*` / `documents.viewAll` holder may target any company;
 * everyone else is bound to their own company so a scoped user cannot trigger
 * cross-company status mutations.
 */
export function canOperateOnCompany(user: AuthUser, companyId: string): boolean {
  if (user.permissions.includes("*") || user.permissions.includes("documents.viewAll")) {
    return true;
  }
  return !!user.companyId && user.companyId === companyId;
}

/** True when the user is allowed to see this already-loaded document. */
export function canSeeDocument(user: AuthUser, doc: Row): boolean {
  if (user.permissions.includes("*") || user.permissions.includes("documents.viewAll")) {
    return true;
  }
  // `public` only grants visibility within the user's own company (see above).
  if (
    doc.classification === "public" &&
    user.companyId &&
    String(doc.companyId) === user.companyId
  ) {
    return true;
  }
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
 * Notify one person about a document.
 *
 * A convenience shape over the notification engine — one recipient, the
 * document module's category and link filled in — not a second implementation.
 * It used to insert into `notifications` itself, which meant it missed the one
 * thing the engine guarantees: idempotency per
 * (recipient, sourceModule, sourceId, eventType). The expiry scan below runs
 * on demand and can run twice in a day, so every re-run added a second copy of
 * the same warning to the same inbox.
 *
 * It also filed everything under `general_admin`, so document notifications
 * were uncategorised wherever the inbox groups by category.
 *
 * Best-effort is preserved: a notification failure must never block the
 * document action that triggered it.
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
    const created = await notify(db, {
      recipientUserIds: [input.recipientUserId],
      companyId: input.companyId ?? null,
      actorUserId: input.actorUserId ?? null,
      category: "documents",
      eventType: input.eventType,
      priority: input.priority ?? "normal",
      title: input.title,
      body: input.body ?? null,
      sourceModule: "documents",
      sourceId: input.sourceId ?? null,
      sourceRef: input.sourceRef ?? null,
      link: input.sourceId ? `/documents/${input.sourceId}` : null,
    });
    return created > 0;
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
