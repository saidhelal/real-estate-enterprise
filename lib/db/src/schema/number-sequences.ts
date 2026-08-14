import { pgTable, uuid, text, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const numberSequencesTable = pgTable("number_sequences", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentType: text("document_type").notNull(),
  prefix: text("prefix").notNull(),
  nextNumber: integer("next_number").notNull().default(1),
  padding: integer("padding").notNull().default(6),
  resetYearly: boolean("reset_yearly").notNull().default(false),
  /**
   * The year the counter is currently running in.
   *
   * Without it `resetYearly` only changed the text: the year in the code moved
   * on while the counter kept climbing, so a "yearly" sequence never restarted.
   * Nullable because every existing row predates it; a null is treated as the
   * current year, so no in-flight sequence jumps on deploy.
   */
  periodYear: integer("period_year"),
  companyId: uuid("company_id"),
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (t) => [
  /**
   * One counter per document type per company.
   *
   * Nothing declared this pair unique, so the seed's `onConflictDoNothing` had
   * no conflict to detect and every seed run inserted another copy — 78
   * duplicate definitions had accumulated, and `nextDocumentNumber` picked an
   * arbitrary one of them.
   *
   * Two partial indexes rather than one: Postgres treats nulls as distinct in
   * a unique index, so a single index on the pair would still admit any number
   * of global (null-company) rows — exactly the duplicates being fixed. One
   * index covers the company-scoped rows, the other the global ones.
   *
   * Both are also restricted to live rows. This table soft-deletes, and the
   * duplicates that prompted these indexes were resolved by soft-deleting the
   * losers and keeping the highest counter — so an index over every row could
   * never be created: nineteen document types still carry four dead copies
   * each. Uniqueness is a statement about definitions that are in use, and
   * excluding `is_deleted` rows is what makes it one. The alternative was to
   * hard-delete history to satisfy an index, which is the wrong way round.
   */
  uniqueIndex("number_sequences_type_company_uq")
    .on(t.documentType, t.companyId)
    .where(sql`${t.companyId} is not null and ${t.isDeleted} = false`),
  uniqueIndex("number_sequences_type_global_uq")
    .on(t.documentType)
    .where(sql`${t.companyId} is null and ${t.isDeleted} = false`),
]);

export type NumberSequenceRow = typeof numberSequencesTable.$inferSelect;
