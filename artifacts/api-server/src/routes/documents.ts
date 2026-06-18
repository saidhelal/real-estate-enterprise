import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { and, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import {
  db,
  documentsTable,
  documentVersionsTable,
  documentLinksTable,
  documentObjectOwnersTable,
} from "@workspace/db";
import {
  ListDocumentsResponse,
  CreateDocumentBody,
  GetDocumentResponse,
  UpdateDocumentBody,
  UpdateDocumentResponse,
  DeleteDocumentResponse,
  CreateDocumentUploadUrlBody,
  CreateDocumentUploadUrlResponse,
  ListDocumentVersionsResponse,
  CreateDocumentVersionBody,
  RevertDocumentVersionResponse,
  CompareDocumentVersionsResponse,
  SubmitDocumentBody,
  SubmitDocumentResponse,
  EndorseDocumentResponse,
  ApproveDocumentResponse,
  RejectDocumentResponse,
  ArchiveDocumentResponse,
  RestoreDocumentResponse,
  ActivateDocumentResponse,
  RequestDocumentDeleteResponse,
  SetDocumentSignatureBody,
  SetDocumentSignatureResponse,
  ListDocumentLinksResponse,
  CreateDocumentLinkBody,
  DeleteDocumentLinkResponse,
  ListModuleDocumentsResponse,
  GetDocumentsDashboardResponse,
  ScanDocumentExpiryBody,
  ScanDocumentExpiryResponse,
} from "@workspace/api-zod";
import { requireAuth, requirePermission } from "../middleware/auth";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import {
  MODULE,
  generateDocumentNumber,
  documentScopeFilter,
  canSeeDocument,
  presentDocument,
  presentVersion,
  loadVersions,
  notifyUser,
  scanDocumentExpiry,
} from "../lib/edms";

type Row = Record<string, unknown>;

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

async function loadDocument(id: string): Promise<Row | undefined> {
  const rows = (await db
    .select()
    .from(documentsTable)
    .where(and(eq(documentsTable.id, id), eq(documentsTable.isDeleted, false)))) as Row[];
  return rows[0];
}

async function loadLinks(documentId: string): Promise<Row[]> {
  return (await db
    .select()
    .from(documentLinksTable)
    .where(
      and(
        eq(documentLinksTable.documentId, documentId),
        eq(documentLinksTable.isDeleted, false),
      ),
    )
    .orderBy(desc(documentLinksTable.createdAt))) as Row[];
}

/* -------------------------------------------------------------------------- */
/* Upload URL                                                                 */
/* -------------------------------------------------------------------------- */

router.post(
  "/document-uploads",
  requirePermission(`${MODULE}.create`),
  async (req, res): Promise<void> => {
    const parsed = CreateDocumentUploadUrlBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const uploadUrl = await objectStorageService.getObjectEntityUploadURL();
    const filePath = objectStorageService.normalizeObjectEntityPath(uploadUrl);
    // Record an immutable owner mapping so serving can authorize against the
    // path the server actually minted, not a forgeable client reference.
    await db.insert(documentObjectOwnersTable).values({
      objectPath: filePath,
      purpose: "version",
      uploadedByUserId: actor(req).id,
    });
    res.json(CreateDocumentUploadUrlResponse.parse({ uploadUrl, filePath }));
  },
);

/* -------------------------------------------------------------------------- */
/* List + create                                                              */
/* -------------------------------------------------------------------------- */

router.get("/documents", requirePermission(`${MODULE}.view`), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(documentsTable.isDeleted, false)];

  const includeArchived = qStr(q, "includeArchived") === "true";
  if (!includeArchived) {
    filters.push(sql`${documentsTable.status} <> 'archived'`);
  }

  const search = qStr(q, "search");
  if (search) {
    const s = or(
      ilike(documentsTable.name, `%${search}%`),
      ilike(documentsTable.nameAr, `%${search}%`),
      ilike(documentsTable.documentNumber, `%${search}%`),
      ilike(documentsTable.description, `%${search}%`),
      ilike(documentsTable.sourceRef, `%${search}%`),
    );
    if (s) filters.push(s);
  }
  for (const c of [
    "companyId",
    "status",
    "documentType",
    "classification",
    "moduleKey",
    "sourceId",
    "customerId",
    "projectId",
    "unitId",
    "departmentId",
    "branchId",
    "ownerUserId",
  ] as const) {
    const v = qStr(q, c);
    if (v) filters.push(eq(documentsTable[c], v));
  }
  const dateFrom = qStr(q, "dateFrom");
  const dateTo = qStr(q, "dateTo");
  if (dateFrom) filters.push(gte(documentsTable.creationDate, dateFrom));
  if (dateTo) filters.push(lte(documentsTable.creationDate, dateTo));

  const scope = documentScopeFilter(req.authUser!);
  if (scope) filters.push(scope);

  const where = and(...filters);
  const countRes = (await db
    .select({ count: sql<number>`count(*)::int` })
    .from(documentsTable)
    .where(where)) as { count: number }[];
  const rows = (await db
    .select()
    .from(documentsTable)
    .where(where)
    .orderBy(desc(documentsTable.createdAt))
    .limit(pageSize)
    .offset(offset)) as Row[];

  const ids = rows.map((r) => String(r.id));
  const versions = ids.length
    ? ((await db
        .select()
        .from(documentVersionsTable)
        .where(
          and(
            inArray(documentVersionsTable.documentId, ids),
            eq(documentVersionsTable.isDeleted, false),
          ),
        )) as Row[])
    : [];
  const byDoc = new Map<string, Row[]>();
  for (const v of versions) {
    const key = String(v.documentId);
    const list = byDoc.get(key) ?? [];
    list.push(v);
    byDoc.set(key, list);
  }

  // fileFormat filter is applied against the live version after enrichment.
  const fileFormat = qStr(q, "fileFormat");
  let data = rows.map((r) => presentDocument(r, byDoc.get(String(r.id)) ?? []));
  if (fileFormat) data = data.filter((d) => d.currentFileFormat === fileFormat);

  res.json(
    ListDocumentsResponse.parse({
      data,
      total: countRes[0].count,
      page,
      pageSize,
    }),
  );
});

router.post("/documents", requirePermission(`${MODULE}.create`), async (req, res): Promise<void> => {
  const parsed = CreateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const body = parsed.data;
  const me = actor(req);
  const documentNumber = await generateDocumentNumber(body.companyId);

  const { doc, versions } = await db.transaction(async (tx) => {
    const inserted = (await tx
      .insert(documentsTable)
      .values({
        companyId: body.companyId,
        documentNumber,
        name: body.name,
        nameAr: body.nameAr ?? null,
        description: body.description ?? null,
        documentType: body.documentType ?? "other",
        classification: body.classification ?? "internal",
        moduleKey: body.moduleKey ?? null,
        sourceId: body.sourceId ?? null,
        sourceRef: body.sourceRef ?? null,
        projectId: body.projectId ?? null,
        customerId: body.customerId ?? null,
        unitId: body.unitId ?? null,
        departmentId: body.departmentId ?? null,
        branchId: body.branchId ?? null,
        status: "draft",
        creationDate: body.creationDate ?? null,
        expiryDate: body.expiryDate ?? null,
        tags: body.tags ?? null,
        qrValue: documentNumber,
        barcodeValue: documentNumber,
        ownerUserId: me.id,
        createdByUserId: me.id,
        createdByUserName: me.name,
      })
      .returning()) as Row[];
    const created = inserted[0];

    let vlist: Row[] = [];
    if (body.fileObjectPath) {
      const ver = (await tx
        .insert(documentVersionsTable)
        .values({
          companyId: body.companyId,
          documentId: String(created.id),
          versionNumber: 1,
          fileObjectPath: body.fileObjectPath,
          fileName: body.fileName ?? null,
          fileFormat: body.fileFormat ?? null,
          mimeType: body.mimeType ?? null,
          fileSize: body.fileSize ?? null,
          changeSummary: body.changeSummary ?? "Initial version",
          uploadedByUserId: me.id,
          uploadedByUserName: me.name,
        })
        .returning()) as Row[];
      await tx
        .update(documentsTable)
        .set({ currentVersionId: String(ver[0].id) })
        .where(eq(documentsTable.id, String(created.id)));
      await tx
        .update(documentObjectOwnersTable)
        .set({ documentId: String(created.id), companyId: body.companyId })
        .where(eq(documentObjectOwnersTable.objectPath, body.fileObjectPath));
      vlist = ver;
      created.currentVersionId = String(ver[0].id);
    }
    return { doc: created, versions: vlist };
  });

  await recordAudit(req, {
    action: "create",
    entity: "document",
    entityId: String(doc.id),
    newValue: { documentNumber, name: body.name },
  });
  res.status(201).json(presentDocument(doc, versions));
});

/* -------------------------------------------------------------------------- */
/* Module documents (reusable panel feed) + dashboard + expiry scan           */
/* -------------------------------------------------------------------------- */

router.get(
  "/module-documents",
  requirePermission(`${MODULE}.view`),
  async (req, res): Promise<void> => {
    const q = req.query as Record<string, unknown>;
    const { page, pageSize, offset } = pageParams(q);
    const moduleKey = qStr(q, "moduleKey");
    const sourceId = qStr(q, "sourceId");
    if (!moduleKey || !sourceId) {
      res.status(400).json({ error: "moduleKey and sourceId are required." });
      return;
    }
    // A document is linked to a record either via its own primary link
    // (documents.moduleKey/sourceId) or via an additional document_links row.
    const linkedIds = (await db
      .select({ documentId: documentLinksTable.documentId })
      .from(documentLinksTable)
      .where(
        and(
          eq(documentLinksTable.moduleKey, moduleKey),
          eq(documentLinksTable.sourceId, sourceId),
          eq(documentLinksTable.isDeleted, false),
        ),
      )) as { documentId: string }[];
    const idSet = linkedIds.map((l) => l.documentId);

    const filters: SQL[] = [eq(documentsTable.isDeleted, false)];
    const companyId = qStr(q, "companyId");
    if (companyId) filters.push(eq(documentsTable.companyId, companyId));
    const primary = and(
      eq(documentsTable.moduleKey, moduleKey),
      eq(documentsTable.sourceId, sourceId),
    );
    const linkMatch = idSet.length
      ? or(primary, inArray(documentsTable.id, idSet))
      : primary;
    if (linkMatch) filters.push(linkMatch);
    const scope = documentScopeFilter(req.authUser!);
    if (scope) filters.push(scope);

    const where = and(...filters);
    const countRes = (await db
      .select({ count: sql<number>`count(*)::int` })
      .from(documentsTable)
      .where(where)) as { count: number }[];
    const rows = (await db
      .select()
      .from(documentsTable)
      .where(where)
      .orderBy(desc(documentsTable.createdAt))
      .limit(pageSize)
      .offset(offset)) as Row[];

    const ids = rows.map((r) => String(r.id));
    const versions = ids.length
      ? ((await db
          .select()
          .from(documentVersionsTable)
          .where(
            and(
              inArray(documentVersionsTable.documentId, ids),
              eq(documentVersionsTable.isDeleted, false),
            ),
          )) as Row[])
      : [];
    const byDoc = new Map<string, Row[]>();
    for (const v of versions) {
      const key = String(v.documentId);
      const list = byDoc.get(key) ?? [];
      list.push(v);
      byDoc.set(key, list);
    }

    res.json(
      ListModuleDocumentsResponse.parse({
        data: rows.map((r) => presentDocument(r, byDoc.get(String(r.id)) ?? [])),
        total: countRes[0].count,
        page,
        pageSize,
      }),
    );
  },
);

router.get(
  "/documents-dashboard",
  requirePermission(`${MODULE}.view`),
  async (req, res): Promise<void> => {
    const q = req.query as Record<string, unknown>;
    const filters: SQL[] = [eq(documentsTable.isDeleted, false)];
    const companyId = qStr(q, "companyId");
    if (companyId) filters.push(eq(documentsTable.companyId, companyId));
    const scope = documentScopeFilter(req.authUser!);
    if (scope) filters.push(scope);
    const base = and(...filters);

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [totals] = (await db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${documentsTable.status} = 'active')::int`,
        archived: sql<number>`count(*) filter (where ${documentsTable.status} = 'archived')::int`,
        expired: sql<number>`count(*) filter (where ${documentsTable.status} = 'expired')::int`,
        pendingApproval: sql<number>`count(*) filter (where ${documentsTable.status} = 'review')::int`,
        recentlyAdded: sql<number>`count(*) filter (where ${documentsTable.createdAt} >= ${since.toISOString()})::int`,
      })
      .from(documentsTable)
      .where(base)) as {
      total: number;
      active: number;
      archived: number;
      expired: number;
      pendingApproval: number;
      recentlyAdded: number;
    }[];

    const moduleRows = (await db
      .select({
        moduleKey: documentsTable.moduleKey,
        count: sql<number>`count(*)::int`,
      })
      .from(documentsTable)
      .where(and(base, sql`${documentsTable.moduleKey} is not null`))
      .groupBy(documentsTable.moduleKey)
      .orderBy(sql`count(*) desc`)) as { moduleKey: string | null; count: number }[];

    const recentRows = (await db
      .select()
      .from(documentsTable)
      .where(base)
      .orderBy(desc(documentsTable.createdAt))
      .limit(10)) as Row[];
    const recentIds = recentRows.map((r) => String(r.id));
    const recentVersions = recentIds.length
      ? ((await db
          .select()
          .from(documentVersionsTable)
          .where(
            and(
              inArray(documentVersionsTable.documentId, recentIds),
              eq(documentVersionsTable.isDeleted, false),
            ),
          )) as Row[])
      : [];
    const byDoc = new Map<string, Row[]>();
    for (const v of recentVersions) {
      const key = String(v.documentId);
      const list = byDoc.get(key) ?? [];
      list.push(v);
      byDoc.set(key, list);
    }

    res.json(
      GetDocumentsDashboardResponse.parse({
        totals,
        byModule: moduleRows
          .filter((m) => m.moduleKey)
          .map((m) => ({ moduleKey: String(m.moduleKey), count: m.count })),
        recent: recentRows.map((r) => presentDocument(r, byDoc.get(String(r.id)) ?? [])),
      }),
    );
  },
);

router.post(
  "/documents-expiry-scan",
  requirePermission(`${MODULE}.update`),
  async (req, res): Promise<void> => {
    const parsed = ScanDocumentExpiryBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const companyId = qStr(req.query as Record<string, unknown>, "companyId");
    if (!companyId) {
      res.status(400).json({ error: "companyId is required." });
      return;
    }
    const nearDays = parsed.data.nearDays ?? 30;
    const result = await scanDocumentExpiry(companyId, nearDays, actor(req).id);
    await recordAudit(req, {
      action: "expiry-scan",
      entity: "document",
      newValue: result,
    });
    res.json(ScanDocumentExpiryResponse.parse(result));
  },
);

/* -------------------------------------------------------------------------- */
/* Detail / update / delete                                                   */
/* -------------------------------------------------------------------------- */

router.get("/documents/:id", requirePermission(`${MODULE}.view`), async (req, res): Promise<void> => {
  const doc = await loadDocument(String(req.params.id));
  if (!doc) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!canSeeDocument(req.authUser!, doc)) {
    res.status(403).json({ error: "You do not have access to this document." });
    return;
  }
  const versions = await loadVersions(String(doc.id));
  const links = await loadLinks(String(doc.id));
  res.json(
    GetDocumentResponse.parse({
      document: presentDocument(doc, versions),
      versions: versions.map((v) => presentVersion(v, doc.currentVersionId)),
      links: links.map(serializeRow),
    }),
  );
});

router.patch(
  "/documents/:id",
  requirePermission(`${MODULE}.update`),
  async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const parsed = UpdateDocumentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const existing = await loadDocument(id);
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!canSeeDocument(req.authUser!, existing)) {
      res.status(403).json({ error: "You do not have access to this document." });
      return;
    }
    const me = actor(req);
    const update: Record<string, unknown> = {
      ...parsed.data,
      lastEditedByUserId: me.id,
      lastEditedByUserName: me.name,
    };
    const row = ((await db
      .update(documentsTable)
      .set(update)
      .where(eq(documentsTable.id, id))
      .returning()) as Row[])[0];
    await recordAudit(req, {
      action: "update",
      entity: "document",
      entityId: id,
      oldValue: existing,
      newValue: row,
    });
    const versions = await loadVersions(id);
    res.json(UpdateDocumentResponse.parse(presentDocument(row, versions)));
  },
);

router.delete(
  "/documents/:id",
  requirePermission(`${MODULE}.delete`),
  async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const existing = await loadDocument(id);
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!canSeeDocument(req.authUser!, existing)) {
      res.status(403).json({ error: "You do not have access to this document." });
      return;
    }
    // Delete governance is enforced globally by `governanceMiddleware`: a direct
    // DELETE is never executed here — it is parked as a pending change request and
    // only an Owner / Super Admin (`approvals.approve`) may approve it, which
    // re-dispatches this handler internally. So we only ever soft-delete (the
    // module never hard-deletes). We must NOT additionally gate on the document's
    // own `deleteRequestedAt`/owner: the approved re-dispatch runs authenticated
    // as the approver, and that EDMS-native request flag is independent of the
    // change-request approval that already authorized this call — gating on it
    // here would reject every legitimately approved deletion.
    await db
      .update(documentsTable)
      .set({ isDeleted: true, isActive: false })
      .where(eq(documentsTable.id, id));
    await recordAudit(req, {
      action: "delete",
      entity: "document",
      entityId: id,
      oldValue: { status: existing.status, documentNumber: existing.documentNumber },
    });
    res.json(DeleteDocumentResponse.parse({ success: true }));
  },
);

/* -------------------------------------------------------------------------- */
/* Versions                                                                   */
/* -------------------------------------------------------------------------- */

router.get(
  "/documents/:id/versions",
  requirePermission(`${MODULE}.view`),
  async (req, res): Promise<void> => {
    const doc = await loadDocument(String(req.params.id));
    if (!doc) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!canSeeDocument(req.authUser!, doc)) {
      res.status(403).json({ error: "You do not have access to this document." });
      return;
    }
    const versions = await loadVersions(String(doc.id));
    res.json(
      ListDocumentVersionsResponse.parse({
        data: versions.map((v) => presentVersion(v, doc.currentVersionId)),
      }),
    );
  },
);

router.post(
  "/documents/:id/versions",
  requirePermission(`${MODULE}.update`),
  async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const parsed = CreateDocumentVersionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const body = parsed.data;
    const doc = await loadDocument(id);
    if (!doc) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!canSeeDocument(req.authUser!, doc)) {
      res.status(403).json({ error: "You do not have access to this document." });
      return;
    }
    const me = actor(req);
    const existing = await loadVersions(id);
    const nextNumber =
      existing.reduce((max, v) => Math.max(max, Number(v.versionNumber) || 0), 0) + 1;

    const row = await db.transaction(async (tx) => {
      const ver = (await tx
        .insert(documentVersionsTable)
        .values({
          companyId: String(doc.companyId),
          documentId: id,
          versionNumber: nextNumber,
          fileObjectPath: body.fileObjectPath,
          fileName: body.fileName ?? null,
          fileFormat: body.fileFormat ?? null,
          mimeType: body.mimeType ?? null,
          fileSize: body.fileSize ?? null,
          changeSummary: body.changeSummary ?? null,
          changeReason: body.changeReason ?? null,
          uploadedByUserId: me.id,
          uploadedByUserName: me.name,
        })
        .returning()) as Row[];
      await tx
        .update(documentsTable)
        .set({
          currentVersionId: String(ver[0].id),
          lastEditedByUserId: me.id,
          lastEditedByUserName: me.name,
        })
        .where(eq(documentsTable.id, id));
      await tx
        .update(documentObjectOwnersTable)
        .set({ documentId: id, companyId: String(doc.companyId) })
        .where(eq(documentObjectOwnersTable.objectPath, body.fileObjectPath));
      return ver[0];
    });

    await recordAudit(req, {
      action: "create-version",
      entity: "documentVersion",
      entityId: String(row.id),
      newValue: { documentId: id, versionNumber: nextNumber },
    });
    if (doc.ownerUserId && doc.ownerUserId !== me.id) {
      const ref = String(doc.documentNumber ?? doc.name ?? "");
      await notifyUser({
        companyId: String(doc.companyId),
        recipientUserId: String(doc.ownerUserId),
        actorUserId: me.id,
        eventType: "document_new_version",
        title: `New version added: ${ref}`,
        body: `${me.name} added version ${nextNumber} to ${String(doc.name)}.`,
        sourceId: id,
        sourceRef: ref,
      });
    }
    res.status(201).json(presentVersion(row, String(row.id)));
  },
);

router.post(
  "/documents/:id/versions/:versionId/revert",
  requirePermission(`${MODULE}.update`),
  async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const versionId = String(req.params.versionId);
    const doc = await loadDocument(id);
    if (!doc) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!canSeeDocument(req.authUser!, doc)) {
      res.status(403).json({ error: "You do not have access to this document." });
      return;
    }
    const target = (await db
      .select()
      .from(documentVersionsTable)
      .where(
        and(
          eq(documentVersionsTable.id, versionId),
          eq(documentVersionsTable.documentId, id),
          eq(documentVersionsTable.isDeleted, false),
        ),
      )) as Row[];
    if (!target[0]) {
      res.status(404).json({ error: "Version not found" });
      return;
    }
    const me = actor(req);
    const row = ((await db
      .update(documentsTable)
      .set({
        currentVersionId: versionId,
        lastEditedByUserId: me.id,
        lastEditedByUserName: me.name,
      })
      .where(eq(documentsTable.id, id))
      .returning()) as Row[])[0];
    await recordAudit(req, {
      action: "revert-version",
      entity: "document",
      entityId: id,
      oldValue: { previousCurrent: doc.currentVersionId },
      newValue: { currentVersionId: versionId },
    });
    const versions = await loadVersions(id);
    res.json(RevertDocumentVersionResponse.parse(presentDocument(row, versions)));
  },
);

router.get(
  "/documents/versions/compare",
  requirePermission(`${MODULE}.view`),
  async (req, res): Promise<void> => {
    const q = req.query as Record<string, unknown>;
    const id = qStr(q, "documentId");
    const aId = qStr(q, "a");
    const bId = qStr(q, "b");
    if (!id) {
      res.status(400).json({ error: "documentId is required." });
      return;
    }
    const doc = await loadDocument(id);
    if (!doc) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!canSeeDocument(req.authUser!, doc)) {
      res.status(403).json({ error: "You do not have access to this document." });
      return;
    }
    const versions = await loadVersions(id);
    const a = versions.find((v) => String(v.id) === aId);
    const b = versions.find((v) => String(v.id) === bId);
    if (!a || !b) {
      res.status(404).json({ error: "Version not found" });
      return;
    }
    res.json(
      CompareDocumentVersionsResponse.parse({
        a: presentVersion(a, doc.currentVersionId),
        b: presentVersion(b, doc.currentVersionId),
      }),
    );
  },
);

/* -------------------------------------------------------------------------- */
/* Approval workflow                                                          */
/* -------------------------------------------------------------------------- */

interface TransitionOptions {
  action: string;
  from: string[];
  to: string;
  stamp: (
    me: { id: string | null; name: string | null },
    reason: string | null,
  ) => Record<string, unknown>;
  notify?: (
    doc: Row,
    me: { id: string | null; name: string | null },
    reason: string | null,
  ) => Promise<void>;
  responseSchema: { parse: (v: unknown) => unknown };
}

function workflowHandler(opts: TransitionOptions) {
  return async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const existing = await loadDocument(id);
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!canSeeDocument(req.authUser!, existing)) {
      res.status(403).json({ error: "You do not have access to this document." });
      return;
    }
    if (!opts.from.includes(String(existing.status))) {
      res
        .status(409)
        .json({ error: `Cannot ${opts.action} a document in status "${existing.status}".` });
      return;
    }
    const me = actor(req);
    const reason = typeof req.body?.reason === "string" ? req.body.reason : null;
    const row = ((await db
      .update(documentsTable)
      .set({ status: opts.to, ...opts.stamp(me, reason) })
      .where(eq(documentsTable.id, id))
      .returning()) as Row[])[0];
    await recordAudit(req, {
      action: opts.action,
      entity: "document",
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status: opts.to, reason },
    });
    if (opts.notify) await opts.notify(existing, me, reason);
    const versions = await loadVersions(id);
    res.json(opts.responseSchema.parse(presentDocument(row, versions)));
  };
}

router.post(
  "/documents/:id/submit",
  requirePermission(`${MODULE}.submit`),
  workflowHandler({
    action: "submit",
    from: ["draft"],
    to: "review",
    stamp: (me) => ({
      submittedByUserId: me.id,
      submittedByUserName: me.name,
      submittedAt: new Date(),
      rejectedByUserId: null,
      rejectedByUserName: null,
      rejectedAt: null,
      rejectReason: null,
    }),
    notify: async (doc, me) => {
      if (doc.ownerUserId && doc.ownerUserId !== me.id) {
        await notifyUser({
          companyId: String(doc.companyId),
          recipientUserId: String(doc.ownerUserId),
          actorUserId: me.id,
          eventType: "document_submitted",
          title: `Document submitted: ${String(doc.documentNumber)}`,
          body: `${me.name ?? "A user"} submitted "${String(doc.name)}" for review.`,
          sourceId: String(doc.id),
          sourceRef: String(doc.documentNumber),
        });
      }
    },
    responseSchema: SubmitDocumentResponse,
  }),
);

router.post(
  "/documents/:id/endorse",
  requirePermission(`${MODULE}.endorse`),
  workflowHandler({
    action: "endorse",
    from: ["review"],
    to: "review",
    stamp: (me) => ({
      endorsedByUserId: me.id,
      endorsedByUserName: me.name,
      endorsedAt: new Date(),
    }),
    notify: async (doc, me) => {
      await notifyUser({
        companyId: String(doc.companyId),
        recipientUserId: (doc.submittedByUserId as string) ?? (doc.ownerUserId as string) ?? null,
        actorUserId: me.id,
        eventType: "document_endorsed",
        title: `Document endorsed: ${String(doc.documentNumber)}`,
        body: `${me.name ?? "A user"} endorsed "${String(doc.name)}".`,
        sourceId: String(doc.id),
        sourceRef: String(doc.documentNumber),
      });
    },
    responseSchema: EndorseDocumentResponse,
  }),
);

router.post(
  "/documents/:id/approve",
  requirePermission(`${MODULE}.approve`),
  workflowHandler({
    action: "approve",
    from: ["review"],
    to: "approved",
    stamp: (me) => ({
      approvedByUserId: me.id,
      approvedByUserName: me.name,
      approvedAt: new Date(),
    }),
    notify: async (doc, me) => {
      await notifyUser({
        companyId: String(doc.companyId),
        recipientUserId: (doc.submittedByUserId as string) ?? (doc.ownerUserId as string) ?? null,
        actorUserId: me.id,
        eventType: "document_approved",
        title: `Document approved: ${String(doc.documentNumber)}`,
        body: `${me.name ?? "A user"} approved "${String(doc.name)}".`,
        sourceId: String(doc.id),
        sourceRef: String(doc.documentNumber),
        priority: "medium",
      });
    },
    responseSchema: ApproveDocumentResponse,
  }),
);

router.post(
  "/documents/:id/reject",
  requirePermission(`${MODULE}.reject`),
  workflowHandler({
    action: "reject",
    from: ["review"],
    to: "draft",
    stamp: (me, reason) => ({
      rejectedByUserId: me.id,
      rejectedByUserName: me.name,
      rejectedAt: new Date(),
      rejectReason: reason,
    }),
    notify: async (doc, me, reason) => {
      await notifyUser({
        companyId: String(doc.companyId),
        recipientUserId: (doc.submittedByUserId as string) ?? (doc.ownerUserId as string) ?? null,
        actorUserId: me.id,
        eventType: "document_rejected",
        title: `Document rejected: ${String(doc.documentNumber)}`,
        body: reason
          ? `${me.name ?? "A user"} rejected "${String(doc.name)}": ${reason}`
          : `${me.name ?? "A user"} rejected "${String(doc.name)}".`,
        sourceId: String(doc.id),
        sourceRef: String(doc.documentNumber),
        priority: "high",
      });
    },
    responseSchema: RejectDocumentResponse,
  }),
);

router.post(
  "/documents/:id/activate",
  requirePermission(`${MODULE}.activate`),
  workflowHandler({
    action: "activate",
    from: ["approved"],
    to: "active",
    stamp: () => ({ isActive: true }),
    responseSchema: ActivateDocumentResponse,
  }),
);

router.post(
  "/documents/:id/archive",
  requirePermission(`${MODULE}.archive`),
  workflowHandler({
    action: "archive",
    from: ["draft", "review", "approved", "active", "expired"],
    to: "archived",
    stamp: (me) => ({
      archivedByUserId: me.id,
      archivedAt: new Date(),
      isActive: false,
    }),
    responseSchema: ArchiveDocumentResponse,
  }),
);

router.post(
  "/documents/:id/restore",
  requirePermission(`${MODULE}.restore`),
  workflowHandler({
    action: "restore",
    from: ["archived"],
    to: "active",
    stamp: () => ({
      archivedByUserId: null,
      archivedAt: null,
      isActive: true,
    }),
    responseSchema: RestoreDocumentResponse,
  }),
);

router.post(
  "/documents/:id/request-delete",
  requirePermission(`${MODULE}.requestDelete`),
  async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const existing = await loadDocument(id);
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!canSeeDocument(req.authUser!, existing)) {
      res.status(403).json({ error: "You do not have access to this document." });
      return;
    }
    const me = actor(req);
    const reason = typeof req.body?.reason === "string" ? req.body.reason : null;
    const row = ((await db
      .update(documentsTable)
      .set({
        deleteRequestedByUserId: me.id,
        deleteRequestedAt: new Date(),
        deleteReason: reason,
      })
      .where(eq(documentsTable.id, id))
      .returning()) as Row[])[0];
    await recordAudit(req, {
      action: "request-delete",
      entity: "document",
      entityId: id,
      newValue: { reason },
    });
    const versions = await loadVersions(id);
    res.json(RequestDocumentDeleteResponse.parse(presentDocument(row, versions)));
  },
);

/* -------------------------------------------------------------------------- */
/* Signature / stamp                                                          */
/* -------------------------------------------------------------------------- */

router.post(
  "/documents/:id/signature",
  requirePermission(`${MODULE}.update`),
  async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const parsed = SetDocumentSignatureBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const existing = await loadDocument(id);
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!canSeeDocument(req.authUser!, existing)) {
      res.status(403).json({ error: "You do not have access to this document." });
      return;
    }
    const body = parsed.data;
    const me = actor(req);
    const update: Record<string, unknown> = { signedAt: new Date() };
    if (body.signatureObjectPath !== undefined) {
      update.signatureObjectPath = body.signatureObjectPath;
      await db
        .update(documentObjectOwnersTable)
        .set({ documentId: id, companyId: String(existing.companyId), purpose: "signature" })
        .where(eq(documentObjectOwnersTable.objectPath, body.signatureObjectPath));
    }
    if (body.signerName !== undefined) update.signerName = body.signerName || me.name;
    if (body.stampObjectPath !== undefined) {
      update.stampObjectPath = body.stampObjectPath;
      await db
        .update(documentObjectOwnersTable)
        .set({ documentId: id, companyId: String(existing.companyId), purpose: "stamp" })
        .where(eq(documentObjectOwnersTable.objectPath, body.stampObjectPath));
    }
    if (body.stampLabel !== undefined) update.stampLabel = body.stampLabel;

    const row = ((await db
      .update(documentsTable)
      .set(update)
      .where(eq(documentsTable.id, id))
      .returning()) as Row[])[0];
    await recordAudit(req, {
      action: "sign",
      entity: "document",
      entityId: id,
      newValue: { signerName: row.signerName, stampLabel: row.stampLabel },
    });
    const versions = await loadVersions(id);
    res.json(SetDocumentSignatureResponse.parse(presentDocument(row, versions)));
  },
);

/* -------------------------------------------------------------------------- */
/* Cross-module links                                                         */
/* -------------------------------------------------------------------------- */

router.get(
  "/documents/:id/links",
  requirePermission(`${MODULE}.view`),
  async (req, res): Promise<void> => {
    const doc = await loadDocument(String(req.params.id));
    if (!doc) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!canSeeDocument(req.authUser!, doc)) {
      res.status(403).json({ error: "You do not have access to this document." });
      return;
    }
    const links = await loadLinks(String(doc.id));
    res.json(ListDocumentLinksResponse.parse({ data: links.map(serializeRow) }));
  },
);

router.post(
  "/documents/:id/links",
  requirePermission(`${MODULE}.update`),
  async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const parsed = CreateDocumentLinkBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const doc = await loadDocument(id);
    if (!doc) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!canSeeDocument(req.authUser!, doc)) {
      res.status(403).json({ error: "You do not have access to this document." });
      return;
    }
    const body = parsed.data;
    const me = actor(req);
    // Idempotent: do not create a duplicate link to the same record.
    const dupe = (await db
      .select({ id: documentLinksTable.id })
      .from(documentLinksTable)
      .where(
        and(
          eq(documentLinksTable.documentId, id),
          eq(documentLinksTable.moduleKey, body.moduleKey),
          eq(documentLinksTable.sourceId, body.sourceId),
          eq(documentLinksTable.isDeleted, false),
        ),
      )
      .limit(1)) as Row[];
    let row: Row;
    if (dupe[0]) {
      row = ((await db
        .select()
        .from(documentLinksTable)
        .where(eq(documentLinksTable.id, String(dupe[0].id)))) as Row[])[0];
    } else {
      row = ((await db
        .insert(documentLinksTable)
        .values({
          companyId: String(doc.companyId),
          documentId: id,
          moduleKey: body.moduleKey,
          sourceId: body.sourceId,
          sourceRef: body.sourceRef ?? null,
          linkedByUserId: me.id,
          linkedByUserName: me.name,
        })
        .returning()) as Row[])[0];
      await recordAudit(req, {
        action: "link",
        entity: "documentLink",
        entityId: String(row.id),
        newValue: { documentId: id, moduleKey: body.moduleKey, sourceId: body.sourceId },
      });
    }
    res.status(201).json(serializeRow(row));
  },
);

router.delete(
  "/documents/:id/links/:linkId",
  requirePermission(`${MODULE}.update`),
  async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const linkId = String(req.params.linkId);
    const doc = await loadDocument(id);
    if (!doc) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!canSeeDocument(req.authUser!, doc)) {
      res.status(403).json({ error: "You do not have access to this document." });
      return;
    }
    const existing = (await db
      .select()
      .from(documentLinksTable)
      .where(
        and(
          eq(documentLinksTable.id, linkId),
          eq(documentLinksTable.documentId, id),
          eq(documentLinksTable.isDeleted, false),
        ),
      )) as Row[];
    if (!existing[0]) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await db
      .update(documentLinksTable)
      .set({ isDeleted: true, isActive: false })
      .where(eq(documentLinksTable.id, linkId));
    await recordAudit(req, {
      action: "unlink",
      entity: "documentLink",
      entityId: linkId,
      oldValue: existing[0],
    });
    res.json(DeleteDocumentLinkResponse.parse({ success: true }));
  },
);

/* -------------------------------------------------------------------------- */
/* File serving (inline preview + download) — modeled in OpenAPI as           */
/* getDocumentFile (binary stream; hand-written here because it pipes bytes).  */
/* Authorizes against the document's scope + the immutable owner mapping.      */
/* -------------------------------------------------------------------------- */

router.get(
  "/documents/:id/file",
  requirePermission(`${MODULE}.view`),
  async (req, res): Promise<void> => {
    const id = String(req.params.id);
    const doc = await loadDocument(id);
    if (!doc) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!canSeeDocument(req.authUser!, doc)) {
      res.status(403).json({ error: "You do not have access to this document." });
      return;
    }
    const q = req.query as Record<string, unknown>;
    const versionId = qStr(q, "versionId");
    const download = qStr(q, "download") === "true";

    let version: Row | undefined;
    const versions = await loadVersions(id);
    if (versionId) {
      version = versions.find((v) => String(v.id) === versionId);
    } else if (doc.currentVersionId) {
      version = versions.find((v) => String(v.id) === String(doc.currentVersionId));
    }
    if (!version || !version.fileObjectPath) {
      res.status(404).json({ error: "No file for this document." });
      return;
    }
    const objectPath = String(version.fileObjectPath);
    // Defense in depth: the path must belong to this document.
    const [owned] = (await db
      .select({ id: documentObjectOwnersTable.id })
      .from(documentObjectOwnersTable)
      .where(
        and(
          eq(documentObjectOwnersTable.objectPath, objectPath),
          eq(documentObjectOwnersTable.documentId, id),
        ),
      )
      .limit(1)) as Row[];
    if (!owned) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    await recordAudit(req, {
      action: download ? "download" : "view-file",
      entity: "document",
      entityId: id,
      newValue: { versionId: String(version.id), fileName: version.fileName ?? null },
    });
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      const response = await objectStorageService.downloadObject(objectFile);
      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      // Active content (HTML, SVG, scripts) must never render inline in the
      // app's same origin, or an uploaded file could execute script (stored
      // XSS). Force such types to download as an opaque octet-stream.
      const storedMime = String(version.mimeType ?? "").toLowerCase();
      const dangerousMime =
        storedMime === "text/html" ||
        storedMime === "application/xhtml+xml" ||
        storedMime === "image/svg+xml" ||
        storedMime.includes("javascript") ||
        storedMime.includes("ecmascript") ||
        storedMime === "application/xml" ||
        storedMime === "text/xml";
      const forceAttachment = download || dangerousMime;
      if (version.mimeType) {
        res.setHeader("Content-Type", dangerousMime ? "application/octet-stream" : storedMime);
      }
      res.setHeader("X-Content-Type-Options", "nosniff");
      const fileName = String(version.fileName ?? `${String(doc.documentNumber)}`);
      res.setHeader(
        "Content-Disposition",
        `${forceAttachment ? "attachment" : "inline"}; filename="${fileName.replace(/"/g, "")}"`,
      );
      if (response.body) {
        const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "Object not found" });
        return;
      }
      req.log.error({ err: error }, "Error serving document object");
      res.status(500).json({ error: "Failed to serve object" });
    }
  },
);

export default router;
