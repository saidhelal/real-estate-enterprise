import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
  date,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

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
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  ...audit,
});
export type LeadSourceRow = typeof leadSourcesTable.$inferSelect;

export const leadsTable = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  branchId: uuid("branch_id"),
  code: text("code").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  nationalId: text("national_id"),
  email: text("email"),
  sourceId: uuid("source_id"),
  // Marketing attribution (Phase 2). Nullable + additive: existing leads keep
  // NULL. `sourceId` already records CRM provenance; these add the marketing
  // campaign + channel a lead was generated from, for ROI/attribution reporting.
  campaignId: uuid("campaign_id"),
  channelId: uuid("channel_id"),
  assignedToUserId: uuid("assigned_to_user_id"),
  status: text("status").notNull().default("new"),
  budget: numeric("budget", { precision: 14, scale: 2 }),
  notes: text("notes"),
  ...audit,
}, (t) => [
  index("leads_company_deleted_idx").on(t.companyId, t.isDeleted),
  index("leads_assigned_status_idx").on(t.assignedToUserId, t.status),
  index("leads_source_idx").on(t.sourceId),
  index("leads_campaign_idx").on(t.campaignId),
  index("leads_channel_idx").on(t.channelId),
]);
export type LeadRow = typeof leadsTable.$inferSelect;

export const leadActivitiesTable = pgTable("lead_activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  leadId: uuid("lead_id"),
  customerId: uuid("customer_id"),
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
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  leadId: uuid("lead_id"),
  customerId: uuid("customer_id"),
  dueDate: date("due_date").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  userId: uuid("user_id"),
  ...audit,
});
export type LeadFollowUpRow = typeof leadFollowUpsTable.$inferSelect;

export const leadAssignmentsTable = pgTable("lead_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  leadId: uuid("lead_id").notNull(),
  assignedToUserId: uuid("assigned_to_user_id").notNull(),
  assignedByUserId: uuid("assigned_by_user_id"),
  notes: text("notes"),
  ...audit,
}, (t) => [
  index("lead_assignments_assignee_idx").on(t.assignedToUserId, t.isDeleted),
  index("lead_assignments_lead_idx").on(t.leadId),
]);
export type LeadAssignmentRow = typeof leadAssignmentsTable.$inferSelect;

export const leadConversionsTable = pgTable("lead_conversions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  leadId: uuid("lead_id").notNull(),
  customerId: uuid("customer_id").notNull(),
  convertedByUserId: uuid("converted_by_user_id"),
  notes: text("notes"),
  ...audit,
}, (t) => [
  index("lead_conversions_converter_idx").on(t.convertedByUserId, t.isDeleted),
  index("lead_conversions_lead_idx").on(t.leadId),
]);
export type LeadConversionRow = typeof leadConversionsTable.$inferSelect;
