import { Router, type IRouter } from "express";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import {
  db,
  printJobsTable,
  formTemplatesTable,
  formTemplateVersionsTable,
} from "@workspace/db";
import { CreatePrintJobBody, ListPrintJobsResponse } from "@workspace/api-zod";
import { requireAuth, requirePermission } from "../middleware/auth";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { renderDocument } from "./form-templates";

type Row = Record<string, unknown>;

const MODULE = "formTemplates";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/print-jobs", requirePermission(`${MODULE}.view`), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(printJobsTable.isDeleted, false)];
  for (const c of ["companyId", "moduleKey", "templateId", "entityId"] as const) {
    const v = qStr(q, c);
    if (v) filters.push(eq(printJobsTable[c], v));
  }
  const where = and(...filters);
  const countRes = (await db
    .select({ count: sql<number>`count(*)::int` })
    .from(printJobsTable)
    .where(where)) as { count: number }[];
  const rows = (await db
    .select()
    .from(printJobsTable)
    .where(where)
    .orderBy(desc(printJobsTable.printedAt))
    .limit(pageSize)
    .offset(offset)) as Row[];
  res.json(
    ListPrintJobsResponse.parse({
      data: rows.map(serializeRow),
      total: countRes[0].count,
      page,
      pageSize,
    }),
  );
});

router.post("/print-jobs", requirePermission(`${MODULE}.print`), async (req, res): Promise<void> => {
  const parsed = CreatePrintJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const body = parsed.data;

  const templateRows = (await db
    .select()
    .from(formTemplatesTable)
    .where(
      and(eq(formTemplatesTable.id, body.templateId), eq(formTemplatesTable.isDeleted, false)),
    )) as Row[];
  const template = templateRows[0];
  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  if (template.status === "disabled") {
    res.status(409).json({ error: "This template is disabled and cannot be printed." });
    return;
  }
  // Printing always uses the latest approved version, pinned onto the job.
  if (!template.currentVersionId) {
    res.status(409).json({ error: "This template has no approved version to print." });
    return;
  }
  const versionRows = (await db
    .select()
    .from(formTemplateVersionsTable)
    .where(eq(formTemplateVersionsTable.id, String(template.currentVersionId)))) as Row[];
  const version = versionRows[0];
  if (!version) {
    res.status(409).json({ error: "Approved version is unavailable." });
    return;
  }

  const language = body.language || "ar";
  const entityType = body.entityType ?? null;
  const entityId = body.entityId ?? null;

  // Reprint detection is per (template, entity): the running ordinal across all
  // prints of the same document.
  const seqFilters: SQL[] = [
    eq(printJobsTable.isDeleted, false),
    eq(printJobsTable.templateId, body.templateId),
  ];
  if (entityId) seqFilters.push(eq(printJobsTable.entityId, entityId));
  else seqFilters.push(sql`${printJobsTable.entityId} is null`);
  const priorRes = (await db
    .select({ count: sql<number>`count(*)::int` })
    .from(printJobsTable)
    .where(and(...seqFilters))) as { count: number }[];
  const printSequence = priorRes[0].count + 1;
  const isReprint = printSequence > 1;

  if (isReprint && !body.reprintReason) {
    res.status(400).json({ error: "A reason is required when reprinting a document." });
    return;
  }

  const html = await renderDocument({
    template,
    version,
    language,
    entityId,
    documentNumber: body.documentNumber ?? null,
  });

  const me = {
    id: req.authUser?.id ?? null,
    name: req.authUser?.fullName || req.authUser?.username || null,
  };
  const job = ((await db
    .insert(printJobsTable)
    .values({
      companyId: String(template.companyId),
      moduleKey: String(template.moduleKey),
      templateId: body.templateId,
      templateVersionId: String(template.currentVersionId),
      entityType,
      entityId,
      documentNumber: body.documentNumber ?? null,
      language,
      copies: body.copies && body.copies > 0 ? body.copies : 1,
      printSequence,
      isReprint,
      reprintReason: body.reprintReason ?? null,
      printedByUserId: me.id,
      printedByUserName: me.name,
    })
    .returning()) as Row[])[0];

  await recordAudit(req, {
    action: isReprint ? "reprint" : "print",
    entity: "printJob",
    entityId: String(job.id),
    newValue: {
      templateId: body.templateId,
      templateVersionId: String(template.currentVersionId),
      entityType,
      entityId,
      printSequence,
      copies: job.copies,
      reason: body.reprintReason ?? null,
    },
  });

  res.status(201).json({ printJob: serializeRow(job), html });
});

export default router;
