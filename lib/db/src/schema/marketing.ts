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

// Marketing campaigns (الحملات التسويقية). The campaign `code` is auto-generated
// from the number-sequence engine ("MarketingCampaign") at create time. Owner is
// referenced by plain user uuid (no FK), matching the module-scaffold convention.
// `actualCost` accumulates spend for ROI reporting (Phase 4); budget/actualCost
// are integer-cent-safe numerics stored as strings.
export const marketingCampaignsTable = pgTable("marketing_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  branchId: uuid("branch_id"),
  projectId: uuid("project_id"),
  code: text("code").notNull(),
  name: text("name").notNull(),
  campaignType: text("campaign_type").notNull().default("digital"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  budget: numeric("budget", { precision: 14, scale: 2 }),
  actualCost: numeric("actual_cost", { precision: 14, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("draft"),
  ownerUserId: uuid("owner_user_id"),
  description: text("description"),
  notes: text("notes"),
  ...audit,
});
export type MarketingCampaignRow = typeof marketingCampaignsTable.$inferSelect;

// Marketing channels (القنوات التسويقية): a bilingual master list of channels
// (paid social, organic search, referral, ...) used to classify campaigns and,
// in Phase 2, to attribute generated leads. Distinct from CRM `lead_sources`,
// which remain the single source of truth for lead provenance.
export const marketingChannelsTable = pgTable("marketing_channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  channelType: text("channel_type").notNull().default("digital"),
  description: text("description"),
  notes: text("notes"),
  ...audit,
});
export type MarketingChannelRow = typeof marketingChannelsTable.$inferSelect;
