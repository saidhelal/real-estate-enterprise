import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
  integer,
  date,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
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

// Marketing campaigns (الحملات التسويقية). The campaign `code` is auto-generated
// from the number-sequence engine ("MarketingCampaign") at create time. Owner is
// referenced by plain user uuid (no FK), matching the module-scaffold convention.
// `actualCost` accumulates spend for ROI reporting (Phase 4); budget/actualCost
// are integer-cent-safe numerics stored as strings.
export const marketingCampaignsTable = pgTable("marketing_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
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
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  channelType: text("channel_type").notNull().default("digital"),
  description: text("description"),
  notes: text("notes"),
  ...audit,
});
export type MarketingChannelRow = typeof marketingChannelsTable.$inferSelect;

// --- Smart Lead Distribution Engine (Phase 3) ---
// Dynamic, priority-ordered rules that decide which sales agent an incoming
// (marketing-generated) lead is auto-assigned to. Each criteria column is a
// nullable filter: NULL = wildcard (matches any), a value = must equal the
// lead's. Rules are evaluated by `priority` ascending (lower = stronger), then
// oldest first; the first matching active rule wins. `strategy` chooses the
// agent within the matched rule's candidate pool.
//   - direct          -> always `targetUserId`
//   - round_robin     -> agent with the fewest lifetime assignments / weight
//   - load_balanced   -> agent with the fewest open leads / weight (respects maxLeadsPerAgent)
//   - performance     -> agent with the highest conversion rate (conversions / assignments)
export const marketingDistributionRulesTable = pgTable("marketing_distribution_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  // criteria (nullable = wildcard)
  campaignId: uuid("campaign_id"),
  channelId: uuid("channel_id"),
  sourceId: uuid("source_id"),
  branchId: uuid("branch_id"),
  strategy: text("strategy").notNull().default("round_robin"),
  targetUserId: uuid("target_user_id"),
  priority: integer("priority").notNull().default(100),
  maxLeadsPerAgent: integer("max_leads_per_agent"),
  description: text("description"),
  notes: text("notes"),
  ...audit,
}, (t) => [
  index("mkt_dist_rules_lookup_idx").on(t.companyId, t.isDeleted, t.isActive, t.priority),
]);
export type MarketingDistributionRuleRow = typeof marketingDistributionRulesTable.$inferSelect;

// The eligible sales-agent roster for distribution (the HR + Sales integration
// surface): an admin enrolls users (sales reps) here. `weight` biases the
// load/round-robin maths so higher-capacity reps receive proportionally more
// leads. Agents referenced by plain user uuid (no FK), per scaffold convention.
export const marketingDistributionAgentsTable = pgTable("marketing_distribution_agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  userId: uuid("user_id").notNull(),
  weight: integer("weight").notNull().default(1),
  notes: text("notes"),
  ...audit,
}, (t) => [
  index("mkt_dist_agents_roster_idx").on(t.companyId, t.isDeleted, t.isActive),
]);
export type MarketingDistributionAgentRow = typeof marketingDistributionAgentsTable.$inferSelect;

// Immutable audit log of every automatic distribution decision: which rule
// matched, which agent was chosen, under which strategy, the score used, and a
// human-readable reason. Read-only in the UI; powers distribution transparency.
export const marketingDistributionLogsTable = pgTable("marketing_distribution_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companiesTable.id, { onDelete: "restrict" }),
  leadId: uuid("lead_id").notNull(),
  ruleId: uuid("rule_id"),
  assignedToUserId: uuid("assigned_to_user_id").notNull(),
  strategy: text("strategy").notNull(),
  score: numeric("score", { precision: 14, scale: 4 }),
  reason: text("reason"),
  ...audit,
}, (t) => [
  index("mkt_dist_logs_company_idx").on(t.companyId, t.isDeleted),
  index("mkt_dist_logs_lead_idx").on(t.leadId),
]);
export type MarketingDistributionLogRow = typeof marketingDistributionLogsTable.$inferSelect;
