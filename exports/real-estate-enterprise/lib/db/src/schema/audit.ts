import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const auditLogsTable = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  userId: uuid("user_id"),
  userName: text("user_name").notNull().default("system"),
  ipAddress: text("ip_address"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const loginHistoryTable = pgTable("login_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  userName: text("user_name").notNull(),
  success: boolean("success").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLogRow = typeof auditLogsTable.$inferSelect;
export type LoginHistoryRow = typeof loginHistoryTable.$inferSelect;
