import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
  date,
  timestamp,
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

// Unit handover requests (initial/final delivery of a unit to a customer).
export const handoverRequestsTable = pgTable("handover_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  unitId: uuid("unit_id").notNull(),
  customerId: uuid("customer_id"),
  contractId: uuid("contract_id"),
  reservationId: uuid("reservation_id"),
  handoverType: text("handover_type").notNull().default("final"),
  requestDate: date("request_date"),
  status: text("status").notNull().default("requested"),
  notes: text("notes"),
  ...audit,
});
export type HandoverRequestRow = typeof handoverRequestsTable.$inferSelect;

// Scheduled appointments for a handover request.
export const handoverSchedulesTable = pgTable("handover_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  requestId: uuid("request_id").notNull(),
  scheduledDate: date("scheduled_date"),
  scheduledTime: text("scheduled_time"),
  location: text("location"),
  locationAr: text("location_ar"),
  assignedToUserId: uuid("assigned_to_user_id"),
  status: text("status").notNull().default("scheduled"),
  notes: text("notes"),
  ...audit,
});
export type HandoverScheduleRow = typeof handoverSchedulesTable.$inferSelect;

// Inspection checklist items verified during handover.
export const handoverChecklistItemsTable = pgTable("handover_checklist_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  requestId: uuid("request_id").notNull(),
  item: text("item").notNull(),
  itemAr: text("item_ar"),
  category: text("category"),
  status: text("status").notNull().default("pending"),
  remarks: text("remarks"),
  notes: text("notes"),
  ...audit,
});
export type HandoverChecklistItemRow = typeof handoverChecklistItemsTable.$inferSelect;

// Minutes of meeting recorded at handover.
export const handoverMinutesTable = pgTable("handover_minutes", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  requestId: uuid("request_id").notNull(),
  minuteDate: date("minute_date"),
  summary: text("summary").notNull(),
  summaryAr: text("summary_ar"),
  attendees: text("attendees"),
  notes: text("notes"),
  ...audit,
});
export type HandoverMinuteRow = typeof handoverMinutesTable.$inferSelect;

// Snags / defects raised during handover inspection. Reuses defects concept
// but scoped to a handover request for the punch-list workflow.
export const handoverSnagsTable = pgTable("handover_snags", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  requestId: uuid("request_id").notNull(),
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  severity: text("severity").notNull().default("medium"),
  status: text("status").notNull().default("open"),
  location: text("location"),
  assignedToUserId: uuid("assigned_to_user_id"),
  dueDate: date("due_date"),
  notes: text("notes"),
  ...audit,
});
export type HandoverSnagRow = typeof handoverSnagsTable.$inferSelect;

// Sign-off approvals for a handover request.
export const handoverApprovalsTable = pgTable("handover_approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  requestId: uuid("request_id").notNull(),
  approverName: text("approver_name"),
  approverNameAr: text("approver_name_ar"),
  level: numeric("level", { precision: 4, scale: 0 }).notNull().default("1"),
  status: text("status").notNull().default("pending"),
  approvalDate: date("approval_date"),
  remarks: text("remarks"),
  notes: text("notes"),
  ...audit,
});
export type HandoverApprovalRow = typeof handoverApprovalsTable.$inferSelect;
