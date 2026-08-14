import { pgTable, uuid, text, boolean, date, timestamp } from "drizzle-orm/pg-core";

const audit = {
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * External bodies the organisation maintains a standing relationship with:
 * ministries and authorities, banks, partner companies, consultants, media.
 *
 * Deliberately NOT customers, leads or suppliers. Those already exist and are
 * defined by a transaction — an invoice, a pipeline stage, a purchase order.
 * A ministry the company must stay on good terms with fits none of those, and
 * forcing it into the customer register would corrupt every sales report that
 * counts rows there. Different question, different register.
 *
 * What this table owns is the *relationship*: who inside the company holds it,
 * how important it is, and when it was last exercised. What was actually said
 * lives in `pr_interactions`, and the letters, meetings and documents stay in
 * their own systems and are referenced, never copied.
 */
export const prPartiesTable = pgTable("pr_parties", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  /** government | company | institution | bank | partner | consultant | media | figure */
  partyType: text("party_type").notNull().default("company"),
  /** strategic | operational | regulatory | commercial | media */
  relationshipType: text("relationship_type").notNull().default("operational"),
  /** The employee who owns this relationship — a name to ask, not a mailbox. */
  ownerEmployeeId: uuid("owner_employee_id"),
  contactPerson: text("contact_person"),
  contactTitle: text("contact_title"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  address: text("address"),
  /** high | medium | low — drives the follow-up queue ordering. */
  importance: text("importance").notNull().default("medium"),
  /** active | dormant | suspended | closed */
  status: text("status").notNull().default("active"),
  /**
   * Denormalised from the newest interaction. A relationship register is read
   * far more often than it is written, and "who have we not spoken to in six
   * months" is the question it exists to answer; recomputing that with a
   * correlated subquery on every list page would be the wrong trade.
   */
  lastContactDate: date("last_contact_date"),
  nextFollowUpDate: date("next_follow_up_date"),
  notes: text("notes"),
  ...audit,
});
export type PrPartyRow = typeof prPartiesTable.$inferSelect;

/**
 * One recorded contact with an external party: who spoke to whom, when, why,
 * what came of it, and whether anything is still owed.
 *
 * The `*Id` columns are references into the systems that own those records —
 * correspondence, meetings, administrative tasks, CDMS. Nothing is copied
 * here: a letter logged against a relationship is still the one row in the
 * correspondence register, with one code and one audit history.
 */
export const prInteractionsTable = pgTable("pr_interactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  partyId: uuid("party_id").notNull(),
  code: text("code").notNull(),
  /** meeting | call | letter | visit | email | event */
  interactionType: text("interaction_type").notNull().default("meeting"),
  interactionDate: date("interaction_date").notNull().defaultNow(),
  subject: text("subject").notNull(),
  /** Who represented the company. */
  handledByEmployeeId: uuid("handled_by_employee_id"),
  /** Who was met on the other side. */
  counterpartName: text("counterpart_name"),
  purpose: text("purpose"),
  /** What actually came of it — the reason the log is worth keeping. */
  outcome: text("outcome"),
  followUpRequired: boolean("follow_up_required").notNull().default(false),
  followUpDate: date("follow_up_date"),
  status: text("status").notNull().default("completed"),

  /* References into the owning systems — never copies. */
  correspondenceId: uuid("correspondence_id"),
  meetingId: uuid("meeting_id"),
  taskId: uuid("task_id"),

  notes: text("notes"),
  ...audit,
});
export type PrInteractionRow = typeof prInteractionsTable.$inferSelect;
