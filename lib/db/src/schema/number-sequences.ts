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
   */
  uniqueIndex("number_sequences_type_company_uq")
    .on(t.documentType, t.companyId)
    .where(sql`${t.companyId} is not null`),
  uniqueIndex("number_sequences_type_global_uq")
    .on(t.documentType)
    .where(sql`${t.companyId} is null`),
]);

export type NumberSequenceRow = typeof numberSequencesTable.$inferSelect;
