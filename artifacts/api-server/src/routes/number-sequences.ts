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
import { previewNumber, sequenceShapeFor } from "../lib/doc-number";
import { PreviewNextNumberResponse } from "@workspace/api-zod";
import { qStr } from "../lib/serialize";

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


/**
 * What the system would issue next for a document type.
 *
 * Read-only by construction: it reads the counter and formats a value, and
 * writes nothing. Opening a create form a hundred times must not burn a
 * hundred numbers, so the reservation stays where it belongs — on the create
 * itself, inside the same transaction as the row.
 *
 * This means the previewed value is a *forecast*, not a promise. If someone
 * else saves first, the next caller is issued the following number and the
 * form shows what was actually issued. That is the honest behaviour: the
 * alternative, handing out reservations on form-open, leaks numbers every time
 * a user changes their mind.
 *
 * Company comes from the session, never the query string — otherwise this
 * would report another tenant's document volume.
 */
router.get("/number-preview", requirePermission("numberSequences.view"), async (req, res): Promise<void> => {
  const documentType = qStr(req.query as Record<string, unknown>, "documentType");
  if (!documentType) {
    res.status(400).json({ error: "documentType is required" });
    return;
  }
  const companyId = req.authUser?.companyId ?? null;
  const shape = await sequenceShapeFor(documentType, companyId);
  const code = await previewNumber(documentType, companyId);
  res.json(
    PreviewNextNumberResponse.parse({
      documentType,
      companyId,
      prefix: shape.prefix,
      periodYear: shape.periodYear,
      nextNumber: shape.nextNumber,
      code,
      generated: true,
    }),
  );
});

export default router;
