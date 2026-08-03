import { pgTable, uuid, text, boolean, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const rolesTable = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  isSystem: boolean("is_system").notNull().default(false),
  permissions: text("permissions").array().notNull().default([]),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const userRolesTable = pgTable(
  "user_roles",
  {
    userId: uuid("user_id").notNull(),
    roleId: uuid("role_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);

export type RoleRow = typeof rolesTable.$inferSelect;
