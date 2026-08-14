import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, inArray, isNotNull, or, sql, type SQL } from "drizzle-orm";
import {
  db,
  correspondenceTable,
  correspondenceRecipientsTable,
  documentLinksTable,
} from "@workspace/db";
import { requirePermission } from "../middleware/auth";
import { recordAudit } from "../lib/audit";
import { notify } from "../lib/notify";
import { nextDocumentNumber } from "../lib/doc-number";
import {
  addressableFor,
  assertAddressable,
  employeeForUser,
  leadership,
  loadEmployee,
  userIdsForEmployees,
  type DirectoryEmployee,
} from "../lib/correspondence-directory";

/**
 * Internal correspondence — staff-to-staff official mail.
 *
 * It rides on the existing correspondence register rather than a private
 * table: same numbering, same audit, same company scoping, with recipients in
 * a join table so read state is per person. Nothing here re-implements
 * notifications, documents or auditing — each is the module that already owns
 * that job.
 *
 * Authorisation is answered in the query, not after it. A viewer's rows are
 * "mine, or addressed to me", expressed as a WHERE fragment, so there is no
 * moment where a row the caller may not see exists in memory.
 */

const MODULE = "correspondence";
const router: IRouter = Router();

type Row = Record<string, unknown>;

const str = (q: Record<string, unknown>, k: string): string | undefined => {
  const v = q[k];
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
};

const page = (q: Record<string, unknown>) => {
  const p = Math.max(1, Number(str(q, "page") ?? 1) || 1);
  const size = Math.min(200, Math.max(1, Number(str(q, "pageSize") ?? 20) || 20));
  return { page: p, pageSize: size, offset: (p - 1) * size };
};

/**
 * The acting employee, or a 409 telling the operator what to fix.
 *
 * A login with no `employeeId` cannot take part: the hierarchy rules have no
 * way to place them. That is a configuration gap, not a permission failure, so
 * it does not answer 403 — a 403 would send someone hunting through roles for
 * a problem that lives in the employee record.
 */
async function actingEmployee(
  req: { authUser?: { id: string } },
  res: { status: (c: number) => { json: (b: unknown) => void } },
): Promise<DirectoryEmployee | null> {
  const me = await employeeForUser(req.authUser!.id);
  if (!me) {
    res.status(409).json({
      error:
        "This login is not linked to an employee record, so it cannot send or receive internal correspondence. " +
        "Link the user to an employee first.",
    });
    return null;
  }
  return me;
}

/** Rows this employee may see: authored by them, or addressed to them. */
function visibleTo(employeeId: string): SQL {
  const addressed = db
    .select({ id: correspondenceRecipientsTable.correspondenceId })
    .from(correspondenceRecipientsTable)
    .where(
      and(
        eq(correspondenceRecipientsTable.employeeId, employeeId),
        eq(correspondenceRecipientsTable.isDeleted, false),
      ),
    );
  return or(
    eq(correspondenceTable.senderEmployeeId, employeeId),
    inArray(correspondenceTable.id, addressed),
  )!;
}

async function recipientsOf(correspondenceIds: string[]): Promise<Map<string, Row[]>> {
  if (correspondenceIds.length === 0) return new Map();
  const rows = (await db
    .select()
    .from(correspondenceRecipientsTable)
    .where(
      and(
        inArray(correspondenceRecipientsTable.correspondenceId, correspondenceIds),
        eq(correspondenceRecipientsTable.isDeleted, false),
      ),
    )) as Row[];
  const byId = new Map<string, Row[]>();
  for (const r of rows) {
    const key = String(r.correspondenceId);
    byId.set(key, [...(byId.get(key) ?? []), r]);
  }
  return byId;
}

const present = (row: Row, recipients: Row[]) => ({
  ...row,
  recipients: recipients.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    kind: r.kind,
    readAt: r.readAt,
    deliveredAt: r.deliveredAt,
    archivedAt: r.archivedAt,
  })),
});

/* -------------------------------------------------------------------------- */
/* Directory                                                                  */
/* -------------------------------------------------------------------------- */

/** Who the caller may write to, plus who currently holds each leadership post. */
router.get(
  "/internal-correspondence/directory",
  requirePermission(`${MODULE}.view`),
  async (req, res): Promise<void> => {
    const me = await actingEmployee(req, res);
    if (!me) return;
    const companyId = str(req.query as Record<string, unknown>, "companyId");
    if (!companyId) {
      res.status(400).json({ error: "companyId is required." });
      return;
    }
    const [recipients, posts] = await Promise.all([
      addressableFor(companyId, me),
      leadership(companyId),
    ]);
    res.json({ me, recipients, leadership: posts });
  },
);

/* -------------------------------------------------------------------------- */
/* Mailboxes                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * One list endpoint, five views. Inbox, sent, drafts, archived and the
 * needs-reply queue differ only by predicate, so they share a query rather
 * than becoming five near-identical handlers that drift apart.
 */
router.get(
  "/internal-correspondence",
  requirePermission(`${MODULE}.view`),
  async (req, res): Promise<void> => {
    const me = await actingEmployee(req, res);
    if (!me) return;
    const q = req.query as Record<string, unknown>;
    const { page: p, pageSize, offset } = page(q);
    const view = str(q, "view") ?? "inbox";

    const filters: SQL[] = [
      eq(correspondenceTable.isInternal, true),
      eq(correspondenceTable.isDeleted, false),
    ];
    const companyId = str(q, "companyId");
    if (companyId) filters.push(eq(correspondenceTable.companyId, companyId));

    const addressedToMe = db
      .select({ id: correspondenceRecipientsTable.correspondenceId })
      .from(correspondenceRecipientsTable)
      .where(
        and(
          eq(correspondenceRecipientsTable.employeeId, me.id),
          eq(correspondenceRecipientsTable.isDeleted, false),
        ),
      );

    switch (view) {
      case "sent":
        filters.push(eq(correspondenceTable.senderEmployeeId, me.id));
        filters.push(isNotNull(correspondenceTable.sentAt));
        break;
      case "drafts":
        filters.push(eq(correspondenceTable.senderEmployeeId, me.id));
        filters.push(eq(correspondenceTable.status, "draft"));
        break;
      case "archived": {
        // Archiving is personal: filing a message away is one reader's decision
        // and must not remove it from anyone else's inbox. So the view asks
        // "did I archive my copy", not "is the message archived" — the latter
        // would only ever be true for the sender.
        const archivedByMe = db
          .select({ id: correspondenceRecipientsTable.correspondenceId })
          .from(correspondenceRecipientsTable)
          .where(
            and(
              eq(correspondenceRecipientsTable.employeeId, me.id),
              isNotNull(correspondenceRecipientsTable.archivedAt),
              eq(correspondenceRecipientsTable.isDeleted, false),
            ),
          );
        filters.push(
          or(
            inArray(correspondenceTable.id, archivedByMe),
            and(
              eq(correspondenceTable.senderEmployeeId, me.id),
              isNotNull(correspondenceTable.archivedAt),
            )!,
          )!,
        );
        break;
      }
      case "needs_reply":
        filters.push(inArray(correspondenceTable.id, addressedToMe));
        filters.push(eq(correspondenceTable.correspondenceKind, "action_required"));
        break;
      default: // inbox
        filters.push(inArray(correspondenceTable.id, addressedToMe));
        filters.push(isNotNull(correspondenceTable.sentAt));
    }

    const search = str(q, "search");
    if (search) {
      const like = `%${search}%`;
      filters.push(
        or(
          ilike(correspondenceTable.subject, like),
          ilike(correspondenceTable.code, like),
          ilike(correspondenceTable.body, like),
        )!,
      );
    }
    for (const [key, col] of [
      ["priority", correspondenceTable.priority],
      ["status", correspondenceTable.status],
      ["correspondenceKind", correspondenceTable.correspondenceKind],
      ["departmentId", correspondenceTable.departmentId],
    ] as const) {
      const v = str(q, key);
      if (v) filters.push(eq(col, v));
    }

    const where = and(...filters);
    const [counted] = (await db
      .select({ count: sql<number>`count(*)::int` })
      .from(correspondenceTable)
      .where(where)) as { count: number }[];
    const rows = (await db
      .select()
      .from(correspondenceTable)
      .where(where)
      .orderBy(desc(correspondenceTable.createdAt))
      .limit(pageSize)
      .offset(offset)) as Row[];

    const byId = await recipientsOf(rows.map((r) => String(r.id)));
    res.json({
      data: rows.map((r) => present(r, byId.get(String(r.id)) ?? [])),
      total: counted?.count ?? 0,
      page: p,
      pageSize,
      view,
    });
  },
);

/** Unread count for the caller — drives the inbox badge. */
router.get(
  "/internal-correspondence/unread-count",
  requirePermission(`${MODULE}.view`),
  async (req, res): Promise<void> => {
    const me = await actingEmployee(req, res);
    if (!me) return;
    const [row] = (await db
      .select({ count: sql<number>`count(*)::int` })
      .from(correspondenceRecipientsTable)
      .where(
        and(
          eq(correspondenceRecipientsTable.employeeId, me.id),
          sql`${correspondenceRecipientsTable.readAt} is null`,
          eq(correspondenceRecipientsTable.isDeleted, false),
        ),
      )) as { count: number }[];
    res.json({ unread: row?.count ?? 0 });
  },
);

/* -------------------------------------------------------------------------- */
/* Thread                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * One message plus its whole conversation.
 *
 * Reading marks the caller's own recipient row as read — the notification is
 * not the message, so opening the mail is what clears it, never receiving the
 * notification.
 */
router.get(
  "/internal-correspondence/:id",
  requirePermission(`${MODULE}.view`),
  async (req, res): Promise<void> => {
    const me = await actingEmployee(req, res);
    if (!me) return;
    const id = String(req.params.id);

    const [row] = (await db
      .select()
      .from(correspondenceTable)
      .where(
        and(
          eq(correspondenceTable.id, id),
          eq(correspondenceTable.isInternal, true),
          eq(correspondenceTable.isDeleted, false),
          visibleTo(me.id),
        ),
      )
      .limit(1)) as Row[];
    // Same answer for "does not exist" and "not yours": a different status for
    // each would let anyone probe which ids are real.
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const threadId = String(row.threadId ?? row.id);
    const thread = (await db
      .select()
      .from(correspondenceTable)
      .where(
        and(
          eq(correspondenceTable.threadId, threadId),
          eq(correspondenceTable.isDeleted, false),
          visibleTo(me.id),
        ),
      )
      .orderBy(correspondenceTable.createdAt)) as Row[];

    const [mine] = (await db
      .select()
      .from(correspondenceRecipientsTable)
      .where(
        and(
          eq(correspondenceRecipientsTable.correspondenceId, id),
          eq(correspondenceRecipientsTable.employeeId, me.id),
        ),
      )
      .limit(1)) as Row[];
    if (mine && !mine.readAt) {
      await db
        .update(correspondenceRecipientsTable)
        .set({ readAt: new Date(), deliveredAt: (mine.deliveredAt as Date | null) ?? new Date() })
        .where(eq(correspondenceRecipientsTable.id, String(mine.id)));
      await recordAudit(req, {
        action: "read",
        entity: "correspondence",
        entityId: id,
        newValue: { threadId },
      });
    }

    // Recipients are loaded AFTER the read is written, so the response the
    // caller gets already shows the message as read. Reading first would return
    // a state that was true a millisecond ago and is not any more.
    const byId = await recipientsOf(thread.map((r) => String(r.id)));

    const references = (await db
      .select()
      .from(documentLinksTable)
      .where(
        and(
          eq(documentLinksTable.moduleKey, "correspondence"),
          eq(documentLinksTable.sourceId, id),
          eq(documentLinksTable.isDeleted, false),
        ),
      )) as Row[];

    res.json({
      correspondence: present(row, byId.get(String(row.id)) ?? []),
      thread: thread.map((r) => present(r, byId.get(String(r.id)) ?? [])),
      references,
    });
  },
);

/* -------------------------------------------------------------------------- */
/* Compose / send / reply / forward                                           */
/* -------------------------------------------------------------------------- */

interface ComposeBody {
  companyId?: string;
  subject?: string;
  body?: string;
  priority?: string;
  correspondenceKind?: string;
  confidentiality?: string;
  replyDueDate?: string;
  to?: string[];
  cc?: string[];
  send?: boolean;
  parentId?: string;
  idempotencyKey?: string;
}

/**
 * Create a draft or send outright.
 *
 * `idempotencyKey` makes a repeated submit — a double click, a retried
 * request — return the message that already exists rather than a second copy.
 * Official correspondence sent twice is not a cosmetic problem.
 */
router.post(
  "/internal-correspondence",
  requirePermission(`${MODULE}.create`),
  async (req, res): Promise<void> => {
    const me = await actingEmployee(req, res);
    if (!me) return;
    const b = (req.body ?? {}) as ComposeBody;

    if (!b.companyId) {
      res.status(400).json({ error: "companyId is required." });
      return;
    }
    if (!b.subject?.trim()) {
      res.status(400).json({ error: "A subject is required." });
      return;
    }
    const to = (b.to ?? []).filter(Boolean);
    const cc = (b.cc ?? []).filter(Boolean);
    if (b.send && to.length === 0) {
      res.status(400).json({ error: "At least one recipient is required to send." });
      return;
    }

    // The gate. The picker only suggests; this is what decides.
    const check = await assertAddressable(b.companyId, me, [...to, ...cc]);
    if (!check.ok) {
      res.status(403).json({
        error: "You are not authorised to write to one or more of these recipients.",
        rejected: check.rejected,
      });
      return;
    }

    if (b.idempotencyKey) {
      const [existing] = (await db
        .select()
        .from(correspondenceTable)
        .where(
          and(
            eq(correspondenceTable.isInternal, true),
            eq(correspondenceTable.senderEmployeeId, me.id),
            eq(correspondenceTable.refNumber, b.idempotencyKey),
          ),
        )
        .limit(1)) as Row[];
      if (existing) {
        const byId = await recipientsOf([String(existing.id)]);
        res.status(200).json({
          ...present(existing, byId.get(String(existing.id)) ?? []),
          replayed: true,
        });
        return;
      }
    }

    const code = (await nextDocumentNumber("correspondence")) ?? `CORR-${Date.now()}`;
    const now = new Date();

    const created: Row = await db.transaction(async (tx): Promise<Row> => {
      const [row] = (await tx
        .insert(correspondenceTable)
        .values({
          companyId: b.companyId!,
          code,
          direction: "internal",
          correspondenceType: "internal",
          subject: b.subject!.trim(),
          body: b.body ?? null,
          isInternal: true,
          senderEmployeeId: me.id,
          departmentId: me.departmentId,
          priority: b.priority ?? "medium",
          correspondenceKind: b.correspondenceKind ?? "informational",
          confidentiality: b.confidentiality ?? "internal",
          replyDueDate: b.replyDueDate ?? null,
          parentId: b.parentId ?? null,
          status: b.send ? "sent" : "draft",
          sentAt: b.send ? now : null,
          refNumber: b.idempotencyKey ?? null,
        })
        .returning()) as Row[];

      // A first message is the root of its own thread, so a conversation is one
      // indexed lookup instead of a recursive walk.
      let threadId = String(row.id);
      if (b.parentId) {
        const [parent] = (await tx
          .select({ threadId: correspondenceTable.threadId })
          .from(correspondenceTable)
          .where(eq(correspondenceTable.id, b.parentId))
          .limit(1)) as Row[];
        threadId = String(parent?.threadId ?? b.parentId);
      }
      await tx
        .update(correspondenceTable)
        .set({ threadId })
        .where(eq(correspondenceTable.id, String(row.id)));

      const recipients = [
        ...to.map((employeeId) => ({ employeeId, kind: "to" })),
        ...cc.map((employeeId) => ({ employeeId, kind: "cc" })),
      ];
      if (recipients.length > 0) {
        await tx.insert(correspondenceRecipientsTable).values(
          recipients.map((r) => ({
            companyId: b.companyId!,
            correspondenceId: String(row.id),
            employeeId: r.employeeId,
            kind: r.kind,
            deliveredAt: b.send ? now : null,
          })),
        );
      }

      if (b.send && recipients.length > 0) {
        const userIds = await userIdsForEmployees(recipients.map((r) => r.employeeId));
        await notify(tx, {
          recipientUserIds: userIds,
          companyId: b.companyId!,
          actorUserId: req.authUser?.id,
          category: "correspondence",
          eventType: "correspondence.received",
          priority: b.priority === "urgent" ? "urgent" : b.priority === "high" ? "high" : "normal",
          title: b.subject!.trim(),
          body: `${me.name} — ${code}`,
          sourceModule: "correspondence",
          sourceId: String(row.id),
          sourceRef: code,
          link: `/internal-correspondence/${String(row.id)}`,
        });
      }

      return { ...row, threadId };
    });

    // Metadata only — the body of official mail does not belong in the audit log.
    await recordAudit(req, {
      action: b.send ? "sent" : "created",
      entity: "correspondence",
      entityId: String(created.id),
      newValue: {
        code,
        toCount: to.length,
        ccCount: cc.length,
        kind: b.correspondenceKind ?? "informational",
        priority: b.priority ?? "medium",
      },
    });

    const byId = await recipientsOf([String(created.id)]);
    res.status(201).json(present(created, byId.get(String(created.id)) ?? []));
  },
);

/** Send a draft the caller owns. */
router.post(
  "/internal-correspondence/:id/send",
  requirePermission(`${MODULE}.create`),
  async (req, res): Promise<void> => {
    const me = await actingEmployee(req, res);
    if (!me) return;
    const id = String(req.params.id);

    const [row] = (await db
      .select()
      .from(correspondenceTable)
      .where(
        and(
          eq(correspondenceTable.id, id),
          eq(correspondenceTable.isInternal, true),
          eq(correspondenceTable.senderEmployeeId, me.id),
          eq(correspondenceTable.isDeleted, false),
        ),
      )
      .limit(1)) as Row[];
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (row.sentAt) {
      // Already sent: report the existing state rather than sending twice.
      res.status(200).json({ ...row, replayed: true });
      return;
    }

    const recipients = (await db
      .select()
      .from(correspondenceRecipientsTable)
      .where(eq(correspondenceRecipientsTable.correspondenceId, id))) as Row[];
    if (recipients.length === 0) {
      res.status(400).json({ error: "A draft needs at least one recipient before it can be sent." });
      return;
    }

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(correspondenceTable)
        .set({ status: "sent", sentAt: now })
        .where(eq(correspondenceTable.id, id));
      await tx
        .update(correspondenceRecipientsTable)
        .set({ deliveredAt: now })
        .where(eq(correspondenceRecipientsTable.correspondenceId, id));
      const userIds = await userIdsForEmployees(recipients.map((r) => String(r.employeeId)));
      await notify(tx, {
        recipientUserIds: userIds,
        companyId: String(row.companyId),
        actorUserId: req.authUser?.id,
        category: "correspondence",
        eventType: "correspondence.received",
        priority: String(row.priority) === "urgent" ? "urgent" : "normal",
        title: String(row.subject),
        body: `${me.name} — ${String(row.code)}`,
        sourceModule: "correspondence",
        sourceId: id,
        sourceRef: String(row.code),
        link: `/internal-correspondence/${id}`,
      });
    });

    await recordAudit(req, { action: "sent", entity: "correspondence", entityId: id });
    res.json({ ...row, status: "sent", sentAt: now });
  },
);

/**
 * Forward to someone else.
 *
 * A forward is a new message in the same thread, addressed by the forwarder —
 * so it passes the same authorisation gate as any other send. The recipient
 * therefore sees the conversation only from this point on, never anything the
 * forwarder was not entitled to pass along.
 */
router.post(
  "/internal-correspondence/:id/forward",
  requirePermission(`${MODULE}.create`),
  async (req, res): Promise<void> => {
    const me = await actingEmployee(req, res);
    if (!me) return;
    const id = String(req.params.id);
    const b = (req.body ?? {}) as { to?: string[]; note?: string };
    const to = (b.to ?? []).filter(Boolean);
    if (to.length === 0) {
      res.status(400).json({ error: "At least one recipient is required." });
      return;
    }

    const [row] = (await db
      .select()
      .from(correspondenceTable)
      .where(
        and(
          eq(correspondenceTable.id, id),
          eq(correspondenceTable.isInternal, true),
          eq(correspondenceTable.isDeleted, false),
          visibleTo(me.id),
        ),
      )
      .limit(1)) as Row[];
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const companyId = String(row.companyId);
    const check = await assertAddressable(companyId, me, to);
    if (!check.ok) {
      res.status(403).json({
        error: "You are not authorised to forward to one or more of these recipients.",
        rejected: check.rejected,
      });
      return;
    }

    const code = (await nextDocumentNumber("correspondence")) ?? `CORR-${Date.now()}`;
    const now = new Date();
    const threadId = String(row.threadId ?? row.id);

    const created: Row = await db.transaction(async (tx): Promise<Row> => {
      const [fwd] = (await tx
        .insert(correspondenceTable)
        .values({
          companyId,
          code,
          direction: "internal",
          correspondenceType: "internal",
          subject: `FW: ${String(row.subject)}`,
          body: b.note ?? String(row.body ?? ""),
          isInternal: true,
          senderEmployeeId: me.id,
          departmentId: me.departmentId,
          priority: String(row.priority),
          correspondenceKind: String(row.correspondenceKind ?? "informational"),
          confidentiality: String(row.confidentiality ?? "internal"),
          threadId,
          parentId: id,
          status: "sent",
          sentAt: now,
        })
        .returning()) as Row[];

      await tx.insert(correspondenceRecipientsTable).values(
        to.map((employeeId) => ({
          companyId,
          correspondenceId: String(fwd.id),
          employeeId,
          kind: "to",
          deliveredAt: now,
        })),
      );

      const userIds = await userIdsForEmployees(to);
      await notify(tx, {
        recipientUserIds: userIds,
        companyId,
        actorUserId: req.authUser?.id,
        category: "correspondence",
        eventType: "correspondence.forwarded",
        title: `FW: ${String(row.subject)}`,
        body: `${me.name} — ${code}`,
        sourceModule: "correspondence",
        sourceId: String(fwd.id),
        sourceRef: code,
        link: `/internal-correspondence/${String(fwd.id)}`,
      });
      return fwd;
    });

    await recordAudit(req, {
      action: "forwarded",
      entity: "correspondence",
      entityId: id,
      newValue: { forwardId: String(created.id), toCount: to.length },
    });
    res.status(201).json(created);
  },
);

/** Archive for the caller only — the message stays searchable and auditable. */
router.post(
  "/internal-correspondence/:id/archive",
  requirePermission(`${MODULE}.update`),
  async (req, res): Promise<void> => {
    const me = await actingEmployee(req, res);
    if (!me) return;
    const id = String(req.params.id);
    const [row] = (await db
      .select()
      .from(correspondenceTable)
      .where(
        and(
          eq(correspondenceTable.id, id),
          eq(correspondenceTable.isInternal, true),
          eq(correspondenceTable.isDeleted, false),
          visibleTo(me.id),
        ),
      )
      .limit(1)) as Row[];
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const now = new Date();
    await db
      .update(correspondenceRecipientsTable)
      .set({ archivedAt: now })
      .where(
        and(
          eq(correspondenceRecipientsTable.correspondenceId, id),
          eq(correspondenceRecipientsTable.employeeId, me.id),
        ),
      );
    await db
      .update(correspondenceTable)
      .set({ archivedAt: now })
      .where(and(eq(correspondenceTable.id, id), eq(correspondenceTable.senderEmployeeId, me.id)));
    await recordAudit(req, { action: "archived", entity: "correspondence", entityId: id });
    res.json({ id, archivedAt: now });
  },
);

/**
 * Link an existing document to a message.
 *
 * The file is not copied. This writes a `document_links` row — the same
 * mechanism every other module uses — so the document keeps one owner, one set
 * of permissions and one storage location.
 */
router.post(
  "/internal-correspondence/:id/documents",
  requirePermission(`${MODULE}.update`),
  async (req, res): Promise<void> => {
    const me = await actingEmployee(req, res);
    if (!me) return;
    const id = String(req.params.id);
    const documentId = (req.body ?? {}).documentId as string | undefined;
    if (!documentId) {
      res.status(400).json({ error: "documentId is required." });
      return;
    }

    const [row] = (await db
      .select()
      .from(correspondenceTable)
      .where(
        and(
          eq(correspondenceTable.id, id),
          eq(correspondenceTable.isInternal, true),
          eq(correspondenceTable.isDeleted, false),
          visibleTo(me.id),
        ),
      )
      .limit(1)) as Row[];
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    await db.insert(documentLinksTable).values({
      documentId,
      moduleKey: "correspondence",
      sourceId: id,
      companyId: String(row.companyId),
    });
    await recordAudit(req, {
      action: "attachment-linked",
      entity: "correspondence",
      entityId: id,
      newValue: { documentId },
    });
    res.status(201).json({ correspondenceId: id, documentId });
  },
);

export default router;
