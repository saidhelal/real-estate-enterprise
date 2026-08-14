import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const companiesTable = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  taxNumber: text("tax_number"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  baseCurrency: text("base_currency"),

  /* ---- Institutional profile ---------------------------------------------
   * `name`/`nameAr` are what the application calls the company; a company also
   * has a name it signs contracts under, a name it trades under, a legal form
   * and a set of registrations. Printing an official letter needs all of them,
   * and they were previously nowhere — so every template that wanted a legal
   * name either invented one or left it blank.
   *
   * They live here, on the company row, because the company already IS the
   * single source of truth for who the organisation is. A separate
   * "company_profile" table would be a second answer to the same question.
   *
   * Every column is nullable: existing rows predate them and stay valid.
   */
  legalName: text("legal_name"),
  legalNameAr: text("legal_name_ar"),
  tradeName: text("trade_name"),
  /** LLC, JSC, sole establishment … kept as free text; jurisdictions differ. */
  legalForm: text("legal_form"),
  commercialRegister: text("commercial_register"),
  website: text("website"),
  /** Resolved through the CDMS/object store like any other file reference. */
  logoUrl: text("logo_url"),
  /** Reachable numbers that differ from the switchboard above. */
  officialEmail: text("official_email"),
  fax: text("fax"),
  poBox: text("po_box"),
  /**
   * The person who signs on the company's behalf. Free text rather than an
   * employee link: the official representative is a legal fact about the
   * company that may name someone who holds no login and no HR record.
   */
  representativeName: text("representative_name"),
  representativeTitle: text("representative_title"),
  /** Extra lines the print templates put above/below every official page. */
  printHeader: text("print_header"),
  printFooter: text("print_footer"),

  isActive: boolean("is_active").notNull().default(true),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type CompanyRow = typeof companiesTable.$inferSelect;
