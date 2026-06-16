import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
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

// Land parcels / plots held by the company (the land bank register).
export const landParcelsTable = pgTable("land_parcels", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  projectId: uuid("project_id"),
  location: text("location"),
  locationAr: text("location_ar"),
  area: numeric("area", { precision: 16, scale: 2 }).notNull().default("0"),
  areaUnit: text("area_unit").notNull().default("sqm"),
  zoning: text("zoning"),
  classification: text("classification"),
  marketValue: numeric("market_value", { precision: 16, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("available"),
  notes: text("notes"),
  ...audit,
});
export type LandParcelRow = typeof landParcelsTable.$inferSelect;

// Ownership records for a parcel (title deeds, shares).
export const landOwnershipsTable = pgTable("land_ownerships", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  parcelId: uuid("parcel_id").notNull(),
  ownerName: text("owner_name").notNull(),
  ownerNameAr: text("owner_name_ar"),
  ownershipType: text("ownership_type").notNull().default("freehold"),
  sharePercentage: numeric("share_percentage", { precision: 6, scale: 2 }).notNull().default("100"),
  titleDeedNo: text("title_deed_no"),
  registrationDate: date("registration_date"),
  notes: text("notes"),
  ...audit,
});
export type LandOwnershipRow = typeof landOwnershipsTable.$inferSelect;

// Legal status history / standing for a parcel.
export const landLegalStatusesTable = pgTable("land_legal_statuses", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  parcelId: uuid("parcel_id").notNull(),
  status: text("status").notNull().default("clear"),
  authority: text("authority"),
  referenceNo: text("reference_no"),
  effectiveDate: date("effective_date"),
  notes: text("notes"),
  ...audit,
});
export type LandLegalStatusRow = typeof landLegalStatusesTable.$inferSelect;

// How a parcel is utilized / allocated (e.g. to a project).
export const landUtilizationsTable = pgTable("land_utilizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  parcelId: uuid("parcel_id").notNull(),
  utilizationType: text("utilization_type").notNull().default("development"),
  allocatedArea: numeric("allocated_area", { precision: 16, scale: 2 }).notNull().default("0"),
  projectId: uuid("project_id"),
  status: text("status").notNull().default("planned"),
  notes: text("notes"),
  ...audit,
});
export type LandUtilizationRow = typeof landUtilizationsTable.$inferSelect;

// Documents attached to a parcel (deeds, surveys, permits).
export const landDocumentsTable = pgTable("land_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  parcelId: uuid("parcel_id").notNull(),
  docType: text("doc_type").notNull().default("deed"),
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  fileUrl: text("file_url"),
  issueDate: date("issue_date"),
  expiryDate: date("expiry_date"),
  notes: text("notes"),
  ...audit,
});
export type LandDocumentRow = typeof landDocumentsTable.$inferSelect;

// Acquisition records (how/when/at what cost the parcel was acquired).
export const landAcquisitionsTable = pgTable("land_acquisitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  parcelId: uuid("parcel_id").notNull(),
  acquisitionType: text("acquisition_type").notNull().default("purchase"),
  sellerName: text("seller_name"),
  acquisitionDate: date("acquisition_date"),
  cost: numeric("cost", { precision: 16, scale: 2 }).notNull().default("0"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  referenceNo: text("reference_no"),
  notes: text("notes"),
  ...audit,
});
export type LandAcquisitionRow = typeof landAcquisitionsTable.$inferSelect;
