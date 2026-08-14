/**
 * Customer-service records.
 *
 * This file was the customer portal's schema. The portal is gone — customers
 * are business records staff manage inside the ERP and hold no login — but
 * these four are not the portal's to take with it: a maintenance request, a
 * complaint and a support ticket (with its thread) are things the company
 * tracks and answers, whichever door they arrived through.
 */
import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
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
// Maintenance requests raised by a customer for an owned unit.
export const maintenanceRequestsTable = pgTable("maintenance_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  customerId: uuid("customer_id").notNull(),
  customerUserId: uuid("customer_user_id"),
  code: text("code").notNull(),
  unitId: uuid("unit_id"),
  contractId: uuid("contract_id"),
  category: text("category").notNull().default("general"),
  priority: text("priority").notNull().default("medium"),
  subject: text("subject").notNull(),
  description: text("description"),
  status: text("status").notNull().default("open"),
  attachmentUrl: text("attachment_url"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  // Customer Service (staff-side) SLA / assignment fields.
  assignedToUserId: uuid("assigned_to_user_id"),
  slaPolicyId: uuid("sla_policy_id"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
  escalationLevel: numeric("escalation_level", { precision: 4, scale: 0 }),
  ...audit,
});
export type MaintenanceRequestRow = typeof maintenanceRequestsTable.$inferSelect;

// General complaints raised by a customer.
export const complaintsTable = pgTable("complaints", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  customerId: uuid("customer_id").notNull(),
  customerUserId: uuid("customer_user_id"),
  code: text("code").notNull(),
  category: text("category").notNull().default("general"),
  subject: text("subject").notNull(),
  description: text("description"),
  status: text("status").notNull().default("open"),
  attachmentUrl: text("attachment_url"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  // Customer Service (staff-side) SLA / assignment fields.
  assignedToUserId: uuid("assigned_to_user_id"),
  slaPolicyId: uuid("sla_policy_id"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
  escalationLevel: numeric("escalation_level", { precision: 4, scale: 0 }),
  ...audit,
});
export type ComplaintRow = typeof complaintsTable.$inferSelect;
// Support tickets (threaded via support_ticket_messages).
export const supportTicketsTable = pgTable("support_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  customerId: uuid("customer_id").notNull(),
  customerUserId: uuid("customer_user_id"),
  code: text("code").notNull(),
  subject: text("subject").notNull(),
  category: text("category").notNull().default("general"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("open"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  // Customer Service (staff-side) SLA / assignment fields.
  assignedToUserId: uuid("assigned_to_user_id"),
  slaPolicyId: uuid("sla_policy_id"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
  escalationLevel: numeric("escalation_level", { precision: 4, scale: 0 }),
  ...audit,
});
export type SupportTicketRow = typeof supportTicketsTable.$inferSelect;

export const supportTicketMessagesTable = pgTable("support_ticket_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  ticketId: uuid("ticket_id").notNull(),
  customerId: uuid("customer_id").notNull(),
  // "customer" or "staff"
  authorType: text("author_type").notNull().default("customer"),
  authorId: uuid("author_id"),
  authorName: text("author_name"),
  body: text("body").notNull(),
  attachmentUrl: text("attachment_url"),
  ...audit,
});
export type SupportTicketMessageRow = typeof supportTicketMessagesTable.$inferSelect;