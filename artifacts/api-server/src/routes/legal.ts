import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, eq, ilike, or, sql, desc, asc, gte, lte, type SQL } from "drizzle-orm";
import {
  db,
  legalContractsTable,
  contractTemplatesTable,
  contractVersionsTable,
  legalContractAmendmentsTable,
  contractAddendumsTable,
  legalContractAttachmentsTable,
  contractEventsTable,
  lawFirmsTable,
  legalAdvisorsTable,
  legalCasesTable,
  legalHearingsTable,
  legalClaimsTable,
  legalNoticesTable,
  legalCaseLinksTable,
  documentObjectOwnersTable,
  usersTable,
} from "@workspace/db";
import {
  CreateLegalContractBody, UpdateLegalContractBody, ListLegalContractsResponse,
  CreateContractTemplateBody, UpdateContractTemplateBody, ListContractTemplatesResponse,
  CreateContractVersionBody, UpdateContractVersionBody, ListContractVersionsResponse,
  CreateLegalContractAmendmentBody, UpdateLegalContractAmendmentBody, ListLegalContractAmendmentsResponse,
  CreateContractAddendumBody, UpdateContractAddendumBody, ListContractAddendumsResponse,
  CreateLegalContractAttachmentBody, UpdateLegalContractAttachmentBody, ListLegalContractAttachmentsResponse,
  CreateContractEventBody, UpdateContractEventBody, ListContractEventsResponse,
  CreateLawFirmBody, UpdateLawFirmBody, ListLawFirmsResponse,
  CreateLegalAdvisorBody, UpdateLegalAdvisorBody, ListLegalAdvisorsResponse,
  CreateLegalCaseBody, UpdateLegalCaseBody, ListLegalCasesResponse,
  CreateLegalHearingBody, UpdateLegalHearingBody, ListLegalHearingsResponse,
  CreateLegalClaimBody, UpdateLegalClaimBody, ListLegalClaimsResponse,
  CreateLegalNoticeBody, UpdateLegalNoticeBody, ListLegalNoticesResponse,
  CreateLegalCaseLinkBody, UpdateLegalCaseLinkBody, ListLegalCaseLinksResponse,
  SuspendLegalContractBody, TerminateLegalContractBody, RenewLegalContractBody, CloseLegalCaseBody,
  ImportContractTemplateBody,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";
import { PostingError, type Tx } from "../lib/posting";
import { ObjectStorageService } from "../lib/objectStorage";
import { importDocument } from "../lib/print-engine";
import {
  resolveContractTokens,
  buildContractDocument,
  generateQrDataUrl,
  contractTokenCatalog,
  type RenderActor,
} from "../lib/contract-render";

const objectStorageService = new ObjectStorageService();

/** Absolute, public base URL for verification links (prefers the published domain). */
function publicBaseUrl(req: import("express").Request): string {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (domain) return `https://${domain}`;
  const host = req.get("host") ?? "localhost";
  return `${req.protocol}://${host}`;
}

// Statuses in which a legal contract is still editable via generic CRUD. Once a
// contract leaves draft/under_review (approved, active, archived, …) it is
// locked: PATCH/DELETE are refused so the approved record can never be altered.
const LEGAL_CONTRACT_EDITABLE_STATUSES = ["draft", "under_review"];

const router: IRouter = Router();
router.use(requireAuth);

import { registerCrud, CrudRefused, type CrudConfig as SharedCrudConfig } from "../lib/register-crud";

// Legal-local helper, unrelated to CRUD infrastructure.
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Legal keeps ownership of its two rules; the shared factory only runs them.
 *  - editableStatuses: which statuses still permit PATCH/DELETE
 *  - onCreate:         timeline event written after a successful create
 * They are declared here and mapped onto the shared hooks at the call site,
 * so no legal semantics leak into the canonical CRUD infrastructure.
 */
type CrudConfig = SharedCrudConfig & {
  editableStatuses?: string[];
  onCreate?: (req: import("express").Request, row: Record<string, unknown>) => Promise<void>;
};


const resources: CrudConfig[] = [
  { path: "legal-contracts", table: legalContractsTable, module: "legalContracts", entity: "legalContract",
    createBody: CreateLegalContractBody, updateBody: UpdateLegalContractBody, listResponse: ListLegalContractsResponse,
    search: ["code", "title", "titleAr", "counterpartyName"], editableStatuses: LEGAL_CONTRACT_EDITABLE_STATUSES,
    onCreate: async (req, row) => {
      await db.insert(contractEventsTable).values({
        companyId: row.companyId as string,
        legalContractId: row.id as string,
        eventType: "create",
        description: "Contract created",
        performedBy: req.authUser?.id ?? null,
      });
    } },
  { path: "contract-templates", table: contractTemplatesTable, module: "contractTemplates", entity: "contractTemplate",
    createBody: CreateContractTemplateBody, updateBody: UpdateContractTemplateBody, listResponse: ListContractTemplatesResponse,
    search: ["code", "name", "nameAr"] },
  { path: "contract-versions", table: contractVersionsTable, module: "contractVersions", entity: "contractVersion",
    createBody: CreateContractVersionBody, updateBody: UpdateContractVersionBody, listResponse: ListContractVersionsResponse,
    search: ["changeSummary"] },
  { path: "legal-contract-amendments", table: legalContractAmendmentsTable, module: "legalContractAmendments", entity: "legalContractAmendment",
    createBody: CreateLegalContractAmendmentBody, updateBody: UpdateLegalContractAmendmentBody, listResponse: ListLegalContractAmendmentsResponse,
    search: ["code", "description", "descriptionAr"],
    onCreate: async (req, row) => {
      const parentId = row.legalContractId as string | null;
      if (!parentId) return;
      // Bump the parent contract's version and log an "amend" timeline event so
      // every modification flows through the existing amendment workflow.
      await db.transaction(async (tx) => {
        const parents = (await tx
          .select({ v: legalContractsTable.currentVersion })
          .from(legalContractsTable)
          .where(eq(legalContractsTable.id, parentId))) as { v: number | null }[];
        const nextVersion = (parents[0]?.v ?? 1) + 1;
        await tx
          .update(legalContractsTable)
          .set({ currentVersion: nextVersion })
          .where(eq(legalContractsTable.id, parentId));
        await tx.insert(contractEventsTable).values({
          companyId: row.companyId as string,
          legalContractId: parentId,
          eventType: "amend",
          description: `Amendment recorded (v${nextVersion})`,
          performedBy: req.authUser?.id ?? null,
        });
      });
    } },
  { path: "contract-addendums", table: contractAddendumsTable, module: "contractAddendums", entity: "contractAddendum",
    createBody: CreateContractAddendumBody, updateBody: UpdateContractAddendumBody, listResponse: ListContractAddendumsResponse,
    search: ["code", "title"] },
  { path: "legal-contract-attachments", table: legalContractAttachmentsTable, module: "legalContractAttachments", entity: "legalContractAttachment",
    createBody: CreateLegalContractAttachmentBody, updateBody: UpdateLegalContractAttachmentBody, listResponse: ListLegalContractAttachmentsResponse,
    search: ["title", "documentType"] },
  { path: "contract-events", table: contractEventsTable, module: "contractEvents", entity: "contractEvent",
    createBody: CreateContractEventBody, updateBody: UpdateContractEventBody, listResponse: ListContractEventsResponse,
    search: ["eventType", "description"] },
  { path: "law-firms", table: lawFirmsTable, module: "lawFirms", entity: "lawFirm",
    createBody: CreateLawFirmBody, updateBody: UpdateLawFirmBody, listResponse: ListLawFirmsResponse,
    search: ["code", "name", "nameAr", "contactPerson"] },
  { path: "legal-advisors", table: legalAdvisorsTable, module: "legalAdvisors", entity: "legalAdvisor",
    createBody: CreateLegalAdvisorBody, updateBody: UpdateLegalAdvisorBody, listResponse: ListLegalAdvisorsResponse,
    search: ["code", "name", "nameAr", "specialization"] },
  { path: "legal-cases", table: legalCasesTable, module: "legalCases", entity: "legalCase",
    createBody: CreateLegalCaseBody, updateBody: UpdateLegalCaseBody, listResponse: ListLegalCasesResponse,
    search: ["code", "title", "titleAr", "courtCaseNumber", "opponentName"] },
  { path: "legal-hearings", table: legalHearingsTable, module: "legalHearings", entity: "legalHearing",
    createBody: CreateLegalHearingBody, updateBody: UpdateLegalHearingBody, listResponse: ListLegalHearingsResponse,
    search: ["code", "location", "summary"] },
  { path: "legal-claims", table: legalClaimsTable, module: "legalClaims", entity: "legalClaim",
    createBody: CreateLegalClaimBody, updateBody: UpdateLegalClaimBody, listResponse: ListLegalClaimsResponse,
    search: ["code", "description"] },
  { path: "legal-notices", table: legalNoticesTable, module: "legalNotices", entity: "legalNotice",
    createBody: CreateLegalNoticeBody, updateBody: UpdateLegalNoticeBody, listResponse: ListLegalNoticesResponse,
    search: ["code", "subject", "recipientName"] },
  { path: "legal-case-links", table: legalCaseLinksTable, module: "legalCaseLinks", entity: "legalCaseLink",
    createBody: CreateLegalCaseLinkBody, updateBody: UpdateLegalCaseLinkBody, listResponse: ListLegalCaseLinksResponse,
    search: ["linkedName", "notes"] },
];

// Smart-variable palette served from the server so the template designer's
// token list can never drift from the resolver's actual capabilities.
// Registered BEFORE the CRUD loop so the static path is matched before the
// generated GET /contract-templates/:id route (otherwise :id="token-catalog"
// hits the row lookup and 500s on an invalid uuid).
router.get("/contract-templates/token-catalog", requirePermission("contractTemplates.view"), async (_req, res): Promise<void> => {
  res.json({ data: contractTokenCatalog() });
});

// Map legal's own rules onto the shared hooks. The factory never learns what
// a legal status means — it just runs the guard legal supplies.
for (const { editableStatuses, onCreate, ...rest } of resources) {
  registerCrud(router, {
    ...rest,
    // legal exposed GET /:id on every resource before consolidation.
    getOne: true,
    hooks: {
      ...(editableStatuses
        ? {
            guardMutation: (row: Record<string, unknown>) => {
              if (!editableStatuses.includes(String(row.status))) {
                throw new CrudRefused(
                  `${rest.entity} is locked and cannot be edited in status "${String(row.status)}"`,
                  409,
                );
              }
            },
          }
        : {}),
      ...(onCreate ? { afterCreate: onCreate } : {}),
    },
  });
}

/* ------------------------------------------------------------------ */
/* Lifecycle action helpers                                            */
/* ------------------------------------------------------------------ */

function mapPostingError(res: import("express").Response, err: unknown): boolean {
  if (err instanceof PostingError) {
    res.status(err.status).json({ error: err.message });
    return true;
  }
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadForUpdate(tx: Tx, table: any, id: string): Promise<Record<string, unknown> | null> {
  const rows = (await tx
    .select()
    .from(table)
    .where(and(eq(table.id, id), eq(table.isDeleted, false)))
    .for("update")) as Record<string, unknown>[];
  return rows[0] ?? null;
}

async function logContractEvent(
  tx: Tx,
  args: { companyId: string; legalContractId: string; eventType: string; description: string; performedBy: string | null },
): Promise<void> {
  await tx.insert(contractEventsTable).values({
    companyId: args.companyId,
    legalContractId: args.legalContractId,
    eventType: args.eventType,
    description: args.description,
    performedBy: args.performedBy,
  });
}

/* ----------------------------- Legal contracts ------------------------- */

router.post("/legal-contracts/:id/review", requirePermission("legalContracts.review"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const userId = req.authUser?.id ?? null;
  try {
    const row = await db.transaction(async (tx) => {
      const c = await loadForUpdate(tx, legalContractsTable, id);
      if (!c) return null;
      if (c.status !== "draft") throw new PostingError(409, "Only a draft contract can be moved to review");
      const [updated] = await tx
        .update(legalContractsTable)
        .set({ status: "under_review", reviewedBy: userId, reviewedAt: new Date() })
        .where(eq(legalContractsTable.id, id))
        .returning();
      await logContractEvent(tx, { companyId: c.companyId as string, legalContractId: id, eventType: "review", description: "Contract moved to review", performedBy: userId });
      return updated;
    });
    if (!row) { res.status(404).json({ error: "legalContract not found" }); return; }
    await recordAudit(req, { action: "review", entity: "legalContract", entityId: id, newValue: row });
    res.json(serializeRow(row as Record<string, unknown>));
  } catch (err) {
    if (mapPostingError(res, err)) return;
    throw err;
  }
});

router.post("/legal-contracts/:id/approve", requirePermission("legalContracts.approve"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const userId = req.authUser?.id ?? null;
  const actor: RenderActor = { fullName: req.authUser?.fullName ?? null, username: req.authUser?.username ?? null };
  const approverName = req.authUser?.fullName || req.authUser?.username || "";
  try {
    const row = await db.transaction(async (tx) => {
      const c = await loadForUpdate(tx, legalContractsTable, id);
      if (!c) return null;
      if (c.status !== "draft" && c.status !== "under_review") throw new PostingError(409, "Only a draft or under-review contract can be approved");
      const approvedAt = new Date();
      // Mint a stable public verification handle and encode it into a QR code
      // that points at the public verify endpoint (non-confidential lookup).
      const verificationId = (c.verificationId as string | null) ?? randomUUID();
      const verifyUrl = `${publicBaseUrl(req)}/api/legal-verify/${verificationId}`;
      // Freeze an immutable, system-generated rendered document from the linked
      // editable template + the resolved smart-variable chain. Best-effort: if
      // no template is set or rendering fails, approval still proceeds without a
      // document (the editable template remains in Legal Affairs regardless).
      let approvedDocument: string | null = null;
      try {
        if (c.templateId) {
          const tplRows = (await tx
            .select()
            .from(contractTemplatesTable)
            .where(eq(contractTemplatesTable.id, c.templateId as string))) as Record<string, unknown>[];
          const tpl = tplRows[0];
          const templateHtml = tpl ? String(tpl.content ?? "") : "";
          if (templateHtml.trim()) {
            const contractForRender = { ...c, verificationId } as unknown as Parameters<typeof resolveContractTokens>[0];
            const tokens = await resolveContractTokens(contractForRender, actor);
            const qrDataUrl = await generateQrDataUrl(verifyUrl);
            approvedDocument = buildContractDocument({
              contract: contractForRender,
              templateHtml,
              tokens,
              mode: "approved",
              generatedAt: approvedAt,
              verificationId,
              approverName,
              version: (c.currentVersion as number | null) ?? 1,
              qrDataUrl,
            });
          }
        }
      } catch (docErr) {
        req.log.error({ err: docErr, contractId: id }, "Failed to render approved contract document");
        approvedDocument = null;
      }
      const [updated] = await tx
        .update(legalContractsTable)
        .set({
          status: "approved",
          approvedBy: userId,
          approvedAt,
          approvedDocument,
          approvedDocumentAt: approvedDocument ? approvedAt : null,
          lockedAt: approvedAt,
          verificationId,
        })
        .where(eq(legalContractsTable.id, id))
        .returning();
      await logContractEvent(tx, { companyId: c.companyId as string, legalContractId: id, eventType: "approve", description: "Contract approved", performedBy: userId });
      return updated;
    });
    if (!row) { res.status(404).json({ error: "legalContract not found" }); return; }
    await recordAudit(req, { action: "approve", entity: "legalContract", entityId: id, newValue: row });
    res.json(serializeRow(row as Record<string, unknown>));
  } catch (err) {
    if (mapPostingError(res, err)) return;
    throw err;
  }
});

router.post("/legal-contracts/:id/archive", requirePermission("legalContracts.archive"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const userId = req.authUser?.id ?? null;
  try {
    const row = await db.transaction(async (tx) => {
      const c = await loadForUpdate(tx, legalContractsTable, id);
      if (!c) return null;
      if (c.status === "archived") throw new PostingError(409, "Contract is already archived");
      const [updated] = await tx
        .update(legalContractsTable)
        .set({ status: "archived", lockedAt: (c.lockedAt as Date | null) ?? new Date() })
        .where(eq(legalContractsTable.id, id))
        .returning();
      await logContractEvent(tx, { companyId: c.companyId as string, legalContractId: id, eventType: "archive", description: "Contract archived", performedBy: userId });
      return updated;
    });
    if (!row) { res.status(404).json({ error: "legalContract not found" }); return; }
    await recordAudit(req, { action: "archive", entity: "legalContract", entityId: id, newValue: row });
    res.json(serializeRow(row as Record<string, unknown>));
  } catch (err) {
    if (mapPostingError(res, err)) return;
    throw err;
  }
});

router.get("/legal-contracts/:id/document", requirePermission("legalContracts.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const rows = (await db
    .select()
    .from(legalContractsTable)
    .where(and(eq(legalContractsTable.id, id), eq(legalContractsTable.isDeleted, false)))) as Record<string, unknown>[];
  const row = rows[0];
  if (!row) { res.status(404).json({ error: "legalContract not found" }); return; }
  const html = row.approvedDocument ? String(row.approvedDocument) : null;
  if (!html) { res.status(404).json({ error: "No approved document available for this contract" }); return; }
  const generatedAt = row.approvedDocumentAt instanceof Date
    ? row.approvedDocumentAt.toISOString()
    : (row.approvedDocumentAt ? String(row.approvedDocumentAt) : null);
  res.json({ html, generatedAt, locked: true });
});

// Live preview (DRAFT watermark). Renders the linked template with the current
// smart-variable values WITHOUT persisting anything, so reviewers can see the
// document before approval. Works in any status; never mutates the contract.
router.get("/legal-contracts/:id/preview", requirePermission("legalContracts.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const rows = (await db
    .select()
    .from(legalContractsTable)
    .where(and(eq(legalContractsTable.id, id), eq(legalContractsTable.isDeleted, false)))) as Record<string, unknown>[];
  const c = rows[0];
  if (!c) { res.status(404).json({ error: "legalContract not found" }); return; }
  if (!c.templateId) { res.status(404).json({ error: "No template linked to this contract for preview" }); return; }
  const tplRows = (await db
    .select()
    .from(contractTemplatesTable)
    .where(eq(contractTemplatesTable.id, c.templateId as string))) as Record<string, unknown>[];
  const templateHtml = tplRows[0] ? String(tplRows[0].content ?? "") : "";
  if (!templateHtml.trim()) { res.status(404).json({ error: "Linked template has no content" }); return; }
  const actor: RenderActor = { fullName: req.authUser?.fullName ?? null, username: req.authUser?.username ?? null };
  const tokens = await resolveContractTokens(c as unknown as Parameters<typeof resolveContractTokens>[0], actor);
  const html = buildContractDocument({
    contract: c as unknown as Parameters<typeof buildContractDocument>[0]["contract"],
    templateHtml,
    tokens,
    mode: "draft",
    generatedAt: new Date(),
  });
  res.json({ html, mode: "draft", locked: false });
});

// Official print: returns the locked approved document and records a "print"
// timeline event (best-effort). Distinct from GET /document (pure read) so the
// timeline captures every official print without mutating on a GET.
router.post("/legal-contracts/:id/print", requirePermission("legalContracts.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const rows = (await db
    .select()
    .from(legalContractsTable)
    .where(and(eq(legalContractsTable.id, id), eq(legalContractsTable.isDeleted, false)))) as Record<string, unknown>[];
  const row = rows[0];
  if (!row) { res.status(404).json({ error: "legalContract not found" }); return; }
  const html = row.approvedDocument ? String(row.approvedDocument) : null;
  if (!html) { res.status(404).json({ error: "No approved document available for this contract" }); return; }
  try {
    await db.insert(contractEventsTable).values({
      companyId: row.companyId as string,
      legalContractId: id,
      eventType: "print",
      description: "Official document printed",
      performedBy: req.authUser?.id ?? null,
    });
  } catch (err) {
    req.log.error({ err, contractId: id }, "Failed to log print event");
  }
  const generatedAt = row.approvedDocumentAt instanceof Date
    ? row.approvedDocumentAt.toISOString()
    : (row.approvedDocumentAt ? String(row.approvedDocumentAt) : null);
  res.json({ html, generatedAt, verificationId: row.verificationId ?? null, locked: true });
});

// Contract timeline: every lifecycle event (create/review/approve/print/amend/
// archive) joined with the performing user's name, oldest first.
router.get("/legal-contracts/:id/timeline", requirePermission("legalContracts.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const events = (await db
    .select({
      id: contractEventsTable.id,
      eventType: contractEventsTable.eventType,
      description: contractEventsTable.description,
      eventDate: contractEventsTable.eventDate,
      performedBy: contractEventsTable.performedBy,
      performedByName: usersTable.fullName,
      performedByUsername: usersTable.username,
    })
    .from(contractEventsTable)
    .leftJoin(usersTable, eq(contractEventsTable.performedBy, usersTable.id))
    .where(and(eq(contractEventsTable.legalContractId, id), eq(contractEventsTable.isDeleted, false)))
    .orderBy(asc(contractEventsTable.eventDate))) as Record<string, unknown>[];
  res.json({ data: events.map(serializeRow) });
});

router.post("/contract-templates/import", requirePermission("contractTemplates.create"), async (req, res): Promise<void> => {
  const parsed = ImportContractTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const body = parsed.data;
  const fileFormat = body.fileFormat ?? "docx";

  // Authorize the object path against the immutable owner mapping the server
  // minted at upload time. Without this, any user with contractTemplates.create
  // could pass an arbitrary /objects/* path and read unrelated private files
  // (object-storage IDOR). Only the uploader of this exact path may import it.
  const objectPath = objectStorageService.normalizeObjectEntityPath(body.fileObjectPath);
  const userId = req.authUser?.id ?? null;
  const owner = (await db
    .select({ uploadedByUserId: documentObjectOwnersTable.uploadedByUserId })
    .from(documentObjectOwnersTable)
    .where(eq(documentObjectOwnersTable.objectPath, objectPath))
    .limit(1)) as { uploadedByUserId: string | null }[];
  if (!owner.length || !userId || owner[0].uploadedByUserId !== userId) {
    res.status(403).json({ error: "Not authorized to import this file" });
    return;
  }

  let html = "";
  let warning: string | null = null;
  try {
    const file = await objectStorageService.getObjectEntityFile(objectPath);
    const [buffer] = await file.download();
    const outcome = await importDocument(buffer, fileFormat);
    html = outcome.html;
    warning = outcome.warning ?? null;
  } catch (err) {
    req.log.error({ err, fileObjectPath: body.fileObjectPath }, "Failed to import contract template document");
    res.status(400).json({ error: "Could not read or convert the uploaded document" });
    return;
  }

  // Versioning: a new revision of an existing family increments the version.
  let version = 1;
  if (body.parentTemplateId) {
    const siblings = (await db
      .select({ v: contractTemplatesTable.version })
      .from(contractTemplatesTable)
      .where(eq(contractTemplatesTable.parentTemplateId, body.parentTemplateId))) as { v: number | null }[];
    const parentRow = (await db
      .select({ v: contractTemplatesTable.version })
      .from(contractTemplatesTable)
      .where(eq(contractTemplatesTable.id, body.parentTemplateId))) as { v: number | null }[];
    const versions = [...siblings, ...parentRow].map((r) => r.v ?? 1);
    version = (versions.length ? Math.max(...versions) : 1) + 1;
  }

  const inserted = (await db
    .insert(contractTemplatesTable)
    .values({
      companyId: body.companyId,
      code: body.code,
      name: body.name,
      nameAr: body.nameAr ?? null,
      contractType: body.contractType ?? "legal",
      description: body.description ?? null,
      content: html,
      status: "active",
      fileObjectPath: body.fileObjectPath,
      fileFormat,
      version,
      parentTemplateId: body.parentTemplateId ?? null,
    })
    .returning()) as Record<string, unknown>[];
  const row = inserted[0];
  await recordAudit(req, { action: "import", entity: "contractTemplate", entityId: row.id as string, newValue: row });
  res.status(201).json({ ...serializeRow(row), warning });
});

router.post("/legal-contracts/:id/activate", requirePermission("legalContracts.activate"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const userId = req.authUser?.id ?? null;
  try {
    const row = await db.transaction(async (tx) => {
      const c = await loadForUpdate(tx, legalContractsTable, id);
      if (!c) return null;
      if (c.status !== "approved" && c.status !== "suspended") throw new PostingError(409, "Only an approved or suspended contract can be activated");
      const [updated] = await tx
        .update(legalContractsTable)
        .set({ status: "active", activatedAt: new Date() })
        .where(eq(legalContractsTable.id, id))
        .returning();
      await logContractEvent(tx, { companyId: c.companyId as string, legalContractId: id, eventType: "activate", description: "Contract activated", performedBy: userId });
      return updated;
    });
    if (!row) { res.status(404).json({ error: "legalContract not found" }); return; }
    await recordAudit(req, { action: "activate", entity: "legalContract", entityId: id, newValue: row });
    res.json(serializeRow(row as Record<string, unknown>));
  } catch (err) {
    if (mapPostingError(res, err)) return;
    throw err;
  }
});

router.post("/legal-contracts/:id/suspend", requirePermission("legalContracts.suspend"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const userId = req.authUser?.id ?? null;
  const parsed = SuspendLegalContractBody.safeParse(req.body ?? {});
  const reason = parsed.success ? (parsed.data.reason ?? null) : null;
  try {
    const row = await db.transaction(async (tx) => {
      const c = await loadForUpdate(tx, legalContractsTable, id);
      if (!c) return null;
      if (c.status !== "active") throw new PostingError(409, "Only an active contract can be suspended");
      const [updated] = await tx
        .update(legalContractsTable)
        .set({ status: "suspended", suspendedAt: new Date() })
        .where(eq(legalContractsTable.id, id))
        .returning();
      await logContractEvent(tx, { companyId: c.companyId as string, legalContractId: id, eventType: "suspend", description: reason ? `Contract suspended: ${reason}` : "Contract suspended", performedBy: userId });
      return updated;
    });
    if (!row) { res.status(404).json({ error: "legalContract not found" }); return; }
    await recordAudit(req, { action: "suspend", entity: "legalContract", entityId: id, newValue: row });
    res.json(serializeRow(row as Record<string, unknown>));
  } catch (err) {
    if (mapPostingError(res, err)) return;
    throw err;
  }
});

router.post("/legal-contracts/:id/terminate", requirePermission("legalContracts.terminate"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const userId = req.authUser?.id ?? null;
  const parsed = TerminateLegalContractBody.safeParse(req.body ?? {});
  const reason = parsed.success ? (parsed.data.terminationReason ?? null) : null;
  try {
    const row = await db.transaction(async (tx) => {
      const c = await loadForUpdate(tx, legalContractsTable, id);
      if (!c) return null;
      if (c.status === "terminated" || c.status === "cancelled") throw new PostingError(409, "Contract is already terminated or cancelled");
      const [updated] = await tx
        .update(legalContractsTable)
        .set({ status: "terminated", terminatedAt: new Date(), terminationReason: reason })
        .where(eq(legalContractsTable.id, id))
        .returning();
      await logContractEvent(tx, { companyId: c.companyId as string, legalContractId: id, eventType: "terminate", description: reason ? `Contract terminated: ${reason}` : "Contract terminated", performedBy: userId });
      return updated;
    });
    if (!row) { res.status(404).json({ error: "legalContract not found" }); return; }
    await recordAudit(req, { action: "terminate", entity: "legalContract", entityId: id, newValue: row });
    res.json(serializeRow(row as Record<string, unknown>));
  } catch (err) {
    if (mapPostingError(res, err)) return;
    throw err;
  }
});

router.post("/legal-contracts/:id/renew", requirePermission("legalContracts.renew"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const userId = req.authUser?.id ?? null;
  const parsed = RenewLegalContractBody.safeParse(req.body ?? {});
  const renewalDate = parsed.success ? (parsed.data.renewalDate ?? today()) : today();
  const expiryDate = parsed.success ? (parsed.data.expiryDate ?? null) : null;
  try {
    const row = await db.transaction(async (tx) => {
      const c = await loadForUpdate(tx, legalContractsTable, id);
      if (!c) return null;
      if (c.status !== "active" && c.status !== "expired") throw new PostingError(409, "Only an active or expired contract can be renewed");
      const set: Record<string, unknown> = { status: "active", renewalDate };
      if (expiryDate) set.expiryDate = expiryDate;
      const [updated] = await tx
        .update(legalContractsTable)
        .set(set)
        .where(eq(legalContractsTable.id, id))
        .returning();
      await logContractEvent(tx, { companyId: c.companyId as string, legalContractId: id, eventType: "renew", description: "Contract renewed", performedBy: userId });
      return updated;
    });
    if (!row) { res.status(404).json({ error: "legalContract not found" }); return; }
    await recordAudit(req, { action: "renew", entity: "legalContract", entityId: id, newValue: row });
    res.json(serializeRow(row as Record<string, unknown>));
  } catch (err) {
    if (mapPostingError(res, err)) return;
    throw err;
  }
});

/* ----------------------------- Legal cases ----------------------------- */

router.post("/legal-cases/:id/close", requirePermission("legalCases.close"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const userId = req.authUser?.id ?? null;
  const parsed = CloseLegalCaseBody.safeParse(req.body ?? {});
  const outcome = parsed.success ? (parsed.data.outcome ?? null) : null;
  const outcomeAmount = parsed.success ? (parsed.data.outcomeAmount ?? null) : null;
  try {
    const row = await db.transaction(async (tx) => {
      const c = await loadForUpdate(tx, legalCasesTable, id);
      if (!c) return null;
      if (c.status === "closed") throw new PostingError(409, "Case is already closed");
      const set: Record<string, unknown> = { status: "closed", closedAt: new Date() };
      if (outcome) set.outcome = outcome;
      if (outcomeAmount) set.outcomeAmount = outcomeAmount;
      const [updated] = await tx
        .update(legalCasesTable)
        .set(set)
        .where(eq(legalCasesTable.id, id))
        .returning();
      return updated;
    });
    if (!row) { res.status(404).json({ error: "legalCase not found" }); return; }
    await recordAudit(req, { action: "close", entity: "legalCase", entityId: id, newValue: row });
    res.json(serializeRow(row as Record<string, unknown>));
  } catch (err) {
    if (mapPostingError(res, err)) return;
    throw err;
  }
});

router.post("/legal-cases/:id/reopen", requirePermission("legalCases.reopen"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const userId = req.authUser?.id ?? null;
  try {
    const row = await db.transaction(async (tx) => {
      const c = await loadForUpdate(tx, legalCasesTable, id);
      if (!c) return null;
      if (c.status !== "closed") throw new PostingError(409, "Only a closed case can be reopened");
      const [updated] = await tx
        .update(legalCasesTable)
        .set({ status: "in_progress", closedAt: null })
        .where(eq(legalCasesTable.id, id))
        .returning();
      return updated;
    });
    if (!row) { res.status(404).json({ error: "legalCase not found" }); return; }
    await recordAudit(req, { action: "reopen", entity: "legalCase", entityId: id, newValue: row });
    res.json(serializeRow(row as Record<string, unknown>));
  } catch (err) {
    if (mapPostingError(res, err)) return;
    throw err;
  }
});

/* ----------------------------- Legal notices --------------------------- */

router.post("/legal-notices/:id/send", requirePermission("legalNotices.send"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const userId = req.authUser?.id ?? null;
  try {
    const row = await db.transaction(async (tx) => {
      const n = await loadForUpdate(tx, legalNoticesTable, id);
      if (!n) return null;
      if (n.status !== "draft") throw new PostingError(409, "Only a draft notice can be sent");
      const [updated] = await tx
        .update(legalNoticesTable)
        .set({ status: "sent" })
        .where(eq(legalNoticesTable.id, id))
        .returning();
      return updated;
    });
    if (!row) { res.status(404).json({ error: "legalNotice not found" }); return; }
    await recordAudit(req, { action: "send", entity: "legalNotice", entityId: id, newValue: row });
    res.json(serializeRow(row as Record<string, unknown>));
  } catch (err) {
    if (mapPostingError(res, err)) return;
    throw err;
  }
});

/* ------------------------------------------------------------------ */
/* Legal dashboard + reports                                          */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function companyCond(t: any, companyId: string | undefined): SQL | undefined {
  return companyId ? eq(t.companyId, companyId) : undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function countWhere(t: any, companyId: string | undefined, extra?: SQL): Promise<number> {
  const conds: SQL[] = [eq(t.isDeleted, false)];
  const c = companyCond(t, companyId);
  if (c) conds.push(c);
  if (extra) conds.push(extra);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(t).where(and(...conds));
  return count;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sumWhere(t: any, col: any, companyId: string | undefined, extra?: SQL): Promise<string> {
  const conds: SQL[] = [eq(t.isDeleted, false)];
  const c = companyCond(t, companyId);
  if (c) conds.push(c);
  if (extra) conds.push(extra);
  const [{ total }] = await db.select({ total: sql<string>`coalesce(sum(${col}), 0)::text` }).from(t).where(and(...conds));
  return total;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function groupCount(t: any, col: any, companyId: string | undefined): Promise<{ key: string | null; count: number }[]> {
  const conds: SQL[] = [eq(t.isDeleted, false)];
  const c = companyCond(t, companyId);
  if (c) conds.push(c);
  const rows = await db
    .select({ key: col, count: sql<number>`count(*)::int` })
    .from(t)
    .where(and(...conds))
    .groupBy(col);
  return rows as { key: string | null; count: number }[];
}

const expiringSoonCond = sql`${legalContractsTable.expiryDate} is not null and ${legalContractsTable.expiryDate} >= current_date and ${legalContractsTable.expiryDate} <= current_date + interval '30 days'` as SQL;
const expiredCond = sql`(${legalContractsTable.status} = 'expired') or (${legalContractsTable.expiryDate} is not null and ${legalContractsTable.expiryDate} < current_date)` as SQL;
const openCaseCond = sql`${legalCasesTable.status} not in ('closed', 'won', 'lost', 'settled')` as SQL;

router.get("/legal/dashboard", async (req, res): Promise<void> => {
  const companyId = qStr(req.query as Record<string, unknown>, "companyId");
  const [contractsCount, activeContracts, expiringSoon, casesCount, openCases, pendingNotices] = await Promise.all([
    countWhere(legalContractsTable, companyId),
    countWhere(legalContractsTable, companyId, eq(legalContractsTable.status, "active")),
    countWhere(legalContractsTable, companyId, expiringSoonCond),
    countWhere(legalCasesTable, companyId),
    countWhere(legalCasesTable, companyId, openCaseCond),
    countWhere(legalNoticesTable, companyId, eq(legalNoticesTable.status, "draft")),
  ]);
  const totalClaimAmount = await sumWhere(legalClaimsTable, legalClaimsTable.amount, companyId);
  const [contractsByStatus, contractsByType, contractsBySource, casesByStatus] = await Promise.all([
    groupCount(legalContractsTable, legalContractsTable.status, companyId),
    groupCount(legalContractsTable, legalContractsTable.contractType, companyId),
    groupCount(legalContractsTable, legalContractsTable.sourceModule, companyId),
    groupCount(legalCasesTable, legalCasesTable.status, companyId),
  ]);
  res.json({
    contractsCount,
    activeContracts,
    expiringSoon,
    casesCount,
    openCases,
    pendingNotices,
    totalClaimAmount,
    contractsByStatus,
    contractsByType,
    contractsBySource,
    casesByStatus,
  });
});

router.get("/legal/reports/contracts", async (req, res): Promise<void> => {
  const companyId = qStr(req.query as Record<string, unknown>, "companyId");
  const [total, expiringSoon, expired, byStatus, byType, bySource] = await Promise.all([
    countWhere(legalContractsTable, companyId),
    countWhere(legalContractsTable, companyId, expiringSoonCond),
    countWhere(legalContractsTable, companyId, expiredCond),
    groupCount(legalContractsTable, legalContractsTable.status, companyId),
    groupCount(legalContractsTable, legalContractsTable.contractType, companyId),
    groupCount(legalContractsTable, legalContractsTable.sourceModule, companyId),
  ]);
  res.json({ total, expiringSoon, expired, byStatus, byType, bySource });
});

router.get("/legal/reports/litigation", async (req, res): Promise<void> => {
  const companyId = qStr(req.query as Record<string, unknown>, "companyId");
  const [total, totalClaimAmount, byStatus, byType] = await Promise.all([
    countWhere(legalCasesTable, companyId),
    sumWhere(legalCasesTable, legalCasesTable.claimAmount, companyId),
    groupCount(legalCasesTable, legalCasesTable.status, companyId),
    groupCount(legalCasesTable, legalCasesTable.caseType, companyId),
  ]);
  res.json({ total, totalClaimAmount, byStatus, byType });
});

router.get("/legal/reports/claims", async (req, res): Promise<void> => {
  const companyId = qStr(req.query as Record<string, unknown>, "companyId");
  const [total, totalAmount, byStatus, byType] = await Promise.all([
    countWhere(legalClaimsTable, companyId),
    sumWhere(legalClaimsTable, legalClaimsTable.amount, companyId),
    groupCount(legalClaimsTable, legalClaimsTable.status, companyId),
    groupCount(legalClaimsTable, legalClaimsTable.claimType, companyId),
  ]);
  res.json({ total, totalAmount, byStatus, byType });
});

router.get("/legal/reports/advisors", async (req, res): Promise<void> => {
  const companyId = qStr(req.query as Record<string, unknown>, "companyId");
  const [totalCases, byAdvisor, byLawFirm] = await Promise.all([
    countWhere(legalCasesTable, companyId),
    groupCount(legalCasesTable, legalCasesTable.advisorId, companyId),
    groupCount(legalCasesTable, legalCasesTable.lawFirmId, companyId),
  ]);
  res.json({ totalCases, byAdvisor, byLawFirm });
});

export default router;
