import { and, arrayOverlaps, eq, inArray, isNull, ne, or } from "drizzle-orm";
import {
  db,
  notificationsTable,
  usersTable,
  rolesTable,
  userRolesTable,
  userScopesTable,
} from "@workspace/db";
import type { Tx } from "./posting";

// Shared notification emitter. Other ERP routes call `notify(...)` to drop a
// row into the Notification Center for the right recipient(s) as a side-effect
// of a business event (a new contract, an overdue installment, a pending
// approval, an escalation, ...). Pass the originating transaction (`tx`) so the
// notification is committed atomically with the event; pass `db` for events that
// run outside a transaction (e.g. the governance middleware).
//
// Idempotency: callers identify an event by (sourceModule, sourceId, eventType)
// and a set of recipients. `notify` only inserts rows for recipients that do not
// already have that exact notification, so retries, double-dispatches, or
// repeated scans never duplicate. (Each recipient gets at most one row per
// event.)

/** Either the base db handle or an open transaction — both expose the query API we use. */
export type Executor = typeof db | Tx;

export interface NotifyInput {
  /** Inbox owners to notify. De-duplicated; empty/blank ids are ignored. */
  recipientUserIds: Array<string | null | undefined>;
  companyId?: string | null;
  /** The user who triggered the underlying event, when known. */
  actorUserId?: string | null;
  departmentId?: string | null;
  /** High-level source group, e.g. contracts/installments/approvals/customer_service. */
  category: string;
  /** The specific event, e.g. contract_created, installment_overdue. */
  eventType: string;
  /** normal | medium | high | urgent. */
  priority?: string;
  /** in_app | email | sms | whatsapp | push. */
  channel?: string;
  title: string;
  body?: string | null;
  /** Human-readable source module name for display. */
  sourceModule?: string | null;
  /** The linked record id + a human reference/number. */
  sourceId?: string | null;
  sourceRef?: string | null;
  /** Direct in-app link that opens the related record. */
  link?: string | null;
}

/** Predicate selecting active, non-deleted, non-locked users (so we never notify dead accounts). */
function liveUser() {
  return and(
    eq(usersTable.isDeleted, false),
    eq(usersTable.isActive, true),
    ne(usersTable.status, "inactive"),
  );
}

/**
 * Resolve recipients by permission: every live user holding `permission`
 * (directly, or via the "*" wildcard) through one of their roles. Useful for
 * role-based audiences such as approvers (`approvals.approve`) or the
 * collections team (`installmentCollections.create`).
 */
export async function recipientsByPermission(
  exec: Executor,
  permission: string,
  opts: { companyId?: string | null } = {},
): Promise<string[]> {
  const filters = [
    liveUser()!,
    eq(rolesTable.isDeleted, false),
    arrayOverlaps(rolesTable.permissions, [permission, "*"]),
  ];
  // Company scope: a company-scoped user only receives notifications for their
  // own company, but a global (null-company) admin is unscoped and still
  // receives them. This prevents cross-company leakage between scoped users
  // while keeping super/global admins in the loop.
  if (opts.companyId) {
    filters.push(
      or(eq(usersTable.companyId, opts.companyId), isNull(usersTable.companyId))!,
    );
  }
  const rows = await exec
    .select({ id: usersTable.id })
    .from(usersTable)
    .innerJoin(userRolesTable, eq(userRolesTable.userId, usersTable.id))
    .innerJoin(rolesTable, eq(rolesTable.id, userRolesTable.roleId))
    .where(and(...filters));
  return [...new Set(rows.map((r) => r.id))];
}

/**
 * Resolve recipients by department: every live user whose scope grants include
 * the given department (mirrors the inbox department-scope model).
 */
export async function recipientsByDepartment(
  exec: Executor,
  departmentId: string,
): Promise<string[]> {
  const rows = await exec
    .select({ id: usersTable.id })
    .from(usersTable)
    .innerJoin(userScopesTable, eq(userScopesTable.userId, usersTable.id))
    .where(
      and(
        liveUser()!,
        eq(userScopesTable.scopeType, "department"),
        eq(userScopesTable.scopeId, departmentId),
      ),
    );
  return [...new Set(rows.map((r) => r.id))];
}

/**
 * Create notifications for the given event, idempotently per
 * (recipientUserId, sourceModule, sourceId, eventType). Returns the number of
 * rows actually inserted (0 when everything already existed or there were no
 * recipients).
 */
export async function notify(exec: Executor, input: NotifyInput): Promise<number> {
  const recipients = [
    ...new Set(
      input.recipientUserIds.filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      ),
    ),
  ];
  if (recipients.length === 0) return 0;

  // Skip recipients who already have this exact notification. Idempotency only
  // applies when the event has a stable identity (sourceModule + sourceId).
  let already: Set<string> = new Set();
  if (input.sourceModule && input.sourceId) {
    const existing = await exec
      .select({ id: notificationsTable.recipientUserId })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.sourceModule, input.sourceModule),
          eq(notificationsTable.sourceId, input.sourceId),
          eq(notificationsTable.eventType, input.eventType),
          inArray(notificationsTable.recipientUserId, recipients),
        ),
      );
    already = new Set(existing.map((r) => r.id));
  }

  const toInsert = recipients.filter((id) => !already.has(id));
  if (toInsert.length === 0) return 0;

  await exec.insert(notificationsTable).values(
    toInsert.map((recipientUserId) => ({
      recipientUserId,
      companyId: input.companyId ?? null,
      actorUserId: input.actorUserId ?? null,
      departmentId: input.departmentId ?? null,
      category: input.category,
      eventType: input.eventType,
      priority: input.priority ?? "normal",
      channel: input.channel ?? "in_app",
      title: input.title,
      body: input.body ?? null,
      sourceModule: input.sourceModule ?? null,
      sourceId: input.sourceId ?? null,
      sourceRef: input.sourceRef ?? null,
      link: input.link ?? null,
    })),
  );
  return toInsert.length;
}
