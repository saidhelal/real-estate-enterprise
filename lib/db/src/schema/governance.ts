import { pgTable, uuid, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

/**
 * Change requests are the backbone of the governance model: NO record may be
 * deleted directly, and protected financial records (contracts, installments,
 * collections, journal entries, receipt/payment vouchers, invoices, cheques)
 * may not be edited directly. Such a delete/edit instead creates a pending
 * change request. Only an Owner or Super Admin (permission `approvals.approve`
 * or `*`) may approve it, at which point the originally-requested HTTP call is
 * re-dispatched internally and executed for real.
 */
export const changeRequestsTable = pgTable("change_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companiesTable.id, { onDelete: "restrict" }),
  /** 'delete' | 'edit' */
  requestType: text("request_type").notNull(),
  /** Resource segment, e.g. 'contracts' (used for display + audit). */
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  /** Optional human-readable label of the target record. */
  entityLabel: text("entity_label"),
  /** Original HTTP method to re-dispatch on approval ('DELETE' | 'PATCH'). */
  method: text("method").notNull(),
  /** Original /api/... path (no query string) to re-dispatch on approval. */
  path: text("path").notNull(),
  /** Request body to replay for edit requests. */
  payload: jsonb("payload"),
  reason: text("reason").notNull().default(""),
  /** pending | approved | rejected | executed | failed */
  status: text("status").notNull().default("pending"),
  requestedBy: uuid("requested_by").notNull(),
  requestedByName: text("requested_by_name").notNull(),
  reviewedBy: uuid("reviewed_by"),
  reviewedByName: text("reviewed_by_name"),
  reviewNotes: text("review_notes"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  executedAt: timestamp("executed_at", { withTimezone: true }),
  executionError: text("execution_error"),
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * Branch / department / project scope grants for a user. A user with no scope
 * rows of a given type is unrestricted for that type; otherwise access is
 * limited to the listed scope ids. `*` permission holders bypass scoping.
 */
export const userScopesTable = pgTable("user_scopes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  /** 'branch' | 'department' | 'project' */
  scopeType: text("scope_type").notNull(),
  scopeId: uuid("scope_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ChangeRequestRow = typeof changeRequestsTable.$inferSelect;
export type UserScopeRow = typeof userScopesTable.$inferSelect;
