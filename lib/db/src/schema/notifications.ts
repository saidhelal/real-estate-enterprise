import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
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

// Notification Center (الإشعارات والتنبيهات): the single internal ERP notification
// inbox. Each row is one notification addressed to a recipient user. The module is
// standalone here; other modules will write rows into it gradually. Scope (item 18):
// a user sees their own rows; a department manager sees their department's rows
// (departmentId); Owner/Super Admin (perm "*") or "notifications.viewAll" see all.
//
// View states are derived, not separate tables:
// - all      -> isDeleted = false
// - unread   -> isDeleted = false AND isRead = false
// - read     -> isDeleted = false AND isRead = true
// - favorites-> isDeleted = false AND isFavorite = true
// - archived -> isDeleted = false AND isArchived = true
// - trash    -> isDeleted = true   (سلة الإشعارات; recoverable via restore)
export const notificationsTable = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companiesTable.id, { onDelete: "restrict" }),
  // Recipient inbox owner (whose notification this is).
  recipientUserId: uuid("recipient_user_id").notNull(),
  // User who triggered the underlying event, when known.
  actorUserId: uuid("actor_user_id"),
  // Department of the recipient/source, used for department-manager scope.
  departmentId: uuid("department_id"),
  // High-level source group, e.g. customers/contracts/installments/finance/
  // procurement/projects/contractors/hr/insurance/customer_service/general_admin/
  // system/approvals.
  category: text("category").notNull().default("system"),
  // The specific event, e.g. contract_created, installment_due, cheque_returned.
  eventType: text("event_type"),
  // Importance: normal | medium | high | urgent (item 16).
  priority: text("priority").notNull().default("normal"),
  // Delivery channel: in_app | email | sms | whatsapp | push (item 15).
  channel: text("channel").notNull().default("in_app"),
  title: text("title").notNull(),
  body: text("body"),
  // Human-readable source module name (اسم الموديول) for display.
  sourceModule: text("source_module"),
  // The linked record: its id and a human reference/number (رقم السجل).
  sourceId: uuid("source_id"),
  sourceRef: text("source_ref"),
  // Direct in-app link that opens the related record (رابط مباشر).
  link: text("link"),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at", { withTimezone: true }),
  isFavorite: boolean("is_favorite").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  ...audit,
});
export type NotificationRow = typeof notificationsTable.$inferSelect;
