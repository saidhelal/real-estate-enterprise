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

const router: IRouter = Router();
router.use(requireAuth);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Cheque lifecycle statuses. A cheque posts to the ledger when it reaches
// `cleared`; transitioning to `returned`/`cancelled` reverses that posting.
const CHEQUE_STATUSES = new Set([
  "received",
  "post_dated",
  "under_collection",
  "deposited",
  "cleared",
  "returned",
  "cancelled",
]);
const CLEARED = "cleared";
const REVERSING_STATUSES = new Set(["returned", "cancelled"]);

// Direction → account-mapping event key used when the cheque clears.
//   incoming: debit Bank / credit Accounts Receivable (money collected)
//   outgoing: debit Accounts Payable / credit Bank (payment honoured)
const CLEAR_EVENT: Record<string, string> = {
  incoming: "cheque.incoming.cleared",
  outgoing: "cheque.outgoing.cleared",
};

// Financial fields frozen once a cheque has cleared (driven a ledger entry).
const FROZEN_FIELDS = [
  "amount",
  "direction",
  "chequeNumber",
  "bankAccountId",
  "customerId",
  "supplierId",
  "contractId",
  "receiptId",
];

function historyCode(): string {
  return `CHQH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
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
  if (data.status && !CHEQUE_STATUSES.has(data.status)) {
    res.status(400).json({ error: "Invalid cheque status" });
    return;
  }
  const [row] = await db.insert(chequesTable).values({ ...data }).returning();
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
  // Once cleared, the cheque has driven a ledger entry — its financial identity
  // is immutable. Only descriptive fields (notes, dates) may still change.
  const cleared = existing.status === CLEARED;
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
  if (existing.status === CLEARED) {
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

    const set: Record<string, unknown> = { status: toStatus };
    if (toStatus === "deposited") set.depositDate = actionDate;
    if (toStatus === CLEARED) set.clearedDate = actionDate;
    if (toStatus === "returned") {
      set.returnedDate = actionDate;
      if (returnReason) set.returnReason = returnReason;
    }
    const [updated] = await tx.update(chequesTable).set(set).where(eq(chequesTable.id, id)).returning();

    // Ledger integration (best-effort; skips cleanly if unconfigured).
    if (toStatus === CLEARED && fromStatus !== CLEARED) {
      const eventKey = CLEAR_EVENT[existing.direction] ?? null;
      if (eventKey && typeof existing.amount === "string" && existing.amount.trim() !== "") {
        await postAutomaticEntry(tx, {
          companyId: existing.companyId,
          branchId: existing.branchId,
          eventKey,
          amount: existing.amount,
          entryDate: actionDate,
          description: `Cheque ${existing.code} cleared`,
          reference: existing.chequeNumber,
          sourceType: "cheque",
          sourceId: existing.id,
          userId: req.authUser?.id ?? null,
        });
      }
    } else if (REVERSING_STATUSES.has(toStatus) && fromStatus === CLEARED) {
      await reverseAutomaticEntriesForSource(tx, "cheque", existing.id, req.authUser?.id ?? null);
    }

    await tx.insert(chequeStatusHistoryTable).values({
      companyId: existing.companyId,
      code: historyCode(),
      chequeId: id,
      action: toStatus,
      fromStatus,
      toStatus,
      actorName: req.authUser?.username ?? req.authUser?.id ?? null,
      actionDate,
      notes,
    });
    return { existing, updated };
  });

  if ("notFound" in result) { res.status(404).json({ error: "Cheque not found" }); return; }
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
