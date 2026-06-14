import { pgTable, uuid, text } from "drizzle-orm/pg-core";

export const permissionsTable = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  module: text("module").notNull(),
  description: text("description").notNull().default(""),
});

export type PermissionRow = typeof permissionsTable.$inferSelect;
