import { pgTable, text } from "drizzle-orm/pg-core";

export const settingsTable = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  category: text("category").notNull().default("general"),
  label: text("label").notNull().default(""),
});

export type SettingRow = typeof settingsTable.$inferSelect;
