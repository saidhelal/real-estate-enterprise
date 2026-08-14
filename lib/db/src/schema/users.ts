import { pgTable, uuid, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  /**
   * The employee record this login belongs to.
   *
   * Login identity and organisational identity were separate islands: a user
   * had a name and permissions, an employee had a manager and a department,
   * and nothing joined them. That is fine until something needs to ask "who is
   * this person's manager" — internal correspondence does, and the answer has
   * to be authoritative rather than inferred from a matching email address,
   * because getting it wrong routes confidential mail to the wrong person.
   *
   * Nullable on purpose: service accounts and administrators legitimately have
   * no employee record, and every existing row predates the column.
   */
  employeeId: uuid("employee_id"),
  username: text("username").notNull().unique(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  status: text("status").notNull().default("active"),
  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  companyId: uuid("company_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type UserRow = typeof usersTable.$inferSelect;
