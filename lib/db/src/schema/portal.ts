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

// Customer portal login accounts. One (or more) per customer.
export const customerUsersTable = pgTable("customer_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  customerId: uuid("customer_id").notNull(),
  username: text("username").notNull(),
  email: text("email"),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  status: text("status").notNull().default("active"),
  failedAttempts: numeric("failed_attempts", { precision: 6, scale: 0 })
    .notNull()
    .default("0"),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  ...audit,
});
export type CustomerUserRow = typeof customerUsersTable.$inferSelect;

// Refresh sessions for portal users (rotated, hashed token).
export const customerSessionsTable = pgTable("customer_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  customerUserId: uuid("customer_user_id").notNull(),
  customerId: uuid("customer_id").notNull(),
  refreshTokenHash: text("refresh_token_hash").notNull(),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ...audit,
});
export type CustomerSessionRow = typeof customerSessionsTable.$inferSelect;

// One-time codes for password reset / phone or email verification.
export const customerOtpsTable = pgTable("customer_otps", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  customerUserId: uuid("customer_user_id"),
  identifier: text("identifier").notNull(),
  codeHash: text("code_hash").notNull(),
  purpose: text("purpose").notNull().default("password_reset"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  ...audit,
});
export type CustomerOtpRow = typeof customerOtpsTable.$inferSelect;

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
  ...audit,
});
export type ComplaintRow = typeof complaintsTable.$inferSelect;

// In-app/portal notifications targeted at a customer.
export const customerNotificationsTable = pgTable("customer_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  customerId: uuid("customer_id").notNull(),
  customerUserId: uuid("customer_user_id"),
  title: text("title").notNull(),
  body: text("body"),
  category: text("category").notNull().default("general"),
  link: text("link"),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at", { withTimezone: true }),
  ...audit,
});
export type CustomerNotificationRow = typeof customerNotificationsTable.$inferSelect;

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

// Immutable owner mapping for portal file uploads (P18). Every presigned upload
// URL minted by /portal/uploads records the resulting object path bound to the
// requesting customer. Attachment writes and file serving authorize against this
// table, so a customer can never reference or read another customer's object even
// by guessing its path.
export const customerUploadsTable = pgTable("customer_uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  customerId: uuid("customer_id").notNull(),
  customerUserId: uuid("customer_user_id").notNull(),
  objectPath: text("object_path").notNull().unique(),
  fileName: text("file_name"),
  contentType: text("content_type"),
  ...audit,
});
export type CustomerUploadRow = typeof customerUploadsTable.$inferSelect;

// Push notification device tokens (P18 mobile readiness).
export const customerDeviceTokensTable = pgTable("customer_device_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  customerId: uuid("customer_id").notNull(),
  customerUserId: uuid("customer_user_id").notNull(),
  token: text("token").notNull(),
  platform: text("platform").notNull().default("web"),
  deviceName: text("device_name"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  ...audit,
});
export type CustomerDeviceTokenRow = typeof customerDeviceTokensTable.$inferSelect;
