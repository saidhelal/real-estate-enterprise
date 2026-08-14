import { pgTable, uuid, text, date, timestamp, boolean, index } from "drizzle-orm/pg-core";

/**
 * A temporary hand-over of authority from one login to another.
 *
 * Deliberately NOT a second permission store. A delegation grants nothing on
 * its own: it names permission codes that already exist in the registry, and
 * they are only ever added on top of what the delegate's roles already give
 * them, for as long as the delegation is live. Roles remain the place
 * authority is defined; this is a dated exception to who exercises it.
 *
 * The rules that make it safe live on the write path, not here — a delegator
 * may only pass on codes they themselves hold, may not pass on the wildcard,
 * and may not delegate to themselves. Storing the granted codes as a plain
 * array is what keeps this auditable: the row says exactly what was handed
 * over, so a later reader does not have to reconstruct it from role history
 * that may since have changed.
 */
export const delegationsTable = pgTable(
  "delegations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    code: text("code").notNull(),

    /** Who is handing authority over. */
    delegatorUserId: uuid("delegator_user_id").notNull(),
    /** Who exercises it while the delegation is live. */
    delegateUserId: uuid("delegate_user_id").notNull(),

    /**
     * Permission codes from the existing registry. Never "*": a blanket
     * hand-over of everything is exactly what a delegation must not be able
     * to express, so the write path refuses it rather than relying on
     * everyone downstream to remember.
     */
    permissions: text("permissions").array().notNull().default([]),

    /** Why — required, because an unexplained transfer of authority is not
     *  reviewable after the fact. */
    reason: text("reason").notNull(),

    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),

    /** draft | active | revoked | expired */
    status: text("status").notNull().default("draft"),

    /** Set when someone with the approval permission puts it into effect. */
    activatedByUserId: uuid("activated_by_user_id"),
    activatedAt: timestamp("activated_at", { withTimezone: true }),

    /** Revocation is recorded rather than deleting the row: the fact that
     *  authority was held for a period stays true after it is withdrawn. */
    revokedByUserId: uuid("revoked_by_user_id"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokeReason: text("revoke_reason"),

    notes: text("notes"),

    isActive: boolean("is_active").notNull().default(true),
    isDeleted: boolean("is_deleted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // Every authenticated request resolves the caller's live delegations, so
    // this lookup sits on the hot path and is indexed accordingly.
    index("delegations_delegate_idx").on(t.delegateUserId, t.status),
    index("delegations_delegator_idx").on(t.delegatorUserId),
  ],
);

export type DelegationRow = typeof delegationsTable.$inferSelect;
