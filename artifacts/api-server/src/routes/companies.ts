import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, companiesTable, branchesTable } from "@workspace/db";
import {
  ListCompaniesResponse,
  CreateCompanyBody,
  GetCompanyResponse,
  UpdateCompanyBody,
} from "@workspace/api-zod";
import { toCompany } from "../lib/presenters";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

/**
 * The company fields a caller may write.
 *
 * An allow-list rather than a spread of the parsed body: `code` is referenced
 * by other records and `isActive`/`isDeleted` are lifecycle state with their
 * own endpoints, so none of them may ride in on a profile edit. Listing the
 * fields once means the create and update paths cannot drift apart as the
 * institutional profile grows.
 */
const COMPANY_EDITABLE_FIELDS = [
  "name",
  "nameAr",
  "taxNumber",
  "email",
  "phone",
  "address",
  "baseCurrency",
  "legalName",
  "legalNameAr",
  "tradeName",
  "legalForm",
  "commercialRegister",
  "website",
  "logoUrl",
  "officialEmail",
  "fax",
  "poBox",
  "representativeName",
  "representativeTitle",
  "printHeader",
  "printFooter",
] as const;

async function branchCounts(): Promise<Map<string, number>> {
  const rows = await db
    .select({ companyId: branchesTable.companyId, count: sql<number>`count(*)::int` })
    .from(branchesTable)
    .where(eq(branchesTable.isDeleted, false))
    .groupBy(branchesTable.companyId);
  return new Map(rows.map((r) => [r.companyId, r.count]));
}

router.get("/companies", requirePermission("companies.view"), async (req, res): Promise<void> => {
  // A user belonging to a company sees that company and no other. Without this
  // the company list — which every screen calls to resolve names — hands every
  // tenant the full register of tenants.
  const scope = req.authUser?.companyId;
  const rows = await db
    .select()
    .from(companiesTable)
    .where(
      scope
        ? and(eq(companiesTable.isDeleted, false), eq(companiesTable.id, scope))
        : eq(companiesTable.isDeleted, false),
    )
    .orderBy(companiesTable.createdAt);
  const counts = await branchCounts();
  res.json(ListCompaniesResponse.parse(rows.map((r) => toCompany(r, counts.get(r.id) ?? 0))));
});

router.post("/companies", requirePermission("companies.create"), async (req, res): Promise<void> => {
  const parsed = CreateCompanyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db
    .select({ id: companiesTable.id })
    .from(companiesTable)
    .where(and(eq(companiesTable.code, parsed.data.code), eq(companiesTable.isDeleted, false)));
  if (existing) {
    res.status(409).json({ error: "Company code already exists" });
    return;
  }
  const values: Record<string, unknown> = { code: parsed.data.code };
  for (const key of COMPANY_EDITABLE_FIELDS) {
    values[key] = parsed.data[key] ?? null;
  }
  const [row] = await db.insert(companiesTable).values(values as never).returning();
  await recordAudit(req, { action: "create", entity: "company", entityId: row.id, newValue: row });
  res.status(201).json(GetCompanyResponse.parse(toCompany(row, 0)));
});

router.get("/companies/:id", requirePermission("companies.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db
    .select()
    .from(companiesTable)
    .where(and(eq(companiesTable.id, id), eq(companiesTable.isDeleted, false)));
  if (!row || (req.authUser?.companyId && row.id !== req.authUser.companyId)) {
    res.status(404).json({ error: "Company not found" });
    return;
  }
  const counts = await branchCounts();
  res.json(GetCompanyResponse.parse(toCompany(row, counts.get(id) ?? 0)));
});

router.patch("/companies/:id", requirePermission("companies.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateCompanyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(companiesTable)
    .where(and(eq(companiesTable.id, id), eq(companiesTable.isDeleted, false)));
  if (!existing || (req.authUser?.companyId && existing.id !== req.authUser.companyId)) {
    res.status(404).json({ error: "Company not found" });
    return;
  }
  const update: Record<string, unknown> = {};
  for (const key of COMPANY_EDITABLE_FIELDS) {
    if (parsed.data[key] !== undefined) update[key] = parsed.data[key];
  }
  const [row] = Object.keys(update).length
    ? await db.update(companiesTable).set(update).where(eq(companiesTable.id, id)).returning()
    : [existing];
  await recordAudit(req, {
    action: "update",
    entity: "company",
    entityId: id,
    oldValue: existing,
    newValue: row,
  });
  const counts = await branchCounts();
  res.json(GetCompanyResponse.parse(toCompany(row, counts.get(id) ?? 0)));
});

router.delete("/companies/:id", requirePermission("companies.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db
    .update(companiesTable)
    .set({ isDeleted: true, isActive: false })
    .where(and(eq(companiesTable.id, id), eq(companiesTable.isDeleted, false)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Company not found" });
    return;
  }
  await recordAudit(req, { action: "delete", entity: "company", entityId: id });
  res.json({ success: true });
});

export default router;
