import { nextNumber } from "../lib/doc-number";
import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import {
  db,
  chequesTable,
  chequeStatusHistoryTable,
} from "@workspace/db";
import {
  ListChequesResponse,
  CreateChequeBody,
  GetChequeResponse,
  UpdateChequeBody,
  ListChequeStatusHistorysResponse,
  GetChequeStatusHistoryResponse,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";
import {
  postAutomaticEntry,
  reverseAutomaticEntriesForSource,
} from "../lib/posting";
import { notify, recipientsByPermission } from "../lib/notify";

const router: IRouter = Router();
router.use(requireAuth);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Cheque lifecycle statuses (exactly six, mandatory per cheque). A cheque posts
// to the ledger when it reaches `collected`; transitioning to `returned`/
// `cancelled` reverses that posting. `replaced` is set only via the dedicated
// /replace endpoint (which links the original to its replacement), never a plain
// transition — so a replaced cheque is always traceable to its successor.
const CHEQUE_STATUSES = new Set([
  "received",
  "under_collection",
  "collected",
  "returned",
  "cancelled",
  "replaced",
]);
const COLLECTED = "collected";
const REPLACED = "replaced";
// Return/cancel reverse any posted collection/clearing legs.
const REVERSING_STATUSES = new Set(["returned", "cancelled"]);
// Allowed lifecycle transitions, enforced server-side (the UI mirrors this, but
// direct API callers must not be able to jump to an arbitrary status). `replaced`
// is intentionally absent — replacement goes through POST /cheques/:id/replace.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  received: ["under_collection", "cancelled"],
  under_collection: ["collected", "returned", "cancelled"],
  collected: ["returned"],
  returned: [],
  cancelled: [],
  replaced: [],
};
// A cheque may be swapped for a replacement only while it has not been collected
// (received / under_collection) or after it bounced (returned).
const REPLACEABLE_FROM = new Set(["received", "under_collection", "returned"]);
// Status where a cheque is in the bank's hands pending clearance — the point at
// which the "collection leg" of the two-phase posting is recognised.
const COLLECTING_STATUSES = new Set(["under_collection"]);

// Two-phase ledger model. A cheque posts a "collection" leg when it goes under
// collection / is deposited, then a "clearing" leg when it clears; together they
// net to the same Bank↔AR (or AP↔Bank) movement, with a bridge account
// (Cheques Under Collection / Cheques Payable) carrying the in-between state.
//   collection (incoming): debit Cheques Under Collection / credit Accounts Receivable
//   clearing   (incoming): debit Bank / credit Cheques Under Collection
//   collection (outgoing): debit Accounts Payable / credit Cheques Payable
//   clearing   (outgoing): debit Cheques Payable / credit Bank
const COLLECTION_EVENT: Record<string, string> = {
  incoming: "cheque.incoming.collection",
  outgoing: "cheque.outgoing.collection",
};
const CLEAR_EVENT: Record<string, string> = {
  incoming: "cheque.incoming.cleared",
  outgoing: "cheque.outgoing.cleared",
};
// The collection leg posts under its own source type so the engine's
// per-(sourceType,sourceId) idempotency lets both legs coexist for one cheque.
const COLLECTION_SOURCE = "chequeCollection";
const CLEARING_SOURCE = "cheque";

// Financial fields frozen once a cheque has cleared (driven a ledger entry).
const FROZEN_FIELDS = [
  "amount",
  "direction",
  "chequeNumber",
  "bankAccountId",
  "customerId",
  "supplierId",
  "contractId",
  "unitId",
  "scheduleId",
  "receiptId",
  "paymentVoucherId",
];

/**
 * The reference for a cheque-history entry.
 *
 * Was a timestamp plus a random number, which is not a business reference: it
 * is unsortable, unreadable and only unique by luck. It comes from the central
 * sequence like every other system-issued identifier.
 */
async function historyCode(companyId: string | null): Promise<string> {
  return (await nextNumber("chequeHistory", companyId)).value;
}

// ===================== cheques =====================
router.get("/cheques", requirePermission("cheques.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(chequesTable.isDeleted, false)];
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(chequesTable.companyId, companyId));
  const direction = qStr(q, "direction");
  if (direction) filters.push(eq(chequesTable.direction, direction));
  const status = qStr(q, "status");
  if (status) filters.push(eq(chequesTable.status, status));
  const search = qStr(q, "search");
  if (search) {
    const term = `%${search}%`;
    const m = or(
      ilike(chequesTable.code, term),
      ilike(chequesTable.chequeNumber, term),
      ilike(chequesTable.payeeName, term),
      ilike(chequesTable.bankName, term),
    );
    if (m) filters.push(m);
  }
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(chequesTable).where(where);
  const rows = await db.select().from(chequesTable).where(where).orderBy(desc(chequesTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListChequesResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/cheques", requirePermission("cheques.create"), async (req, res): Promise<void> => {
  const parsed = CreateChequeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;
  // Every cheque is born "Received" (requirement: default status). The lifecycle
  // is advanced only through the guarded /transition and /replace endpoints, so a
  // caller cannot create a cheque already past the start of its lifecycle.
  const [row] = await db.insert(chequesTable).values({ ...data, code: (await nextNumber("cheque", req.authUser?.companyId ?? null)).value, status: "received" }).returning();
  await recordAudit(req, { action: "create", entity: "cheque", entityId: row.id, newValue: row });
  res.status(201).json(GetChequeResponse.parse(serializeRow(row)));
});

router.get("/cheques/:id", requirePermission("cheques.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(chequesTable).where(and(eq(chequesTable.id, id), eq(chequesTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Cheque not found" }); return; }
  res.json(GetChequeResponse.parse(serializeRow(row)));
});

router.patch("/cheques/:id", requirePermission("cheques.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateChequeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(chequesTable).where(and(eq(chequesTable.id, id), eq(chequesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Cheque not found" }); return; }

  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data as Record<string, unknown>)) {
    if (v !== undefined) update[k] = v;
  }
  // Governance: status is only changed through the transition endpoint, never a
  // plain PATCH (which would bypass history logging and ledger posting).
  delete update.status;
  // The cheque's own code is issued by the central sequence; an edit that could
  // rewrite it would let one cheque take another's number.
  delete update.code;
  // Once cleared, the cheque has driven a ledger entry — its financial identity
  // is immutable. Only descriptive fields (notes, dates) may still change.
  const cleared = existing.status === COLLECTED;
  if (cleared) {
    for (const f of FROZEN_FIELDS) delete update[f];
  }
  const [row] = Object.keys(update).length
    ? await db.update(chequesTable).set(update).where(eq(chequesTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "cheque", entityId: id, oldValue: existing, newValue: row });
  res.json(GetChequeResponse.parse(serializeRow(row)));
});

router.delete("/cheques/:id", requirePermission("cheques.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [existing] = await db.select().from(chequesTable).where(and(eq(chequesTable.id, id), eq(chequesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Cheque not found" }); return; }
  // A cleared cheque cannot be deleted — it has posted to the ledger. It must be
  // returned or cancelled (which reverses the entry) instead.
  if (existing.status === COLLECTED) {
    res.status(409).json({ error: "A cleared cheque cannot be deleted; return or cancel it instead" });
    return;
  }
  await db.update(chequesTable).set({ isDeleted: true, isActive: false }).where(eq(chequesTable.id, id));
  await recordAudit(req, { action: "delete", entity: "cheque", entityId: id, oldValue: existing });
  res.json({ success: true });
});

// Status transition: logs to history and posts/reverses the ledger entry.
router.patch("/cheques/:id/transition", requirePermission("cheques.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const toStatus = typeof body.status === "string" ? body.status : "";
  if (!CHEQUE_STATUSES.has(toStatus)) {
    res.status(400).json({ error: "Invalid target status" });
    return;
  }
  const actionDate = typeof body.actionDate === "string" && body.actionDate ? body.actionDate : today();
  const notes = typeof body.notes === "string" ? body.notes : null;
  const returnReason = typeof body.returnReason === "string" ? body.returnReason : null;

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(chequesTable)
      .where(and(eq(chequesTable.id, id), eq(chequesTable.isDeleted, false)))
      .for("update");
    if (!existing) return { notFound: true as const };
    const fromStatus = existing.status;
    if (fromStatus === toStatus) return { existing, unchanged: true as const };
    if (!(ALLOWED_TRANSITIONS[fromStatus] ?? []).includes(toStatus)) {
      return { invalidTransition: true as const, fromStatus, toStatus };
    }

    const set: Record<string, unknown> = { status: toStatus };
    if (toStatus === "under_collection" && !existing.collectionDate) set.collectionDate = actionDate;
    if (toStatus === COLLECTED) set.clearedDate = actionDate;
    if (toStatus === "returned") {
      set.returnedDate = actionDate;
      if (returnReason) set.returnReason = returnReason;
    }
    const [updated] = await tx.update(chequesTable).set(set).where(eq(chequesTable.id, id)).returning();

    // Ledger integration (best-effort; skips cleanly if unconfigured). Each leg is
    // idempotent per (sourceType, sourceId), so re-attempting a leg never double-posts.
    const userId = req.authUser?.id ?? null;
    const amountValid = typeof existing.amount === "string" && existing.amount.trim() !== "";
    // A cheque created from a receipt or payment voucher must NOT post its own
    // collection leg: the originating voucher already moved AR/AP into the bridge
    // account (Cheques Under Collection / Cheques Payable). Posting it again here
    // would double-count the settlement (Bank and AR/AP both counted twice). Such
    // linked cheques only post the clearing leg (bridge -> Bank) when they clear;
    // standalone cheques (no voucher) still post both legs themselves.
    const linkedToVoucher = !!(existing.receiptId || existing.paymentVoucherId);
    const postCollection = async (): Promise<void> => {
      if (linkedToVoucher) return;
      const eventKey = COLLECTION_EVENT[existing.direction];
      if (!eventKey || !amountValid) return;
      await postAutomaticEntry(tx, {
        companyId: existing.companyId,
        branchId: existing.branchId,
        eventKey,
        amount: existing.amount,
        entryDate: actionDate,
        description: `Cheque ${existing.code} under collection`,
        reference: existing.chequeNumber,
        sourceType: COLLECTION_SOURCE,
        sourceId: existing.id,
        userId,
      });
    };
    const postClearing = async (): Promise<void> => {
      const eventKey = CLEAR_EVENT[existing.direction];
      if (!eventKey || !amountValid) return;
      await postAutomaticEntry(tx, {
        companyId: existing.companyId,
        branchId: existing.branchId,
        eventKey,
        amount: existing.amount,
        entryDate: actionDate,
        description: `Cheque ${existing.code} cleared`,
        reference: existing.chequeNumber,
        sourceType: CLEARING_SOURCE,
        sourceId: existing.id,
        userId,
      });
    };

    if (toStatus === COLLECTED && fromStatus !== COLLECTED) {
      // Ensure the collection leg exists (covers paths that skip under_collection),
      // then post the clearing leg that drains the bridge account.
      await postCollection();
      await postClearing();
    } else if (COLLECTING_STATUSES.has(toStatus) && !COLLECTING_STATUSES.has(fromStatus) && fromStatus !== COLLECTED) {
      await postCollection();
    } else if (REVERSING_STATUSES.has(toStatus)) {
      // Return/cancel reverses whatever legs were posted (collection and/or
      // clearing); reversal is a no-op for legs that never posted.
      await reverseAutomaticEntriesForSource(tx, CLEARING_SOURCE, existing.id, userId);
      await reverseAutomaticEntriesForSource(tx, COLLECTION_SOURCE, existing.id, userId);
    }

    await tx.insert(chequeStatusHistoryTable).values({
      companyId: existing.companyId,
      code: await historyCode(req.authUser?.companyId ?? null),
      chequeId: id,
      action: toStatus,
      fromStatus,
      toStatus,
      actorName: req.authUser?.username ?? req.authUser?.id ?? null,
      actionDate,
      notes,
    });

    // A returned (bounced) cheque is a financial red flag: alert Finance, the
    // Sales Manager, the Executive Manager and the Owner. recipientsByPermission
    // already includes "*" holders (Owner / Super Admin); the union of these
    // permission audiences covers the required roles. notify() is idempotent per
    // (recipient, sourceModule, sourceId, eventType), so re-returning is safe.
    if (toStatus === "returned") {
      const perms = [
        "cheques.update",
        "contracts.submitFinance",
        "contracts.create",
        "executiveOversight.view",
        "executiveOversight.viewOwn",
      ];
      const lists = await Promise.all(
        perms.map((p) => recipientsByPermission(tx, p, { companyId: existing.companyId })),
      );
      const audience = [...new Set(lists.flat())].filter((uid) => uid !== userId);
      if (audience.length > 0) {
        await notify(tx, {
          recipientUserIds: audience,
          companyId: existing.companyId,
          actorUserId: userId,
          category: "finance",
          eventType: "cheque_returned",
          priority: "urgent",
          title: "شيك مرتجع / Returned cheque",
          body: `${existing.code} (${existing.chequeNumber}) — ${existing.amount ?? ""}`,
          sourceModule: "cheques",
          sourceId: existing.id,
          sourceRef: existing.code,
          link: "/cheques",
        });
      }
    }
    return { existing, updated };
  });

  if ("notFound" in result) { res.status(404).json({ error: "Cheque not found" }); return; }
  if ("invalidTransition" in result) {
    res.status(409).json({ error: `Invalid status transition from ${result.fromStatus} to ${result.toStatus}` });
    return;
  }
  if ("unchanged" in result) { res.json(GetChequeResponse.parse(serializeRow(result.existing))); return; }
  await recordAudit(req, {
    action: "update",
    entity: "cheque",
    entityId: id,
    oldValue: result.existing,
    newValue: result.updated,
  });
  res.json(GetChequeResponse.parse(serializeRow(result.updated)));
});

// ===================== replace a cheque =====================
// A replaced cheque is kept intact in history and linked to the new cheque that
// supersedes it (and vice-versa). This reverses any posted legs on the original,
// creates a fresh "received" cheque carrying over the original's links, flips the
// original to status `replaced`, and records both sides in the status history.
router.post("/cheques/:id/replace", requirePermission("cheques.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const actionDate = typeof body.actionDate === "string" && body.actionDate ? body.actionDate : today();
  const userId = req.authUser?.id ?? null;
  const actorName = req.authUser?.username ?? req.authUser?.id ?? null;
  const str = (k: string): string | null => (typeof body[k] === "string" && body[k] ? (body[k] as string) : null);

  const result = await db.transaction(async (tx) => {
    const [orig] = await tx
      .select()
      .from(chequesTable)
      .where(and(eq(chequesTable.id, id), eq(chequesTable.isDeleted, false)))
      .for("update");
    if (!orig) return { notFound: true as const };
    if (!REPLACEABLE_FROM.has(orig.status)) return { invalid: true as const, status: orig.status };

    // Reverse any posted legs on the original — it is being swapped out. Reversal
    // is idempotent and a no-op for legs that never posted.
    await reverseAutomaticEntriesForSource(tx, CLEARING_SOURCE, orig.id, userId);
    await reverseAutomaticEntriesForSource(tx, COLLECTION_SOURCE, orig.id, userId);

    const [replacement] = await tx
      .insert(chequesTable)
      .values({
        companyId: orig.companyId,
        branchId: orig.branchId,
        code: str("code") ?? `${orig.code}-R`,
        direction: orig.direction,
        chequeNumber: str("chequeNumber") ?? orig.chequeNumber,
        chequeDate: str("chequeDate") ?? orig.chequeDate,
        dueDate: str("dueDate") ?? orig.dueDate,
        amount: str("amount") ?? orig.amount,
        bankName: str("bankName") ?? orig.bankName,
        bankAccountId: orig.bankAccountId,
        customerId: orig.customerId,
        supplierId: orig.supplierId,
        contractId: orig.contractId,
        unitId: orig.unitId,
        scheduleId: orig.scheduleId,
        receiptId: orig.receiptId,
        paymentVoucherId: orig.paymentVoucherId,
        payeeName: orig.payeeName,
        status: "received",
        replacesChequeId: orig.id,
        reference: orig.reference,
        notes: str("notes"),
        userId,
      })
      .returning();

    const [updatedOrig] = await tx
      .update(chequesTable)
      .set({ status: REPLACED, replacedByChequeId: replacement.id })
      .where(eq(chequesTable.id, orig.id))
      .returning();

    // History on both cheques: the original is marked replaced (linked forward),
    // the replacement is recorded as received (linked back).
    await tx.insert(chequeStatusHistoryTable).values([
      {
        companyId: orig.companyId,
        code: await historyCode(req.authUser?.companyId ?? null),
        chequeId: orig.id,
        action: REPLACED,
        fromStatus: orig.status,
        toStatus: REPLACED,
        actorName,
        actionDate,
        notes: `Replaced by ${replacement.code}${str("notes") ? ` — ${str("notes")}` : ""}`,
      },
      {
        companyId: orig.companyId,
        code: await historyCode(req.authUser?.companyId ?? null),
        chequeId: replacement.id,
        action: "received",
        fromStatus: null,
        toStatus: "received",
        actorName,
        actionDate,
        notes: `Replaces ${orig.code}`,
      },
    ]);
    return { original: updatedOrig, replacement };
  });

  if ("notFound" in result) { res.status(404).json({ error: "Cheque not found" }); return; }
  if ("invalid" in result) {
    res.status(409).json({ error: `Cannot replace a cheque in status ${result.status}` });
    return;
  }
  await recordAudit(req, {
    action: "update",
    entity: "cheque",
    entityId: id,
    newValue: { original: result.original, replacement: result.replacement },
  });
  res.status(201).json({
    original: serializeRow(result.original),
    replacement: serializeRow(result.replacement),
  });
});

// ===================== cheque status history (read-only listing) =====================
router.get("/cheque-status-history", requirePermission("cheques.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(chequeStatusHistoryTable.isDeleted, false)];
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(chequeStatusHistoryTable.companyId, companyId));
  const chequeId = qStr(q, "chequeId");
  if (chequeId) filters.push(eq(chequeStatusHistoryTable.chequeId, chequeId));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(chequeStatusHistoryTable).where(where);
  const rows = await db.select().from(chequeStatusHistoryTable).where(where).orderBy(desc(chequeStatusHistoryTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListChequeStatusHistorysResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.get("/cheque-status-history/:id", requirePermission("cheques.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(chequeStatusHistoryTable).where(and(eq(chequeStatusHistoryTable.id, id), eq(chequeStatusHistoryTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetChequeStatusHistoryResponse.parse(serializeRow(row)));
});

export default router;
