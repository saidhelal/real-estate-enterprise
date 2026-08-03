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

// Call Center log: inbound/outbound customer interactions handled by service staff.
export const callLogsTable = pgTable("call_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  customerId: uuid("customer_id"),
  direction: text("direction").notNull().default("inbound"),
  channel: text("channel").notNull().default("phone"),
  subject: text("subject").notNull(),
  summary: text("summary"),
  callStatus: text("call_status").notNull().default("completed"),
  durationMinutes: numeric("duration_minutes", { precision: 8, scale: 2 }),
  agentUserId: uuid("agent_user_id"),
  sourceType: text("source_type"),
  sourceId: uuid("source_id"),
  followUpRequired: boolean("follow_up_required").notNull().default(false),
  calledAt: date("called_at").notNull().defaultNow(),
  notes: text("notes"),
  ...audit,
});
export type CallLogRow = typeof callLogsTable.$inferSelect;

// Work order: an actionable execution task (often raised from a maintenance
// request or complaint). Status + progressPercent provide execution follow-up.
export const workOrdersTable = pgTable("work_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  customerId: uuid("customer_id"),
  unitId: uuid("unit_id"),
  sourceType: text("source_type").notNull().default("manual"),
  sourceId: uuid("source_id"),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("open"),
  assignedToUserId: uuid("assigned_to_user_id"),
  scheduledDate: date("scheduled_date"),
  completedDate: date("completed_date"),
  progressPercent: numeric("progress_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  estimatedCost: numeric("estimated_cost", { precision: 18, scale: 2 }),
  actualCost: numeric("actual_cost", { precision: 18, scale: 2 }),
  notes: text("notes"),
  ...audit,
});
export type WorkOrderRow = typeof workOrdersTable.$inferSelect;

// Customer satisfaction survey response, optionally tied to a service source
// (handover/complaint/maintenance/work order) or a general periodic survey.
export const customerSatisfactionSurveysTable = pgTable("customer_satisfaction_surveys", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  customerId: uuid("customer_id"),
  channel: text("channel").notNull().default("general"),
  sourceType: text("source_type"),
  sourceId: uuid("source_id"),
  status: text("status").notNull().default("sent"),
  surveyDate: date("survey_date").notNull().defaultNow(),
  overallRating: numeric("overall_rating", { precision: 3, scale: 1 }),
  npsScore: numeric("nps_score", { precision: 4, scale: 0 }),
  comments: text("comments"),
  ...audit,
});
export type CustomerSatisfactionSurveyRow = typeof customerSatisfactionSurveysTable.$inferSelect;
