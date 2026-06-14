import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import { ListSettingsResponse, UpdateSettingsBody } from "@workspace/api-zod";
import { toSetting } from "../lib/presenters";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/settings", requirePermission("settings.view"), async (_req, res): Promise<void> => {
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
