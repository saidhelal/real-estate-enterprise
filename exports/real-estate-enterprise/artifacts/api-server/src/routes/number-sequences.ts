import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, numberSequencesTable } from "@workspace/db";
import {
  ListNumberSequencesResponse,
  CreateNumberSequenceBody,
  UpdateNumberSequenceBody,
} from "@workspace/api-zod";
import { toNumberSequence } from "../lib/presenters";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/number-sequences", requirePermission("numberSequences.view"), async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(numberSequencesTable)
    .where(eq(numberSequencesTable.isDeleted, false))
    .orderBy(numberSequencesTable.documentType);
  res.json(ListNumberSequencesResponse.parse(rows.map(toNumberSequence)));
});

router.post("/number-sequences", requirePermission("numberSequences.create"), async (req, res): Promise<void> => {
  const parsed = CreateNumberSequenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(numberSequencesTable)
    .values({
      documentType: parsed.data.documentType,
      prefix: parsed.data.prefix,
      nextNumber: parsed.data.nextNumber ?? 1,
      padding: parsed.data.padding,
      resetYearly: parsed.data.resetYearly ?? false,
      companyId: parsed.data.companyId ?? null,
    })
    .returning();
  await recordAudit(req, {
    action: "create",
    entity: "numberSequence",
    entityId: row.id,
    newValue: row,
  });
  res.status(201).json(toNumberSequence(row));
});

router.patch("/number-sequences/:id", requirePermission("numberSequences.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateNumberSequenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(numberSequencesTable)
    .where(and(eq(numberSequencesTable.id, id), eq(numberSequencesTable.isDeleted, false)));
  if (!existing) {
    res.status(404).json({ error: "Number sequence not found" });
    return;
  }
  const update: Record<string, unknown> = {};
  for (const key of ["prefix", "nextNumber", "padding", "resetYearly"] as const) {
    if (parsed.data[key] !== undefined) update[key] = parsed.data[key];
  }
  const [row] = Object.keys(update).length
    ? await db.update(numberSequencesTable).set(update).where(eq(numberSequencesTable.id, id)).returning()
    : [existing];
  await recordAudit(req, {
    action: "update",
    entity: "numberSequence",
    entityId: id,
    oldValue: existing,
    newValue: row,
  });
  res.json(toNumberSequence(row));
});

router.delete("/number-sequences/:id", requirePermission("numberSequences.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db
    .update(numberSequencesTable)
    .set({ isDeleted: true, isActive: false })
    .where(and(eq(numberSequencesTable.id, id), eq(numberSequencesTable.isDeleted, false)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Number sequence not found" });
    return;
  }
  await recordAudit(req, { action: "delete", entity: "numberSequence", entityId: id });
  res.json({ success: true });
});

export default router;
