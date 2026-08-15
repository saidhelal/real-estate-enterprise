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

// SLA policies governing response/resolution targets for service channels
// (complaints, maintenance requests, support tickets).
export const slaPoliciesTable = pgTable("sla_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  channel: text("channel").notNull().default("all"),
  priority: text("priority").notNull().default("medium"),
  firstResponseHours: numeric("first_response_hours", { precision: 8, scale: 2 }).notNull().default("0"),
  resolutionHours: numeric("resolution_hours", { precision: 8, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  ...audit,
});
export type SlaPolicyRow = typeof slaPoliciesTable.$inferSelect;

// Escalation records raised against a service item (complaint/maintenance/ticket)
// when SLA targets are breached or manual escalation is required.
export const serviceEscalationsTable = pgTable("service_escalations", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  sourceType: text("source_type").notNull().default("complaint"),
  sourceId: uuid("source_id").notNull(),
  level: numeric("level", { precision: 4, scale: 0 }).notNull().default("1"),
  escalatedToUserId: uuid("escalated_to_user_id"),
  reason: text("reason"),
  reasonAr: text("reason_ar"),
  status: text("status").notNull().default("open"),
  escalatedAt: date("escalated_at").notNull().defaultNow(),
  resolvedAt: date("resolved_at"),
  notes: text("notes"),
  ...audit,
});
export type ServiceEscalationRow = typeof serviceEscalationsTable.$inferSelect;
