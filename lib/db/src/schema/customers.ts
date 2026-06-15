import {
  pgTable,
  uuid,
  text,
  boolean,
  date,
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

export const customersTable = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  branchId: uuid("branch_id"),
  code: text("code").notNull(),
  fullName: text("full_name").notNull(),
  nameAr: text("name_ar"),
  type: text("type").notNull().default("individual"),
  nationalId: text("national_id"),
  passport: text("passport"),
  companyName: text("company_name"),
  taxNumber: text("tax_number"),
  commercialRegistration: text("commercial_registration"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  ...audit,
});
export type CustomerRow = typeof customersTable.$inferSelect;

export const customerContactsTable = pgTable("customer_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  customerId: uuid("customer_id").notNull(),
  name: text("name").notNull(),
  relation: text("relation"),
  phone: text("phone"),
  email: text("email"),
  ...audit,
});
export type CustomerContactRow = typeof customerContactsTable.$inferSelect;

export const customerDocumentsTable = pgTable("customer_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  customerId: uuid("customer_id").notNull(),
  docType: text("doc_type").notNull(),
  docNumber: text("doc_number"),
  fileName: text("file_name"),
  issueDate: date("issue_date"),
  expiryDate: date("expiry_date"),
  notes: text("notes"),
  ...audit,
});
export type CustomerDocumentRow = typeof customerDocumentsTable.$inferSelect;

export const customerNotesTable = pgTable("customer_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  customerId: uuid("customer_id").notNull(),
  note: text("note").notNull(),
  userId: uuid("user_id"),
  ...audit,
});
export type CustomerNoteRow = typeof customerNotesTable.$inferSelect;
