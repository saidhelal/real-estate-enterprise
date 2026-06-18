import { Router, type IRouter, type Request, type Response } from "express";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import {
  db,
  formTemplatesTable,
  formTemplateVersionsTable,
  printJobsTable,
  companiesTable,
} from "@workspace/db";
import {
  ListFormTemplatesResponse,
  GetFormTemplateResponse,
  UpdateFormTemplateBody,
  UpdateFormTemplateResponse,
  DisableFormTemplateResponse,
  EnableFormTemplateResponse,
  ListFormTemplateVersionsResponse,
  CreateFormTemplateVersionBody,
  UpdateFormTemplateVersionBody,
  SubmitFormTemplateVersionResponse,
  EndorseFormTemplateVersionResponse,
  ApproveFormTemplateVersionResponse,
  RejectFormTemplateVersionResponse,
  ActivateFormTemplateVersionResponse,
  GetFormBindingCatalogResponse,
  RenderFormTemplateResponse,
  CreateFormTemplateBody,
  ImportFormTemplateBody,
  ImportFormTemplateResponse,
  CreateFormUploadUrlResponse,
} from "@workspace/api-zod";
import { requireAuth, requirePermission } from "../middleware/auth";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { ObjectStorageService } from "../lib/objectStorage";
import {
  getBindingCatalog,
  buildTokenValues,
  renderTemplate,
  fetchEntityRow,
  importDocument,
} from "../lib/print-engine";

type Row = Record<string, unknown>;

const MODULE = "formTemplates";
const objectStorageService = new ObjectStorageService();

const router: IRouter = Router();
router.use(requireAuth);

/** Resolve the acting user's id + display name from the auth context. */
function actor(req: { authUser?: { id: string; username: string; fullName?: string } }): {
  id: string | null;
  name: string | null;
} {
  const u = req.authUser;
  return { id: u?.id ?? null, name: u?.fullName || u?.username || null };
}

async function loadTemplate(id: string): Promise<Row | undefined> {
  const rows = (await db
    .select()
    .from(formTemplatesTable)
    .where(and(eq(formTemplatesTable.id, id), eq(formTemplatesTable.isDeleted, false)))) as Row[];
  return rows[0];
}

async function loadVersions(templateId: string): Promise<Row[]> {
  return (await db
    .select()
    .from(formTemplateVersionsTable)
    .where(
      and(
        eq(formTemplateVersionsTable.templateId, templateId),
        eq(formTemplateVersionsTable.isDeleted, false),
      ),
    )
    .orderBy(desc(formTemplateVersionsTable.versionNumber))) as Row[];
}

function detailOut(template: Row, versions: Row[]): unknown {
  return GetFormTemplateResponse.parse({
    template: serializeRow(template),
    versions: versions.map(serializeRow),
  });
}

/* -------------------------------------------------------------------------- */
/* Templates                                                                  */
/* -------------------------------------------------------------------------- */

router.get("/form-templates", requirePermission(`${MODULE}.view`), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(formTemplatesTable.isDeleted, false)];
  const search = qStr(q, "search");
  if (search) {
    const s = or(
      ilike(formTemplatesTable.code, `%${search}%`),
      ilike(formTemplatesTable.name, `%${search}%`),
    );
    if (s) filters.push(s);
  }
  for (const c of ["companyId", "moduleKey", "documentType", "status"] as const) {
    const v = qStr(q, c);
    if (v) filters.push(eq(formTemplatesTable[c], v));
  }
  const where = and(...filters);
  const countRes = (await db
    .select({ count: sql<number>`count(*)::int` })
    .from(formTemplatesTable)
    .where(where)) as { count: number }[];
  const rows = (await db
    .select()
    .from(formTemplatesTable)
    .where(where)
    .orderBy(desc(formTemplatesTable.createdAt))
    .limit(pageSize)
    .offset(offset)) as Row[];
  res.json(
    ListFormTemplatesResponse.parse({
      data: rows.map(serializeRow),
      total: countRes[0].count,
      page,
      pageSize,
    }),
  );
});

router.post("/form-templates", requirePermission(`${MODULE}.create`), async (req, res): Promise<void> => {
  const parsed = CreateFormTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const body = parsed.data;
  const { template, version } = await db.transaction(async (tx) => {
    const inserted = (await tx
      .insert(formTemplatesTable)
      .values({
        companyId: body.companyId,
        moduleKey: body.moduleKey,
        code: body.code,
        name: body.name,
        nameAr: body.nameAr ?? null,
        description: body.description ?? null,
        documentType: body.documentType ?? "other",
        sourceFormat: body.sourceFormat ?? "html",
        status: "active",
      })
      .returning()) as Row[];
    const tmpl = inserted[0];
    const ver = (await tx
      .insert(formTemplateVersionsTable)
      .values({
        companyId: body.companyId,
        templateId: String(tmpl.id),
        versionNumber: 1,
        content: body.content ?? null,
        contentAr: body.contentAr ?? null,
        fileObjectPath: body.fileObjectPath ?? null,
        fileFormat: body.fileFormat ?? null,
        settings: body.settings ?? null,
        fieldBindings: body.fieldBindings ?? null,
        status: "draft",
        changeSummary: body.changeSummary ?? "Initial version",
      })
      .returning()) as Row[];
    return { template: tmpl, version: ver[0] };
  });
  await recordAudit(req, {
    action: "create",
    entity: "formTemplate",
    entityId: String(template.id),
    newValue: template,
  });
  res.status(201).json(detailOut(template, [version]));
});

router.get(
  "/form-binding-catalog",
  requirePermission(`${MODULE}.view`),
  async (req, res): Promise<void> => {
    const q = req.query as Record<string, unknown>;
    const moduleKey = qStr(q, "moduleKey");
    const documentType = qStr(q, "documentType");
    res.json(
      GetFormBindingCatalogResponse.parse({
        moduleKey,
        documentType: documentType || null,
        groups: getBindingCatalog(moduleKey, documentType || undefined),
      }),
    );
  },
);

router.post(
  "/form-uploads",
  requirePermission(`${MODULE}.create`),
  async (_req, res): Promise<void> => {
    const uploadUrl = await objectStorageService.getObjectEntityUploadURL();
    const filePath = objectStorageService.normalizeObjectEntityPath(uploadUrl);
    res.json(CreateFormUploadUrlResponse.parse({ uploadUrl, filePath }));
  },
);

router.post(
  "/form-template-imports",
  requirePermission(`${MODULE}.create`),
  async (req, res): Promise<void> => {
    const parsed = ImportFormTemplateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { fileObjectPath, fileFormat } = parsed.data;
    try {
      const file = await objectStorageService.getObjectEntityFile(fileObjectPath);
      const [buffer] = await file.download();
      const outcome = await importDocument(buffer, fileFormat);
      res.json(ImportFormTemplateResponse.parse(outcome));
    } catch (err) {
      req.log.error({ err }, "Form template import failed");
      res.status(400).json({ error: "Could not read or convert the uploaded file." });
    }
  },
);

router.get("/form-templates/:id", requirePermission(`${MODULE}.view`), async (req, res): Promise<void> => {
  const template = await loadTemplate(String(req.params.id));
  if (!template) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const versions = await loadVersions(String(template.id));
  res.json(detailOut(template, versions));
});

router.patch("/form-templates/:id", requirePermission(`${MODULE}.update`), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateFormTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await loadTemplate(id);
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const update = { ...parsed.data };
  const row = Object.keys(update).length
    ? ((await db
        .update(formTemplatesTable)
        .set(update)
        .where(eq(formTemplatesTable.id, id))
        .returning()) as Row[])[0]
    : existing;
  await recordAudit(req, {
    action: "update",
    entity: "formTemplate",
    entityId: id,
    oldValue: existing,
    newValue: row,
  });
  res.json(UpdateFormTemplateResponse.parse(serializeRow(row)));
});

router.post(
  "/form-templates/:id/disable",
  requirePermission(`${MODULE}.disable`),
  async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const existing = await loadTemplate(id);
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const reason = typeof req.body?.reason === "string" ? req.body.reason : null;
    const row = ((await db
      .update(formTemplatesTable)
      .set({ status: "disabled", isActive: false })
      .where(eq(formTemplatesTable.id, id))
      .returning()) as Row[])[0];
    await recordAudit(req, {
      action: "disable",
      entity: "formTemplate",
      entityId: id,
      oldValue: { status: existing.status, reason },
      newValue: { status: "disabled" },
    });
    res.json(DisableFormTemplateResponse.parse(serializeRow(row)));
  },
);

router.post(
  "/form-templates/:id/enable",
  requirePermission(`${MODULE}.enable`),
  async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const existing = await loadTemplate(id);
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const reason = typeof req.body?.reason === "string" ? req.body.reason : null;
    const row = ((await db
      .update(formTemplatesTable)
      .set({ status: "active", isActive: true })
      .where(eq(formTemplatesTable.id, id))
      .returning()) as Row[])[0];
    await recordAudit(req, {
      action: "enable",
      entity: "formTemplate",
      entityId: id,
      oldValue: { status: existing.status, reason },
      newValue: { status: "active" },
    });
    res.json(EnableFormTemplateResponse.parse(serializeRow(row)));
  },
);

/* -------------------------------------------------------------------------- */
/* Versions                                                                   */
/* -------------------------------------------------------------------------- */

router.get(
  "/form-templates/:id/versions",
  requirePermission(`${MODULE}.view`),
  async (req, res): Promise<void> => {
    const template = await loadTemplate(String(req.params.id));
    if (!template) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const versions = await loadVersions(String(template.id));
    res.json(ListFormTemplateVersionsResponse.parse({ data: versions.map(serializeRow) }));
  },
);

router.post(
  "/form-templates/:id/versions",
  requirePermission(`${MODULE}.create`),
  async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const parsed = CreateFormTemplateVersionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const body = parsed.data;
    const template = await loadTemplate(id);
    if (!template) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const versions = await loadVersions(id);
    const nextNumber =
      versions.reduce((max, v) => Math.max(max, Number(v.versionNumber) || 0), 0) + 1;
    const row = ((await db
      .insert(formTemplateVersionsTable)
      .values({
        companyId: String(template.companyId),
        templateId: id,
        versionNumber: nextNumber,
        content: body.content ?? null,
        contentAr: body.contentAr ?? null,
        fileObjectPath: body.fileObjectPath ?? null,
        fileFormat: body.fileFormat ?? null,
        settings: body.settings ?? null,
        fieldBindings: body.fieldBindings ?? null,
        status: "draft",
        changeSummary: body.changeSummary ?? null,
        changeReason: body.changeReason ?? null,
      })
      .returning()) as Row[])[0];
    if (body.sourceFormat) {
      await db
        .update(formTemplatesTable)
        .set({ sourceFormat: body.sourceFormat })
        .where(eq(formTemplatesTable.id, id));
    }
    await recordAudit(req, {
      action: "create-version",
      entity: "formTemplateVersion",
      entityId: String(row.id),
      newValue: { templateId: id, versionNumber: nextNumber },
    });
    res.status(201).json(SubmitFormTemplateVersionResponse.parse(serializeRow(row)));
  },
);

async function loadVersion(templateId: string, versionId: string): Promise<Row | undefined> {
  const rows = (await db
    .select()
    .from(formTemplateVersionsTable)
    .where(
      and(
        eq(formTemplateVersionsTable.id, versionId),
        eq(formTemplateVersionsTable.templateId, templateId),
        eq(formTemplateVersionsTable.isDeleted, false),
      ),
    )) as Row[];
  return rows[0];
}

router.patch(
  "/form-templates/:id/versions/:versionId",
  requirePermission(`${MODULE}.update`),
  async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const versionId = String(req.params.versionId);
    const parsed = UpdateFormTemplateVersionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const existing = await loadVersion(id, versionId);
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (existing.status !== "draft" && existing.status !== "rejected") {
      res.status(409).json({ error: "Only draft or rejected versions can be edited." });
      return;
    }
    const update = { ...parsed.data, status: "draft" as const };
    const row = ((await db
      .update(formTemplateVersionsTable)
      .set(update)
      .where(eq(formTemplateVersionsTable.id, versionId))
      .returning()) as Row[])[0];
    await recordAudit(req, {
      action: "update-version",
      entity: "formTemplateVersion",
      entityId: versionId,
      oldValue: existing,
      newValue: row,
    });
    res.json(SubmitFormTemplateVersionResponse.parse(serializeRow(row)));
  },
);

/** Shared transition handler for the approval cycle (submit/endorse/reject). */
function versionTransition(opts: {
  action: string;
  from: string[];
  to: string;
  stamp: (
    me: { id: string | null; name: string | null },
    reason: string | null,
  ) => Record<string, unknown>;
  responseSchema: { parse: (v: unknown) => unknown };
}) {
  return async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const versionId = String(req.params.versionId);
    const existing = await loadVersion(id, versionId);
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!opts.from.includes(String(existing.status))) {
      res
        .status(409)
        .json({ error: `Cannot ${opts.action} a version in status "${existing.status}".` });
      return;
    }
    const me = actor(req);
    const reason = typeof req.body?.reason === "string" ? req.body.reason : null;
    const row = ((await db
      .update(formTemplateVersionsTable)
      .set({ status: opts.to, ...opts.stamp(me, reason) })
      .where(eq(formTemplateVersionsTable.id, versionId))
      .returning()) as Row[])[0];
    await recordAudit(req, {
      action: opts.action,
      entity: "formTemplateVersion",
      entityId: versionId,
      oldValue: { status: existing.status },
      newValue: { status: opts.to, reason },
    });
    res.json(opts.responseSchema.parse(serializeRow(row)));
  };
}

router.post(
  "/form-templates/:id/versions/:versionId/submit",
  requirePermission(`${MODULE}.submit`),
  versionTransition({
    action: "submit",
    from: ["draft", "rejected"],
    to: "submitted",
    stamp: (me) => ({
      submittedByUserId: me.id,
      submittedByUserName: me.name,
      submittedAt: new Date(),
    }),
    responseSchema: SubmitFormTemplateVersionResponse,
  }),
);

router.post(
  "/form-templates/:id/versions/:versionId/endorse",
  requirePermission(`${MODULE}.endorse`),
  versionTransition({
    action: "endorse",
    from: ["submitted"],
    to: "endorsed",
    stamp: (me) => ({
      endorsedByUserId: me.id,
      endorsedByUserName: me.name,
      endorsedAt: new Date(),
    }),
    responseSchema: EndorseFormTemplateVersionResponse,
  }),
);

router.post(
  "/form-templates/:id/versions/:versionId/reject",
  requirePermission(`${MODULE}.reject`),
  versionTransition({
    action: "reject",
    from: ["submitted", "endorsed"],
    to: "rejected",
    stamp: (me, reason) => ({
      rejectedByUserId: me.id,
      rejectedByUserName: me.name,
      rejectedAt: new Date(),
      rejectReason: reason,
    }),
    responseSchema: RejectFormTemplateVersionResponse,
  }),
);

router.post(
  "/form-templates/:id/versions/:versionId/approve",
  requirePermission(`${MODULE}.approve`),
  async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const versionId = String(req.params.versionId);
    const template = await loadTemplate(id);
    if (!template) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const existing = await loadVersion(id, versionId);
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (existing.status !== "submitted" && existing.status !== "endorsed") {
      res
        .status(409)
        .json({ error: `Cannot approve a version in status "${existing.status}".` });
      return;
    }
    const me = actor(req);
    await db.transaction(async (tx) => {
      // Supersede the previously approved/active version (kept forever).
      if (template.currentVersionId) {
        await tx
          .update(formTemplateVersionsTable)
          .set({ status: "superseded" })
          .where(
            and(
              eq(formTemplateVersionsTable.templateId, id),
              eq(formTemplateVersionsTable.id, String(template.currentVersionId)),
            ),
          );
      }
      await tx
        .update(formTemplateVersionsTable)
        .set({
          status: "approved",
          approvedByUserId: me.id,
          approvedByUserName: me.name,
          approvedAt: new Date(),
        })
        .where(eq(formTemplateVersionsTable.id, versionId));
      await tx
        .update(formTemplatesTable)
        .set({ currentVersionId: versionId, status: "active", isActive: true })
        .where(eq(formTemplatesTable.id, id));
    });
    await recordAudit(req, {
      action: "approve",
      entity: "formTemplateVersion",
      entityId: versionId,
      oldValue: { status: existing.status, previousCurrent: template.currentVersionId },
      newValue: { status: "approved", currentVersionId: versionId },
    });
    const fresh = await loadTemplate(id);
    const versions = await loadVersions(id);
    res.json(ApproveFormTemplateVersionResponse.parse({
      template: serializeRow(fresh as Row),
      versions: versions.map(serializeRow),
    }));
  },
);

router.post(
  "/form-templates/:id/versions/:versionId/activate",
  requirePermission(`${MODULE}.activate`),
  async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const versionId = String(req.params.versionId);
    const template = await loadTemplate(id);
    if (!template) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const target = await loadVersion(id, versionId);
    if (!target) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (target.status !== "approved" && target.status !== "superseded") {
      res
        .status(409)
        .json({ error: "Only a previously approved version can be reactivated." });
      return;
    }
    const me = actor(req);
    await db.transaction(async (tx) => {
      if (template.currentVersionId && String(template.currentVersionId) !== versionId) {
        await tx
          .update(formTemplateVersionsTable)
          .set({ status: "superseded" })
          .where(eq(formTemplateVersionsTable.id, String(template.currentVersionId)));
      }
      await tx
        .update(formTemplateVersionsTable)
        .set({
          status: "approved",
          approvedByUserId: me.id,
          approvedByUserName: me.name,
          approvedAt: new Date(),
        })
        .where(eq(formTemplateVersionsTable.id, versionId));
      await tx
        .update(formTemplatesTable)
        .set({ currentVersionId: versionId, status: "active", isActive: true })
        .where(eq(formTemplatesTable.id, id));
    });
    await recordAudit(req, {
      action: "activate-version",
      entity: "formTemplateVersion",
      entityId: versionId,
      oldValue: { previousCurrent: template.currentVersionId },
      newValue: { currentVersionId: versionId },
    });
    const fresh = await loadTemplate(id);
    const versions = await loadVersions(id);
    res.json(ActivateFormTemplateVersionResponse.parse({
      template: serializeRow(fresh as Row),
      versions: versions.map(serializeRow),
    }));
  },
);

/* -------------------------------------------------------------------------- */
/* Render (preview — no print log)                                            */
/* -------------------------------------------------------------------------- */

function pickContent(version: Row, language: string): string {
  const en = typeof version.content === "string" ? version.content : "";
  const ar = typeof version.contentAr === "string" ? version.contentAr : "";
  if (language === "ar") return ar || en;
  return en || ar;
}

async function renderDocument(opts: {
  template: Row;
  version: Row;
  language: string;
  entityId?: string | null;
  documentNumber?: string | null;
}): Promise<string> {
  const { template, version, language } = opts;
  const documentType = String(template.documentType || "");
  let entity: Row | null = null;
  if (opts.entityId && documentType) {
    entity = await fetchEntityRow(documentType, opts.entityId);
  }
  const companyRows = (await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.id, String(template.companyId)))
    .limit(1)) as Row[];
  const values = buildTokenValues({
    company: companyRows[0] ?? null,
    documentNumber: opts.documentNumber ?? null,
    language,
    documentType,
    entity,
  });
  return renderTemplate(pickContent(version, language), values);
}

router.get("/form-renders", requirePermission(`${MODULE}.view`), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const templateId = qStr(q, "templateId");
  const entityId = qStr(q, "entityId");
  const language = qStr(q, "language") || "ar";
  const versionId = qStr(q, "versionId");
  if (!templateId) {
    res.status(400).json({ error: "templateId is required" });
    return;
  }
  const template = await loadTemplate(templateId);
  if (!template) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  let version: Row | undefined;
  if (versionId) {
    version = await loadVersion(templateId, versionId);
  } else if (template.currentVersionId) {
    version = await loadVersion(templateId, String(template.currentVersionId));
  }
  if (!version) {
    res.status(404).json({ error: "No approved version available for printing." });
    return;
  }
  const html = await renderDocument({
    template,
    version,
    language,
    entityId: entityId || null,
  });
  const printCountRes = (await db
    .select({ count: sql<number>`count(*)::int` })
    .from(printJobsTable)
    .where(
      and(
        eq(printJobsTable.templateId, templateId),
        entityId ? eq(printJobsTable.entityId, entityId) : sql`true`,
      ),
    )) as { count: number }[];
  res.json(
    RenderFormTemplateResponse.parse({
      html,
      documentNumber: null,
      templateId,
      templateVersionId: String(version.id),
      versionNumber: Number(version.versionNumber) || 1,
      language,
      moduleKey: String(template.moduleKey),
      documentType: template.documentType ?? null,
      printCount: printCountRes[0].count,
    }),
  );
});

export { renderDocument };
export default router;
