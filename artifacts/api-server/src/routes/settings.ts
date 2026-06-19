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
