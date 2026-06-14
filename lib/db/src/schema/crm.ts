import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
  date,
  timestamp,
} from "drizzle-orm/pg-core";

const audit = {
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const leadSourcesTable = pgTable("lead_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  ...audit,
});
export type LeadSourceRow = typeof leadSourcesTable.$inferSelect;

export const leadsTable = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  branchId: uuid("branch_id"),
  code: text("code").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  sourceId: uuid("source_id"),
  assignedToUserId: uuid("assigned_to_user_id"),
  status: text("status").notNull().default("new"),
  budget: numeric("budget", { precision: 14, scale: 2 }),
  notes: text("notes"),
  ...audit,
});
export type LeadRow = typeof leadsTable.$inferSelect;

export const leadActivitiesTable = pgTable("lead_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  leadId: uuid("lead_id").notNull(),
  activityType: text("activity_type").notNull().default("note"),
  subject: text("subject"),
  notes: text("notes"),
  activityDate: date("activity_date").notNull(),
  userId: uuid("user_id"),
  ...audit,
});
export type LeadActivityRow = typeof leadActivitiesTable.$inferSelect;

export const leadFollowUpsTable = pgTable("lead_follow_ups", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  leadId: uuid("lead_id").notNull(),
  dueDate: date("due_date").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  userId: uuid("user_id"),
  ...audit,
});
export type LeadFollowUpRow = typeof leadFollowUpsTable.$inferSelect;

export const leadAssignmentsTable = pgTable("lead_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  leadId: uuid("lead_id").notNull(),
  assignedToUserId: uuid("assigned_to_user_id").notNull(),
  assignedByUserId: uuid("assigned_by_user_id"),
  notes: text("notes"),
  ...audit,
});
export type LeadAssignmentRow = typeof leadAssignmentsTable.$inferSelect;

export const leadConversionsTable = pgTable("lead_conversions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  leadId: uuid("lead_id").notNull(),
  customerId: uuid("customer_id").notNull(),
  convertedByUserId: uuid("converted_by_user_id"),
  notes: text("notes"),
  ...audit,
});
export type LeadConversionRow = typeof leadConversionsTable.$inferSelect;
