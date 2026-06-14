import { pgTable, uuid, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const numberSequencesTable = pgTable("number_sequences", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentType: text("document_type").notNull(),
  prefix: text("prefix").notNull(),
  nextNumber: integer("next_number").notNull().default(1),
  padding: integer("padding").notNull().default(6),
  resetYearly: boolean("reset_yearly").notNull().default(false),
  companyId: uuid("company_id"),
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type NumberSequenceRow = typeof numberSequencesTable.$inferSelect;
