import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, fiscalYearsTable } from "@workspace/db";
import {
  ListFiscalYearsResponse,
  CreateFiscalYearBody,
  UpdateFiscalYearBody,
} from "@workspace/api-zod";
import { toFiscalYear } from "../lib/presenters";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/fiscal-years", requirePermission("fiscalYears.view"), async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(fiscalYearsTable)
    .where(eq(fiscalYearsTable.isDeleted, false))
    .orderBy(fiscalYearsTable.startDate);
  res.json(ListFiscalYearsResponse.parse(rows.map(toFiscalYear)));
});

router.post("/fiscal-years", requirePermission("fiscalYears.create"), async (req, res): Promise<void> => {
  const parsed = CreateFiscalYearBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(fiscalYearsTable)
    .values({
      companyId: parsed.data.companyId ?? null,
      name: parsed.data.name,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      status: parsed.data.status ?? "open",
    })
    .returning();
  await recordAudit(req, { action: "create", entity: "fiscalYear", entityId: row.id, newValue: row });
  res.status(201).json(toFiscalYear(row));
});

router.patch("/fiscal-years/:id", requirePermission("fiscalYears.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateFiscalYearBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(fiscalYearsTable)
    .where(and(eq(fiscalYearsTable.id, id), eq(fiscalYearsTable.isDeleted, false)));
  if (!existing) {
    res.status(404).json({ error: "Fiscal year not found" });
    return;
  }
  const update: Record<string, unknown> = {};
  for (const key of ["name", "startDate", "endDate", "status"] as const) {
    if (parsed.data[key] !== undefined) update[key] = parsed.data[key];
  }
  const [row] = Object.keys(update).length
    ? await db.update(fiscalYearsTable).set(update).where(eq(fiscalYearsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, {
    action: "update",
    entity: "fiscalYear",
    entityId: id,
    oldValue: existing,
    newValue: row,
  });
  res.json(toFiscalYear(row));
});

router.delete("/fiscal-years/:id", requirePermission("fiscalYears.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db
    .update(fiscalYearsTable)
    .set({ isDeleted: true, isActive: false })
    .where(and(eq(fiscalYearsTable.id, id), eq(fiscalYearsTable.isDeleted, false)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Fiscal year not found" });
    return;
  }
  await recordAudit(req, { action: "delete", entity: "fiscalYear", entityId: id });
  res.json({ success: true });
});

export default router;
