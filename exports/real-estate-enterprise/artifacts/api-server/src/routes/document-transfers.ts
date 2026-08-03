import { Router, type IRouter, type Request } from "express";
import { and, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import {
  db,
  documentsTable,
  documentVersionsTable,
  documentTransfersTable,
  documentTransferRecipientsTable,
  departmentsTable,
  usersTable,
} from "@workspace/db";
import {
  SendDocumentBody,
  ListDocumentInboxResponse,
  ListSentDocumentsResponse,
  GetDocumentTransferResponse,
} from "@workspace/api-zod";
import { requireAuth, requirePermission } from "../middleware/auth";
import { pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { notify, recipientsByDepartment } from "../lib/notify";
import { presentDocument, loadVersions, canSeeDocument } from "../lib/edms";

type Row = Record<string, unknown>;

const MODULE = "documentTransfers";

const router: IRouter = Router();
router.use(requireAuth);

/** Resolve the acting user's id + display name from the auth context. */
function actor(req: Request): { id: string; name: string } {
  const u = req.authUser!;
  return { id: u.id, name: u.fullName || u.username };
}

/** Coerce a DB Date (or already-ISO string) to an ISO string for z.string() fields. */
function toIso(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function presentTransfer(
  t: Row,
  doc?: Row | null,
  counts?: { sent: number; received: number; viewed: number },
): Record<string, unknown> {
  return {
    id: String(t.id),
    companyId: String(t.companyId),
    documentId: String(t.documentId),
    documentNumber: doc ? (doc.documentNumber as string) ?? null : null,
    documentName: doc ? (doc.name as string) ?? null : null,
    documentNameAr: doc ? (doc.nameAr as string) ?? null : null,
    documentType: doc ? (doc.documentType as string) ?? null : null,
    fileFormat: doc ? (doc.fileFormat as string) ?? null : null,
    senderUserId: String(t.senderUserId),
    senderUserName: (t.senderUserName as string) ?? null,
    subject: (t.subject as string) ?? null,
    note: (t.note as string) ?? null,
    priority: String(t.priority ?? "normal"),
    recipientSummary: (t.recipientSummary as string) ?? null,
    recipientCount: Number(t.recipientCount ?? 0),
    sentCount: counts ? counts.sent : null,
    receivedCount: counts ? counts.received : null,
    viewedCount: counts ? counts.viewed : null,
    isActive: Boolean(t.isActive),
    isDeleted: Boolean(t.isDeleted),
    createdAt: toIso(t.createdAt)!,
    updatedAt: toIso(t.updatedAt)!,
  };
}

function presentRecipient(r: Row): Record<string, unknown> {
  return {
    id: String(r.id),
    companyId: String(r.companyId),
    transferId: String(r.transferId),
    documentId: String(r.documentId),
    recipientUserId: String(r.recipientUserId),
    recipientUserName: (r.recipientUserName as string) ?? null,
    viaDepartmentId: r.viaDepartmentId ? String(r.viaDepartmentId) : null,
    viaDepartmentName: (r.viaDepartmentName as string) ?? null,
    status: String(r.status ?? "sent"),
    receivedAt: toIso(r.receivedAt),
    viewedAt: toIso(r.viewedAt),
    isActive: Boolean(r.isActive),
    createdAt: toIso(r.createdAt)!,
  };
}

/* ----------------------------------------------------------------- */
/* Send a document (route an existing EDMS document to recipients)    */
/* ----------------------------------------------------------------- */
router.post(
  "/document-transfers",
  requirePermission(`${MODULE}.send`),
  async (req, res): Promise<void> => {
    const parsed = SendDocumentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const body = parsed.data;
    const me = actor(req);
    const myCompanyId = req.authUser!.companyId ?? null;
    // Clamp priority to the supported set; the contract types it as a free
    // string, so guard against uncontrolled values being persisted/displayed.
    const PRIORITIES = ["normal", "medium", "high", "urgent"] as const;
    const priority = PRIORITIES.includes(body.priority as (typeof PRIORITIES)[number])
      ? (body.priority as string)
      : "normal";

    // The document must exist and be live. The file is referenced — never copied.
    const docRows = (await db
      .select()
      .from(documentsTable)
      .where(and(eq(documentsTable.id, body.documentId), eq(documentsTable.isDeleted, false)))
      .limit(1)) as Row[];
    const doc = docRows[0];
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    const companyId = String(doc.companyId);
    // Company scope: a company-bound sender can only route documents within their
    // own company; a global (null-company) user is unscoped.
    if (myCompanyId && companyId !== myCompanyId) {
      res.status(403).json({ error: "You cannot send documents for this company." });
      return;
    }
    // EDMS read authorization: a sender may only route a document they are
    // themselves allowed to see (owner/creator, scope match, or public within
    // company; "*"/documents.viewAll bypass). Mirrors the documents detail route
    // so `documentTransfers.send` cannot bypass document-level visibility.
    if (!canSeeDocument(req.authUser!, doc)) {
      res.status(403).json({ error: "You do not have access to this document." });
      return;
    }

    // Resolve the audience to individual user ids. A user reached via a targeted
    // department carries that department's id/name; a directly-addressed user
    // overrides any department attribution (direct wins).
    const viaByUser = new Map<string, { deptId: string; deptName: string | null }>();

    const deptIds = [...new Set((body.recipientDepartmentIds ?? []).filter(Boolean))];
    if (deptIds.length) {
      const deptRows = (await db
        .select()
        .from(departmentsTable)
        .where(
          and(
            inArray(departmentsTable.id, deptIds),
            eq(departmentsTable.companyId, companyId),
            eq(departmentsTable.isDeleted, false),
          ),
        )) as Row[];
      for (const d of deptRows) {
        const members = await recipientsByDepartment(db, String(d.id));
        for (const uid of members) {
          if (uid === me.id) continue;
          if (!viaByUser.has(uid)) {
            viaByUser.set(uid, { deptId: String(d.id), deptName: (d.name as string) ?? null });
          }
        }
      }
    }

    const directIds = [...new Set((body.recipientUserIds ?? []).filter(Boolean))];
    const directSet = new Set<string>();
    if (directIds.length) {
      // Only live users within the document's company (or unscoped/global users).
      const userRows = (await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(
          and(
            inArray(usersTable.id, directIds),
            eq(usersTable.isDeleted, false),
            eq(usersTable.isActive, true),
            or(eq(usersTable.companyId, companyId), isNull(usersTable.companyId)),
          ),
        )) as Row[];
      for (const u of userRows) {
        const uid = String(u.id);
        if (uid === me.id) continue;
        directSet.add(uid);
        viaByUser.delete(uid); // direct addressing overrides department attribution
      }
    }

    const recipientIds = [...new Set([...directSet, ...viaByUser.keys()])];
    if (recipientIds.length === 0) {
      res.status(400).json({ error: "No valid recipients." });
      return;
    }

    // Display names for recipients + summary.
    const nameRows = (await db
      .select({ id: usersTable.id, fullName: usersTable.fullName })
      .from(usersTable)
      .where(inArray(usersTable.id, recipientIds))) as Row[];
    const nameById = new Map<string, string>();
    for (const n of nameRows) nameById.set(String(n.id), (n.fullName as string) ?? "");

    const deptNames = [
      ...new Set([...viaByUser.values()].map((v) => v.deptName).filter(Boolean) as string[]),
    ];
    const directNames = [...directSet].map((id) => nameById.get(id)).filter(Boolean) as string[];
    const summaryParts = [...directNames, ...deptNames];
    let recipientSummary = summaryParts.slice(0, 4).join(", ");
    if (summaryParts.length > 4) recipientSummary += ` +${summaryParts.length - 4}`;

    const created = await db.transaction(async (tx) => {
      const ins = (await tx
        .insert(documentTransfersTable)
        .values({
          companyId,
          documentId: String(doc.id),
          senderUserId: me.id,
          senderUserName: me.name,
          subject: body.subject ?? null,
          note: body.note ?? null,
          priority,
          recipientSummary: recipientSummary || null,
          recipientCount: recipientIds.length,
        })
        .returning()) as Row[];
      const transfer = ins[0];

      await tx.insert(documentTransferRecipientsTable).values(
        recipientIds.map((uid) => {
          const via = viaByUser.get(uid);
          return {
            companyId,
            transferId: String(transfer.id),
            documentId: String(doc.id),
            recipientUserId: uid,
            recipientUserName: nameById.get(uid) ?? null,
            viaDepartmentId: via?.deptId ?? null,
            viaDepartmentName: via?.deptName ?? null,
            status: "sent",
          };
        }),
      );

      // In-system notification with a direct link to the recipient's inbox entry.
      await notify(tx, {
        recipientUserIds: recipientIds,
        companyId,
        actorUserId: me.id,
        category: "documents",
        eventType: "document_sent",
        priority,
        title: body.subject || `Document received: ${doc.name}`,
        body:
          body.note ||
          `${me.name} sent you the document "${doc.name}" (${doc.documentNumber}).`,
        sourceModule: "document_transfers",
        sourceId: String(transfer.id),
        sourceRef: (doc.documentNumber as string) ?? null,
        link: `/document-transfers?transfer=${String(transfer.id)}`,
      });

      return transfer;
    });

    await recordAudit(req, {
      action: "send",
      entity: "document_transfer",
      entityId: String(created.id),
      newValue: {
        documentId: String(doc.id),
        documentNumber: doc.documentNumber,
        recipientCount: recipientIds.length,
        recipientUserIds: recipientIds,
        departmentIds: deptIds,
      },
    });

    res
      .status(201)
      .json(presentTransfer(created, doc, { sent: recipientIds.length, received: 0, viewed: 0 }));
  },
);

/* ----------------------------------------------------------------- */
/* Inbox: documents sent to the current user                          */
/* ----------------------------------------------------------------- */
router.get("/document-transfers/inbox", async (req, res): Promise<void> => {
  const me = req.authUser!.id;
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);

  const filters: SQL[] = [
    eq(documentTransferRecipientsTable.recipientUserId, me),
    eq(documentTransferRecipientsTable.isDeleted, false),
  ];
  const status = qStr(q, "status");
  if (status) filters.push(eq(documentTransferRecipientsTable.status, status));
  const search = qStr(q, "search");
  if (search) {
    const s = or(
      ilike(documentsTable.name, `%${search}%`),
      ilike(documentsTable.nameAr, `%${search}%`),
      ilike(documentsTable.documentNumber, `%${search}%`),
      ilike(documentTransfersTable.subject, `%${search}%`),
    );
    if (s) filters.push(s);
  }
  const where = and(...filters);

  const countRes = (await db
    .select({ count: sql<number>`count(*)::int` })
    .from(documentTransferRecipientsTable)
    .innerJoin(
      documentTransfersTable,
      eq(documentTransfersTable.id, documentTransferRecipientsTable.transferId),
    )
    .innerJoin(documentsTable, eq(documentsTable.id, documentTransferRecipientsTable.documentId))
    .where(where)) as { count: number }[];

  const rows = (await db
    .select({
      rid: documentTransferRecipientsTable.id,
      transferId: documentTransferRecipientsTable.transferId,
      documentId: documentTransferRecipientsTable.documentId,
      status: documentTransferRecipientsTable.status,
      receivedAt: documentTransferRecipientsTable.receivedAt,
      viewedAt: documentTransferRecipientsTable.viewedAt,
      createdAt: documentTransferRecipientsTable.createdAt,
      viaDepartmentId: documentTransferRecipientsTable.viaDepartmentId,
      viaDepartmentName: documentTransferRecipientsTable.viaDepartmentName,
      senderUserId: documentTransfersTable.senderUserId,
      senderUserName: documentTransfersTable.senderUserName,
      subject: documentTransfersTable.subject,
      note: documentTransfersTable.note,
      priority: documentTransfersTable.priority,
      documentNumber: documentsTable.documentNumber,
      documentName: documentsTable.name,
      documentNameAr: documentsTable.nameAr,
      documentType: documentsTable.documentType,
      currentVersionId: documentsTable.currentVersionId,
      fileFormat: documentVersionsTable.fileFormat,
    })
    .from(documentTransferRecipientsTable)
    .innerJoin(
      documentTransfersTable,
      eq(documentTransfersTable.id, documentTransferRecipientsTable.transferId),
    )
    .innerJoin(documentsTable, eq(documentsTable.id, documentTransferRecipientsTable.documentId))
    .leftJoin(
      documentVersionsTable,
      eq(documentVersionsTable.id, documentsTable.currentVersionId),
    )
    .where(where)
    .orderBy(desc(documentTransferRecipientsTable.createdAt))
    .limit(pageSize)
    .offset(offset)) as Row[];

  const data = rows.map((r) => ({
    id: String(r.rid),
    transferId: String(r.transferId),
    documentId: String(r.documentId),
    documentNumber: (r.documentNumber as string) ?? null,
    documentName: (r.documentName as string) ?? null,
    documentNameAr: (r.documentNameAr as string) ?? null,
    documentType: (r.documentType as string) ?? null,
    fileFormat: (r.fileFormat as string) ?? null,
    currentVersionId: r.currentVersionId ? String(r.currentVersionId) : null,
    senderUserId: r.senderUserId ? String(r.senderUserId) : null,
    senderUserName: (r.senderUserName as string) ?? null,
    subject: (r.subject as string) ?? null,
    note: (r.note as string) ?? null,
    priority: (r.priority as string) ?? null,
    viaDepartmentId: r.viaDepartmentId ? String(r.viaDepartmentId) : null,
    viaDepartmentName: (r.viaDepartmentName as string) ?? null,
    status: String(r.status ?? "sent"),
    receivedAt: toIso(r.receivedAt),
    viewedAt: toIso(r.viewedAt),
    createdAt: toIso(r.createdAt)!,
  }));

  res.json(
    ListDocumentInboxResponse.parse({ data, total: countRes[0].count, page, pageSize }),
  );
});

/* ----------------------------------------------------------------- */
/* Sent: documents the current user has sent                          */
/* ----------------------------------------------------------------- */
router.get("/document-transfers/sent", async (req, res): Promise<void> => {
  const me = req.authUser!.id;
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);

  const filters: SQL[] = [
    eq(documentTransfersTable.senderUserId, me),
    eq(documentTransfersTable.isDeleted, false),
  ];
  const search = qStr(q, "search");
  if (search) {
    const s = or(
      ilike(documentsTable.name, `%${search}%`),
      ilike(documentsTable.documentNumber, `%${search}%`),
      ilike(documentTransfersTable.subject, `%${search}%`),
      ilike(documentTransfersTable.recipientSummary, `%${search}%`),
    );
    if (s) filters.push(s);
  }
  const where = and(...filters);

  const countRes = (await db
    .select({ count: sql<number>`count(*)::int` })
    .from(documentTransfersTable)
    .innerJoin(documentsTable, eq(documentsTable.id, documentTransfersTable.documentId))
    .where(where)) as { count: number }[];

  const rows = (await db
    .select({
      t: documentTransfersTable,
      documentNumber: documentsTable.documentNumber,
      documentName: documentsTable.name,
      documentNameAr: documentsTable.nameAr,
      documentType: documentsTable.documentType,
    })
    .from(documentTransfersTable)
    .innerJoin(documentsTable, eq(documentsTable.id, documentTransfersTable.documentId))
    .where(where)
    .orderBy(desc(documentTransfersTable.createdAt))
    .limit(pageSize)
    .offset(offset)) as Array<{ t: Row } & Row>;

  const ids = rows.map((r) => String(r.t.id));
  const counts = new Map<string, { sent: number; received: number; viewed: number }>();
  if (ids.length) {
    const statusRows = (await db
      .select({
        transferId: documentTransferRecipientsTable.transferId,
        status: documentTransferRecipientsTable.status,
        c: sql<number>`count(*)::int`,
      })
      .from(documentTransferRecipientsTable)
      .where(
        and(
          inArray(documentTransferRecipientsTable.transferId, ids),
          eq(documentTransferRecipientsTable.isDeleted, false),
        ),
      )
      .groupBy(
        documentTransferRecipientsTable.transferId,
        documentTransferRecipientsTable.status,
      )) as Row[];
    for (const s of statusRows) {
      const key = String(s.transferId);
      const entry = counts.get(key) ?? { sent: 0, received: 0, viewed: 0 };
      const st = String(s.status);
      if (st === "sent") entry.sent += Number(s.c);
      else if (st === "received") entry.received += Number(s.c);
      else if (st === "viewed") entry.viewed += Number(s.c);
      counts.set(key, entry);
    }
  }

  const data = rows.map((r) =>
    presentTransfer(
      r.t,
      {
        documentNumber: r.documentNumber,
        name: r.documentName,
        nameAr: r.documentNameAr,
        documentType: r.documentType,
      },
      counts.get(String(r.t.id)) ?? { sent: 0, received: 0, viewed: 0 },
    ),
  );

  res.json(
    ListSentDocumentsResponse.parse({ data, total: countRes[0].count, page, pageSize }),
  );
});

/* ----------------------------------------------------------------- */
/* Detail: a transfer with its document + per-recipient status        */
/* ----------------------------------------------------------------- */
router.get("/document-transfers/:id", async (req, res): Promise<void> => {
  const me = req.authUser!.id;
  const id = req.params.id;

  const tRows = (await db
    .select()
    .from(documentTransfersTable)
    .where(and(eq(documentTransfersTable.id, id), eq(documentTransfersTable.isDeleted, false)))
    .limit(1)) as Row[];
  const transfer = tRows[0];
  if (!transfer) {
    res.status(404).json({ error: "Transfer not found" });
    return;
  }

  const recipients = (await db
    .select()
    .from(documentTransferRecipientsTable)
    .where(
      and(
        eq(documentTransferRecipientsTable.transferId, id),
        eq(documentTransferRecipientsTable.isDeleted, false),
      ),
    )
    .orderBy(desc(documentTransferRecipientsTable.createdAt))) as Row[];

  const isSender = String(transfer.senderUserId) === me;
  const myRecipient = recipients.find((r) => String(r.recipientUserId) === me);
  if (!isSender && !myRecipient) {
    res.status(403).json({ error: "You do not have access to this transfer." });
    return;
  }

  const docRows = (await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.id, String(transfer.documentId)))
    .limit(1)) as Row[];
  const docRow = docRows[0];
  const versions = docRow ? await loadVersions(String(docRow.id)) : [];
  const currentVersion = versions.find(
    (v) => String(v.id) === String(docRow?.currentVersionId),
  );

  const counts = { sent: 0, received: 0, viewed: 0 };
  for (const r of recipients) {
    const st = String(r.status);
    if (st === "sent") counts.sent += 1;
    else if (st === "received") counts.received += 1;
    else if (st === "viewed") counts.viewed += 1;
  }

  res.json(
    GetDocumentTransferResponse.parse({
      transfer: presentTransfer(
        transfer,
        docRow
          ? {
              documentNumber: docRow.documentNumber,
              name: docRow.name,
              nameAr: docRow.nameAr,
              documentType: docRow.documentType,
              fileFormat: currentVersion?.fileFormat ?? null,
            }
          : null,
        counts,
      ),
      document: docRow ? presentDocument(docRow, versions) : null,
      recipients: recipients.map(presentRecipient),
      myStatus: myRecipient ? String(myRecipient.status) : null,
    }),
  );
});

/** Mark a recipient row delivered. Returns the new status (idempotent). */
async function markRecipientStatus(
  req: Request,
  next: "received" | "viewed",
): Promise<{ code: number; body: Record<string, unknown> }> {
  const me = req.authUser!.id;
  const id = String(req.params.id);
  const rows = (await db
    .select()
    .from(documentTransferRecipientsTable)
    .where(
      and(
        eq(documentTransferRecipientsTable.transferId, id),
        eq(documentTransferRecipientsTable.recipientUserId, me),
        eq(documentTransferRecipientsTable.isDeleted, false),
      ),
    )
    .limit(1)) as Row[];
  const row = rows[0];
  if (!row) return { code: 404, body: { error: "Transfer not found" } };

  const now = new Date();
  const current = String(row.status);
  if (next === "received") {
    if (current === "sent") {
      await db
        .update(documentTransferRecipientsTable)
        .set({ status: "received", receivedAt: now })
        .where(eq(documentTransferRecipientsTable.id, String(row.id)));
      await recordAudit(req, {
        action: "receive",
        entity: "document_transfer",
        entityId: id,
      });
    }
  } else {
    // viewed implies received
    if (current !== "viewed") {
      await db
        .update(documentTransferRecipientsTable)
        .set({
          status: "viewed",
          viewedAt: now,
          receivedAt: (row.receivedAt as Date | null) ?? now,
        })
        .where(eq(documentTransferRecipientsTable.id, String(row.id)));
      await recordAudit(req, {
        action: "view",
        entity: "document_transfer",
        entityId: id,
      });
    }
  }
  return { code: 200, body: { ok: true } };
}

router.post("/document-transfers/:id/received", async (req, res): Promise<void> => {
  const r = await markRecipientStatus(req, "received");
  res.status(r.code).json(r.body);
});

router.post("/document-transfers/:id/viewed", async (req, res): Promise<void> => {
  const r = await markRecipientStatus(req, "viewed");
  res.status(r.code).json(r.body);
});

export default router;
