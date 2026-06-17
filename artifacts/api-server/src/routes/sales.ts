import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  db,
  reservationsTable,
  reservationPaymentsTable,
  contractsTable,
  contractAmendmentsTable,
  contractCancellationsTable,
  contractNotesTable,
  contractDocumentsTable,
  reservationNotesTable,
  reservationDocumentsTable,
  unitTransfersTable,
} from "@workspace/db";
import {
  ListReservationsResponse,
  CreateReservationBody,
  GetReservationResponse,
  UpdateReservationBody,
  ConvertReservationBody,
  ListReservationPaymentsResponse,
  CreateReservationPaymentBody,
  GetReservationPaymentResponse,
  UpdateReservationPaymentBody,
  ListContractsResponse,
  CreateContractBody,
  GetContractResponse,
  UpdateContractBody,
  ListContractAmendmentsResponse,
  CreateContractAmendmentBody,
  GetContractAmendmentResponse,
  UpdateContractAmendmentBody,
  ListContractCancellationsResponse,
  CreateContractCancellationBody,
  GetContractCancellationResponse,
  UpdateContractCancellationBody,
  ListContractNotesResponse,
  CreateContractNoteBody,
  GetContractNoteResponse,
  UpdateContractNoteBody,
  ListContractDocumentsResponse,
  CreateContractDocumentBody,
  GetContractDocumentResponse,
  UpdateContractDocumentBody,
  ListReservationNotesResponse,
  CreateReservationNoteBody,
  GetReservationNoteResponse,
  UpdateReservationNoteBody,
  ListReservationDocumentsResponse,
  CreateReservationDocumentBody,
  GetReservationDocumentResponse,
  UpdateReservationDocumentBody,
  ListUnitTransfersResponse,
  CreateUnitTransferBody,
  GetUnitTransferResponse,
  UpdateUnitTransferBody,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { postAutomaticEntry, reverseAutomaticEntriesForSource } from "../lib/posting";
import { recomputeUnitStatus, ensureLegalContractForContract } from "../lib/integrations";
import { nextDocumentNumber } from "../lib/doc-number";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

// ----- reservations -----
router.get("/reservations", requirePermission("reservations.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(reservationsTable.isDeleted, false)];
  if (search) {
    const s = ilike(reservationsTable.code, `%${search}%`);
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(reservationsTable.companyId, companyId));
  const branchId = qStr(q, "branchId");
  if (branchId) filters.push(eq(reservationsTable.branchId, branchId));
  const unitId = qStr(q, "unitId");
  if (unitId) filters.push(eq(reservationsTable.unitId, unitId));
  const customerId = qStr(q, "customerId");
  if (customerId) filters.push(eq(reservationsTable.customerId, customerId));
  const status = qStr(q, "status");
  if (status) filters.push(eq(reservationsTable.status, status));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reservationsTable)
    .where(where);
  const rows = await db
    .select()
    .from(reservationsTable)
    .where(where)
    .orderBy(desc(reservationsTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListReservationsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/reservations", requirePermission("reservations.create"), async (req, res): Promise<void> => {
  const parsed = CreateReservationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const row = await db.transaction(async (tx) => {
    const [created] = await tx.insert(reservationsTable).values({ ...parsed.data }).returning();
    await recomputeUnitStatus(tx, created.unitId);
    return created;
  });
  await recordAudit(req, { action: "create", entity: "reservation", entityId: row.id, newValue: row });
  res.status(201).json(GetReservationResponse.parse(serializeRow(row)));
});

router.get("/reservations/:id", requirePermission("reservations.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(reservationsTable).where(and(eq(reservationsTable.id, id), eq(reservationsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetReservationResponse.parse(serializeRow(row)));
});

router.patch("/reservations/:id", requirePermission("reservations.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateReservationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(reservationsTable).where(and(eq(reservationsTable.id, id), eq(reservationsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const row = await db.transaction(async (tx) => {
    const [updated] = Object.keys(update).length
      ? await tx.update(reservationsTable).set(update).where(eq(reservationsTable.id, id)).returning()
      : [existing];
    await recomputeUnitStatus(tx, existing.unitId);
    if (updated.unitId !== existing.unitId) await recomputeUnitStatus(tx, updated.unitId);
    return updated;
  });
  await recordAudit(req, { action: "update", entity: "reservation", entityId: id, oldValue: existing, newValue: row });
  res.json(GetReservationResponse.parse(serializeRow(row)));
});

router.delete("/reservations/:id", requirePermission("reservations.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const row = await db.transaction(async (tx) => {
    const [updated] = await tx.update(reservationsTable).set({ isDeleted: true, isActive: false }).where(and(eq(reservationsTable.id, id), eq(reservationsTable.isDeleted, false))).returning();
    if (!updated) return null;
    await recomputeUnitStatus(tx, updated.unitId);
    return updated;
  });
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "reservation", entityId: id });
  res.json({ success: true });
});

// ----- reservationPayments -----
router.get("/reservation-payments", requirePermission("reservationPayments.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(reservationPaymentsTable.isDeleted, false)];
  if (search) {
    const s = ilike(reservationPaymentsTable.reference, `%${search}%`);
    if (s) filters.push(s);
  }
  const reservationId = qStr(q, "reservationId");
  if (reservationId) filters.push(eq(reservationPaymentsTable.reservationId, reservationId));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reservationPaymentsTable)
    .where(where);
  const rows = await db
    .select()
    .from(reservationPaymentsTable)
    .where(where)
    .orderBy(desc(reservationPaymentsTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListReservationPaymentsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/reservation-payments", requirePermission("reservationPayments.create"), async (req, res): Promise<void> => {
  const parsed = CreateReservationPaymentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const row = await db.transaction(async (tx) => {
    const [created] = await tx.insert(reservationPaymentsTable).values({ ...parsed.data }).returning();
    await postAutomaticEntry(tx, {
      companyId: created.companyId,
      eventKey: "reservation.payment",
      amount: created.amount ?? "0",
      entryDate: created.paymentDate,
      description: created.reference ? `Reservation payment ${created.reference}` : "Reservation payment",
      reference: created.reference ?? null,
      sourceType: "reservationPayment",
      sourceId: created.id,
      userId: req.authUser?.id ?? null,
    });
    return created;
  });
  await recordAudit(req, { action: "create", entity: "reservationPayment", entityId: row.id, newValue: row });
  res.status(201).json(GetReservationPaymentResponse.parse(serializeRow(row)));
});

router.get("/reservation-payments/:id", requirePermission("reservationPayments.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(reservationPaymentsTable).where(and(eq(reservationPaymentsTable.id, id), eq(reservationPaymentsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetReservationPaymentResponse.parse(serializeRow(row)));
});

router.patch("/reservation-payments/:id", requirePermission("reservationPayments.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateReservationPaymentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(reservationPaymentsTable).where(and(eq(reservationPaymentsTable.id, id), eq(reservationPaymentsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(reservationPaymentsTable).set(update).where(eq(reservationPaymentsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "reservationPayment", entityId: id, oldValue: existing, newValue: row });
  res.json(GetReservationPaymentResponse.parse(serializeRow(row)));
});

router.delete("/reservation-payments/:id", requirePermission("reservationPayments.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const row = await db.transaction(async (tx) => {
    const [updated] = await tx.update(reservationPaymentsTable).set({ isDeleted: true, isActive: false }).where(and(eq(reservationPaymentsTable.id, id), eq(reservationPaymentsTable.isDeleted, false))).returning();
    if (!updated) return null;
    await reverseAutomaticEntriesForSource(tx, "reservationPayment", updated.id, req.authUser?.id ?? null);
    return updated;
  });
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "reservationPayment", entityId: id });
  res.json({ success: true });
});

// ----- contracts -----
router.get("/contracts", requirePermission("contracts.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(contractsTable.isDeleted, false)];
  if (search) {
    const s = ilike(contractsTable.code, `%${search}%`);
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(contractsTable.companyId, companyId));
  const branchId = qStr(q, "branchId");
  if (branchId) filters.push(eq(contractsTable.branchId, branchId));
  const reservationId = qStr(q, "reservationId");
  if (reservationId) filters.push(eq(contractsTable.reservationId, reservationId));
  const unitId = qStr(q, "unitId");
  if (unitId) filters.push(eq(contractsTable.unitId, unitId));
  const customerId = qStr(q, "customerId");
  if (customerId) filters.push(eq(contractsTable.customerId, customerId));
  const status = qStr(q, "status");
  if (status) filters.push(eq(contractsTable.status, status));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contractsTable)
    .where(where);
  const rows = await db
    .select()
    .from(contractsTable)
    .where(where)
    .orderBy(desc(contractsTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListContractsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/contracts", requirePermission("contracts.create"), async (req, res): Promise<void> => {
  const parsed = CreateContractBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const row = await db.transaction(async (tx) => {
    const [created] = await tx.insert(contractsTable).values({ ...parsed.data }).returning();
    // Recognize the sale on the ledger (best-effort; skipped if accounting unconfigured).
    await postAutomaticEntry(tx, {
      companyId: created.companyId,
      branchId: created.branchId ?? null,
      eventKey: "contract.created",
      amount: created.totalPrice ?? "0",
      entryDate: created.contractDate,
      description: `Contract ${created.code}`,
      reference: created.code,
      sourceType: "contract",
      sourceId: created.id,
      userId: req.authUser?.id ?? null,
    });
    // Mark the unit Sold and register the contract in Legal Affairs.
    await recomputeUnitStatus(tx, created.unitId);
    const legalContractId = await ensureLegalContractForContract(tx, created);
    return { ...created, legalContractId: legalContractId ?? created.legalContractId };
  });
  await recordAudit(req, { action: "create", entity: "contract", entityId: row.id, newValue: row });
  res.status(201).json(GetContractResponse.parse(serializeRow(row)));
});

router.get("/contracts/:id", requirePermission("contracts.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(contractsTable).where(and(eq(contractsTable.id, id), eq(contractsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetContractResponse.parse(serializeRow(row)));
});

router.patch("/contracts/:id", requirePermission("contracts.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateContractBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(contractsTable).where(and(eq(contractsTable.id, id), eq(contractsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const row = await db.transaction(async (tx) => {
    const [updated] = Object.keys(update).length
      ? await tx.update(contractsTable).set(update).where(eq(contractsTable.id, id)).returning()
      : [existing];
    // A status change (e.g. -> cancelled/terminated) or a unit change must
    // refresh the affected unit(s) so they free up or lock as Sold.
    await recomputeUnitStatus(tx, existing.unitId);
    if (updated.unitId !== existing.unitId) await recomputeUnitStatus(tx, updated.unitId);
    return updated;
  });
  await recordAudit(req, { action: "update", entity: "contract", entityId: id, oldValue: existing, newValue: row });
  res.json(GetContractResponse.parse(serializeRow(row)));
});

router.delete("/contracts/:id", requirePermission("contracts.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const row = await db.transaction(async (tx) => {
    const [updated] = await tx.update(contractsTable).set({ isDeleted: true, isActive: false }).where(and(eq(contractsTable.id, id), eq(contractsTable.isDeleted, false))).returning();
    if (!updated) return null;
    await reverseAutomaticEntriesForSource(tx, "contract", updated.id, req.authUser?.id ?? null);
    // Free the unit (reverts to Reserved if an active reservation remains, else Available).
    await recomputeUnitStatus(tx, updated.unitId);
    return updated;
  });
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "contract", entityId: id });
  res.json({ success: true });
});

// ----- contractAmendments -----
router.get("/contract-amendments", requirePermission("contractAmendments.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(contractAmendmentsTable.isDeleted, false)];
  if (search) {
    const s = or(ilike(contractAmendmentsTable.code, `%${search}%`), ilike(contractAmendmentsTable.description, `%${search}%`));
    if (s) filters.push(s);
  }
  const contractId = qStr(q, "contractId");
  if (contractId) filters.push(eq(contractAmendmentsTable.contractId, contractId));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contractAmendmentsTable)
    .where(where);
  const rows = await db
    .select()
    .from(contractAmendmentsTable)
    .where(where)
    .orderBy(desc(contractAmendmentsTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListContractAmendmentsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/contract-amendments", requirePermission("contractAmendments.create"), async (req, res): Promise<void> => {
  const parsed = CreateContractAmendmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(contractAmendmentsTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "contractAmendment", entityId: row.id, newValue: row });
  res.status(201).json(GetContractAmendmentResponse.parse(serializeRow(row)));
});

router.get("/contract-amendments/:id", requirePermission("contractAmendments.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(contractAmendmentsTable).where(and(eq(contractAmendmentsTable.id, id), eq(contractAmendmentsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetContractAmendmentResponse.parse(serializeRow(row)));
});

router.patch("/contract-amendments/:id", requirePermission("contractAmendments.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateContractAmendmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(contractAmendmentsTable).where(and(eq(contractAmendmentsTable.id, id), eq(contractAmendmentsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(contractAmendmentsTable).set(update).where(eq(contractAmendmentsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "contractAmendment", entityId: id, oldValue: existing, newValue: row });
  res.json(GetContractAmendmentResponse.parse(serializeRow(row)));
});

router.delete("/contract-amendments/:id", requirePermission("contractAmendments.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(contractAmendmentsTable).set({ isDeleted: true, isActive: false }).where(and(eq(contractAmendmentsTable.id, id), eq(contractAmendmentsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "contractAmendment", entityId: id });
  res.json({ success: true });
});

// ----- contractCancellations -----
router.get("/contract-cancellations", requirePermission("contractCancellations.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(contractCancellationsTable.isDeleted, false)];
  if (search) {
    const s = ilike(contractCancellationsTable.reason, `%${search}%`);
    if (s) filters.push(s);
  }
  const contractId = qStr(q, "contractId");
  if (contractId) filters.push(eq(contractCancellationsTable.contractId, contractId));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contractCancellationsTable)
    .where(where);
  const rows = await db
    .select()
    .from(contractCancellationsTable)
    .where(where)
    .orderBy(desc(contractCancellationsTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListContractCancellationsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/contract-cancellations", requirePermission("contractCancellations.create"), async (req, res): Promise<void> => {
  const parsed = CreateContractCancellationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  let conflict: string | null = null;
  const row = await db.transaction(async (tx) => {
    // Cancel the underlying contract first: flip its status, reverse its
    // recognized sale on the ledger, and free the unit. Only log the
    // cancellation once the canonical mutation succeeds.
    const [contract] = await tx
      .update(contractsTable)
      .set({ status: "cancelled" })
      .where(and(eq(contractsTable.id, parsed.data.contractId), eq(contractsTable.isDeleted, false)))
      .returning();
    if (!contract) { conflict = "404"; return null; }
    await reverseAutomaticEntriesForSource(tx, "contract", contract.id, req.authUser?.id ?? null);
    await recomputeUnitStatus(tx, contract.unitId);
    const [created] = await tx.insert(contractCancellationsTable).values({ ...parsed.data }).returning();
    return created;
  });
  if (conflict === "404") { res.status(404).json({ error: "Contract not found" }); return; }
  await recordAudit(req, { action: "create", entity: "contractCancellation", entityId: row!.id, newValue: row });
  res.status(201).json(GetContractCancellationResponse.parse(serializeRow(row!)));
});

router.get("/contract-cancellations/:id", requirePermission("contractCancellations.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(contractCancellationsTable).where(and(eq(contractCancellationsTable.id, id), eq(contractCancellationsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetContractCancellationResponse.parse(serializeRow(row)));
});

router.patch("/contract-cancellations/:id", requirePermission("contractCancellations.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateContractCancellationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(contractCancellationsTable).where(and(eq(contractCancellationsTable.id, id), eq(contractCancellationsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(contractCancellationsTable).set(update).where(eq(contractCancellationsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "contractCancellation", entityId: id, oldValue: existing, newValue: row });
  res.json(GetContractCancellationResponse.parse(serializeRow(row)));
});

router.delete("/contract-cancellations/:id", requirePermission("contractCancellations.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(contractCancellationsTable).set({ isDeleted: true, isActive: false }).where(and(eq(contractCancellationsTable.id, id), eq(contractCancellationsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "contractCancellation", entityId: id });
  res.json({ success: true });
});

// ----- unitTransfers -----
router.get("/unit-transfers", requirePermission("unitTransfers.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(unitTransfersTable.isDeleted, false)];
  if (search) {
    const s = ilike(unitTransfersTable.reason, `%${search}%`);
    if (s) filters.push(s);
  }
  const contractId = qStr(q, "contractId");
  if (contractId) filters.push(eq(unitTransfersTable.contractId, contractId));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(unitTransfersTable)
    .where(where);
  const rows = await db
    .select()
    .from(unitTransfersTable)
    .where(where)
    .orderBy(desc(unitTransfersTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListUnitTransfersResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/unit-transfers", requirePermission("unitTransfers.create"), async (req, res): Promise<void> => {
  const parsed = CreateUnitTransferBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  let conflict: string | null = null;
  const row = await db.transaction(async (tx) => {
    // Repoint the contract to the destination unit first (the GL source FK
    // stays the contract id). Only log the transfer if a live contract was
    // actually moved.
    const [contract] = await tx
      .update(contractsTable)
      .set({ unitId: parsed.data.toUnitId })
      .where(and(eq(contractsTable.id, parsed.data.contractId), eq(contractsTable.isDeleted, false)))
      .returning();
    if (!contract) { conflict = "404"; return null; }
    // Refresh both units: the source frees up and the destination locks as Sold.
    await recomputeUnitStatus(tx, parsed.data.fromUnitId);
    await recomputeUnitStatus(tx, parsed.data.toUnitId);
    const [created] = await tx.insert(unitTransfersTable).values({ ...parsed.data }).returning();
    return created;
  });
  if (conflict === "404") { res.status(404).json({ error: "Contract not found" }); return; }
  await recordAudit(req, { action: "create", entity: "unitTransfer", entityId: row!.id, newValue: row });
  res.status(201).json(GetUnitTransferResponse.parse(serializeRow(row!)));
});

router.get("/unit-transfers/:id", requirePermission("unitTransfers.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(unitTransfersTable).where(and(eq(unitTransfersTable.id, id), eq(unitTransfersTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetUnitTransferResponse.parse(serializeRow(row)));
});

router.patch("/unit-transfers/:id", requirePermission("unitTransfers.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateUnitTransferBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(unitTransfersTable).where(and(eq(unitTransfersTable.id, id), eq(unitTransfersTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(unitTransfersTable).set(update).where(eq(unitTransfersTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "unitTransfer", entityId: id, oldValue: existing, newValue: row });
  res.json(GetUnitTransferResponse.parse(serializeRow(row)));
});

router.delete("/unit-transfers/:id", requirePermission("unitTransfers.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(unitTransfersTable).set({ isDeleted: true, isActive: false }).where(and(eq(unitTransfersTable.id, id), eq(unitTransfersTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "unitTransfer", entityId: id });
  res.json({ success: true });
});

// ----- contractNotes -----
router.get("/contract-notes", requirePermission("contractNotes.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(contractNotesTable.isDeleted, false)];
  if (search) {
    const s = or(ilike(contractNotesTable.note, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(contractNotesTable.companyId, companyId));
  const contractId = qStr(q, "contractId");
  if (contractId) filters.push(eq(contractNotesTable.contractId, contractId));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(contractNotesTable).where(where);
  const rows = await db.select().from(contractNotesTable).where(where).orderBy(desc(contractNotesTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListContractNotesResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/contract-notes", requirePermission("contractNotes.create"), async (req, res): Promise<void> => {
  const parsed = CreateContractNoteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(contractNotesTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "contractNote", entityId: row.id, newValue: row });
  res.status(201).json(GetContractNoteResponse.parse(serializeRow(row)));
});

router.get("/contract-notes/:id", requirePermission("contractNotes.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(contractNotesTable).where(and(eq(contractNotesTable.id, id), eq(contractNotesTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetContractNoteResponse.parse(serializeRow(row)));
});

router.patch("/contract-notes/:id", requirePermission("contractNotes.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateContractNoteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(contractNotesTable).where(and(eq(contractNotesTable.id, id), eq(contractNotesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(contractNotesTable).set(update).where(eq(contractNotesTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "contractNote", entityId: id, oldValue: existing, newValue: row });
  res.json(GetContractNoteResponse.parse(serializeRow(row)));
});

router.delete("/contract-notes/:id", requirePermission("contractNotes.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(contractNotesTable).set({ isDeleted: true, isActive: false }).where(and(eq(contractNotesTable.id, id), eq(contractNotesTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "contractNote", entityId: id });
  res.json({ success: true });
});

// ----- contractDocuments -----
router.get("/contract-documents", requirePermission("contractDocuments.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(contractDocumentsTable.isDeleted, false)];
  if (search) {
    const s = or(ilike(contractDocumentsTable.docType, `%${search}%`), ilike(contractDocumentsTable.docNumber, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(contractDocumentsTable.companyId, companyId));
  const contractId = qStr(q, "contractId");
  if (contractId) filters.push(eq(contractDocumentsTable.contractId, contractId));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(contractDocumentsTable).where(where);
  const rows = await db.select().from(contractDocumentsTable).where(where).orderBy(desc(contractDocumentsTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListContractDocumentsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/contract-documents", requirePermission("contractDocuments.create"), async (req, res): Promise<void> => {
  const parsed = CreateContractDocumentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(contractDocumentsTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "contractDocument", entityId: row.id, newValue: row });
  res.status(201).json(GetContractDocumentResponse.parse(serializeRow(row)));
});

router.get("/contract-documents/:id", requirePermission("contractDocuments.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(contractDocumentsTable).where(and(eq(contractDocumentsTable.id, id), eq(contractDocumentsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetContractDocumentResponse.parse(serializeRow(row)));
});

router.patch("/contract-documents/:id", requirePermission("contractDocuments.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateContractDocumentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(contractDocumentsTable).where(and(eq(contractDocumentsTable.id, id), eq(contractDocumentsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(contractDocumentsTable).set(update).where(eq(contractDocumentsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "contractDocument", entityId: id, oldValue: existing, newValue: row });
  res.json(GetContractDocumentResponse.parse(serializeRow(row)));
});

router.delete("/contract-documents/:id", requirePermission("contractDocuments.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(contractDocumentsTable).set({ isDeleted: true, isActive: false }).where(and(eq(contractDocumentsTable.id, id), eq(contractDocumentsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "contractDocument", entityId: id });
  res.json({ success: true });
});

// ----- reservationNotes -----
router.get("/reservation-notes", requirePermission("reservationNotes.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(reservationNotesTable.isDeleted, false)];
  if (search) {
    const s = or(ilike(reservationNotesTable.note, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(reservationNotesTable.companyId, companyId));
  const reservationId = qStr(q, "reservationId");
  if (reservationId) filters.push(eq(reservationNotesTable.reservationId, reservationId));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(reservationNotesTable).where(where);
  const rows = await db.select().from(reservationNotesTable).where(where).orderBy(desc(reservationNotesTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListReservationNotesResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/reservation-notes", requirePermission("reservationNotes.create"), async (req, res): Promise<void> => {
  const parsed = CreateReservationNoteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(reservationNotesTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "reservationNote", entityId: row.id, newValue: row });
  res.status(201).json(GetReservationNoteResponse.parse(serializeRow(row)));
});

router.get("/reservation-notes/:id", requirePermission("reservationNotes.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(reservationNotesTable).where(and(eq(reservationNotesTable.id, id), eq(reservationNotesTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetReservationNoteResponse.parse(serializeRow(row)));
});

router.patch("/reservation-notes/:id", requirePermission("reservationNotes.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateReservationNoteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(reservationNotesTable).where(and(eq(reservationNotesTable.id, id), eq(reservationNotesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(reservationNotesTable).set(update).where(eq(reservationNotesTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "reservationNote", entityId: id, oldValue: existing, newValue: row });
  res.json(GetReservationNoteResponse.parse(serializeRow(row)));
});

router.delete("/reservation-notes/:id", requirePermission("reservationNotes.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(reservationNotesTable).set({ isDeleted: true, isActive: false }).where(and(eq(reservationNotesTable.id, id), eq(reservationNotesTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "reservationNote", entityId: id });
  res.json({ success: true });
});

// ----- reservationDocuments -----
router.get("/reservation-documents", requirePermission("reservationDocuments.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(reservationDocumentsTable.isDeleted, false)];
  if (search) {
    const s = or(ilike(reservationDocumentsTable.docType, `%${search}%`), ilike(reservationDocumentsTable.docNumber, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(reservationDocumentsTable.companyId, companyId));
  const reservationId = qStr(q, "reservationId");
  if (reservationId) filters.push(eq(reservationDocumentsTable.reservationId, reservationId));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(reservationDocumentsTable).where(where);
  const rows = await db.select().from(reservationDocumentsTable).where(where).orderBy(desc(reservationDocumentsTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListReservationDocumentsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/reservation-documents", requirePermission("reservationDocuments.create"), async (req, res): Promise<void> => {
  const parsed = CreateReservationDocumentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(reservationDocumentsTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "reservationDocument", entityId: row.id, newValue: row });
  res.status(201).json(GetReservationDocumentResponse.parse(serializeRow(row)));
});

router.get("/reservation-documents/:id", requirePermission("reservationDocuments.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(reservationDocumentsTable).where(and(eq(reservationDocumentsTable.id, id), eq(reservationDocumentsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetReservationDocumentResponse.parse(serializeRow(row)));
});

router.patch("/reservation-documents/:id", requirePermission("reservationDocuments.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateReservationDocumentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(reservationDocumentsTable).where(and(eq(reservationDocumentsTable.id, id), eq(reservationDocumentsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(reservationDocumentsTable).set(update).where(eq(reservationDocumentsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "reservationDocument", entityId: id, oldValue: existing, newValue: row });
  res.json(GetReservationDocumentResponse.parse(serializeRow(row)));
});

router.delete("/reservation-documents/:id", requirePermission("reservationDocuments.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(reservationDocumentsTable).set({ isDeleted: true, isActive: false }).where(and(eq(reservationDocumentsTable.id, id), eq(reservationDocumentsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "reservationDocument", entityId: id });
  res.json({ success: true });
});

// ----- convert reservation -> contract -----
router.post("/reservations/:id/convert", requirePermission("contracts.create"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = ConvertReservationBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const today = new Date().toISOString().slice(0, 10);
  let conflict: string | null = null;
  const contract = await db.transaction(async (tx) => {
    const [reservation] = await tx
      .select()
      .from(reservationsTable)
      .where(and(eq(reservationsTable.id, id), eq(reservationsTable.isDeleted, false)))
      .for("update");
    if (!reservation) { conflict = "404"; return null; }
    if (reservation.status === "converted") { conflict = "Reservation already converted"; return null; }
    const [existingContract] = await tx
      .select()
      .from(contractsTable)
      .where(and(eq(contractsTable.reservationId, id), eq(contractsTable.isDeleted, false)));
    if (existingContract) { conflict = "A contract already exists for this reservation"; return null; }
    const code = parsed.data.code || (await nextDocumentNumber("Contract")) || `CON-${Date.now()}`;
    const [created] = await tx
      .insert(contractsTable)
      .values({
        companyId: reservation.companyId,
        branchId: reservation.branchId,
        code,
        reservationId: reservation.id,
        unitId: reservation.unitId,
        customerId: reservation.customerId,
        contractDate: parsed.data.contractDate || today,
        totalPrice: parsed.data.totalPrice ?? reservation.amount,
        downPayment: parsed.data.downPayment ?? reservation.amount,
        status: "draft",
        notes: parsed.data.notes ?? reservation.notes,
      })
      .returning();
    await tx.update(reservationsTable).set({ status: "converted" }).where(eq(reservationsTable.id, id));
    // The unit is now under contract (Sold) and the contract is registered in Legal Affairs.
    await recomputeUnitStatus(tx, created.unitId);
    const legalContractId = await ensureLegalContractForContract(tx, created);
    return { ...created, legalContractId: legalContractId ?? created.legalContractId };
  });
  if (conflict === "404") { res.status(404).json({ error: "Not found" }); return; }
  if (conflict) { res.status(409).json({ error: conflict }); return; }
  await recordAudit(req, { action: "convert", entity: "reservation", entityId: id, newValue: contract });
  res.status(201).json(GetContractResponse.parse(serializeRow(contract!)));
});

export default router;
