import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import { ListSettingsResponse, UpdateSettingsBody } from "@workspace/api-zod";
import { toSetting } from "../lib/presenters";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

/**
 * Settings rows that must always exist so their controls show up on the Settings
 * page even on deployments provisioned before the row was introduced (the seed
 * only runs on demand). Inserted idempotently on read; never overwrites a value
 * an admin already set.
 */
const REQUIRED_SETTINGS = [
  { key: "ai.provider", value: "openai", category: "ai", label: "AI Provider" },
  { key: "ai.model", value: "gpt-5", category: "ai", label: "AI Assistant Model" },
  { key: "marketing.defaultCampaignType", value: "digital", category: "marketing", label: "Default Campaign Type" },
  { key: "marketing.defaultChannelType", value: "digital", category: "marketing", label: "Default Channel Type" },
  { key: "marketing.autoCreateLeads", value: "true", category: "marketing", label: "Auto-create Leads from Campaigns" },

  /*
   * Business policies the system enforces. The values below are the ones the
   * business decided; they are seeded here because this is the single place
   * the engines read them from, and an admin can revise them without a deploy.
   *
   * They are values, not defaults. Nothing in the code falls back to a number
   * of its own if a row is emptied — each engine treats an empty policy as
   * "not decided" and declines to act rather than inventing one.
   */

  /*
   * The approval ceiling: 10,000.
   *
   * Expressed as `default` rather than against a named permission, because
   * that is what the decision says — no level may approve above the ceiling.
   * A per-permission entry would create a second, higher tier, and inventing
   * tiers is exactly what the decision forbids. Anything above the ceiling
   * takes the higher path the system already has: Owner Mode, which requires
   * an owner-tier account to re-authenticate and is audited as its own act.
   */
  {
    key: "approvals.limits",
    value: '{"default":10000}',
    category: "approvals",
    label: "Approval Limit — maximum amount any approver may approve (EGP)",
  },

  /*
   * Supplier evaluation weighting, summing to 100.
   *
   * `service` is the contractual-commitment-and-service criterion and
   * `compliance` covers safety, documents and compliance.
   */
  {
    key: "procurement.supplierEvaluationWeights",
    value: '{"price":30,"quality":25,"delivery":20,"service":15,"compliance":10}',
    category: "procurement",
    label: "Supplier Evaluation Weights (price/quality/delivery/service/compliance, total 100)",
  },

  /*
   * The time half of the vehicle service rule: six months.
   *
   * The distance and running-hours halves are per vehicle, on the vehicle
   * record, because they depend on the machine rather than on the policy —
   * and no general value for them is invented here.
   */
  {
    key: "fleet.serviceIntervalMonths",
    value: "6",
    category: "fleet",
    label: "Vehicle Service Interval — months between services",
  },
];

async function ensureRequiredSettings(): Promise<void> {
  await db.insert(settingsTable).values(REQUIRED_SETTINGS).onConflictDoNothing();
}

router.get("/settings", requirePermission("settings.view"), async (_req, res): Promise<void> => {
  await ensureRequiredSettings();
  const rows = await db.select().from(settingsTable).orderBy(settingsTable.category);
  res.json(ListSettingsResponse.parse(rows.map(toSetting)));
});

router.patch("/settings", requirePermission("settings.update"), async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  for (const item of parsed.data.settings) {
    await db
      .update(settingsTable)
      .set({ value: item.value })
      .where(eq(settingsTable.key, item.key));
  }
  await recordAudit(req, {
    action: "update",
    entity: "settings",
    newValue: parsed.data.settings,
  });
  const rows = await db.select().from(settingsTable).orderBy(settingsTable.category);
  res.json(ListSettingsResponse.parse(rows.map(toSetting)));
});

export default router;
