import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, branchesTable, companiesTable } from "@workspace/db";
import {
  ListBranchesResponse,
  CreateBranchBody,
  UpdateBranchBody,
} from "@workspace/api-zod";
import { toBranch } from "../lib/presenters";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/branches", requirePermission("branches.view"), async (req, res): Promise<void> => {
  const companyId = typeof req.query.companyId === "string" ? req.query.companyId : "";
  const filters = [eq(branchesTable.isDeleted, false)];
  if (companyId) filters.push(eq(branchesTable.companyId, companyId));

  const rows = await db
    .select({ branch: branchesTable, companyName: companiesTable.name })
    .from(branchesTable)
    .leftJoin(companiesTable, eq(companiesTable.id, branchesTable.companyId))
    .where(and(...filters))
    .orderBy(branchesTable.createdAt);
  res.json(ListBranchesResponse.parse(rows.map((r) => toBranch(r.branch, r.companyName))));
});

router.post("/branches", requirePermission("branches.create"), async (req, res): Promise<void> => {
  const parsed = CreateBranchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(branchesTable)
    .values({
      companyId: parsed.data.companyId,
      code: parsed.data.code,
      name: parsed.data.name,
      nameAr: parsed.data.nameAr,
      manager: parsed.data.manager ?? null,
      phone: parsed.data.phone ?? null,
      address: parsed.data.address ?? null,
    })
    .returning();
  const [company] = await db
    .select({ name: companiesTable.name })
    .from(companiesTable)
    .where(eq(companiesTable.id, row.companyId));
  await recordAudit(req, { action: "create", entity: "branch", entityId: row.id, newValue: row });
  res.status(201).json(toBranch(row, company?.name ?? null));
});

router.patch("/branches/:id", requirePermission("branches.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateBranchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(branchesTable)
    .where(and(eq(branchesTable.id, id), eq(branchesTable.isDeleted, false)));
  if (!existing) {
    res.status(404).json({ error: "Branch not found" });
    return;
  }
  const update: Record<string, unknown> = {};
  for (const key of ["code", "name", "nameAr", "manager", "phone", "address"] as const) {
    if (parsed.data[key] !== undefined) update[key] = parsed.data[key];
  }
  const [row] = Object.keys(update).length
    ? await db.update(branchesTable).set(update).where(eq(branchesTable.id, id)).returning()
    : [existing];
  const [company] = await db
    .select({ name: companiesTable.name })
    .from(companiesTable)
    .where(eq(companiesTable.id, row.companyId));
  await recordAudit(req, {
    action: "update",
    entity: "branch",
    entityId: id,
    oldValue: existing,
    newValue: row,
  });
  res.json(toBranch(row, company?.name ?? null));
});

router.delete("/branches/:id", requirePermission("branches.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db
    .update(branchesTable)
    .set({ isDeleted: true, isActive: false })
    .where(and(eq(branchesTable.id, id), eq(branchesTable.isDeleted, false)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Branch not found" });
    return;
  }
  await recordAudit(req, { action: "delete", entity: "branch", entityId: id });
  res.json({ success: true });
});

export default router;
