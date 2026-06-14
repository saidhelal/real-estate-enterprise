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
  unitTransfersTable,
} from "@workspace/db";
import {
  ListReservationsResponse,
  CreateReservationBody,
  GetReservationResponse,
  UpdateReservationBody,
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
  ListUnitTransfersResponse,
  CreateUnitTransferBody,
  GetUnitTransferResponse,
  UpdateUnitTransferBody,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
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
  const [row] = await db.insert(reservationsTable).values({ ...parsed.data }).returning();
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
  const [row] = Object.keys(update).length
    ? await db.update(reservationsTable).set(update).where(eq(reservationsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "reservation", entityId: id, oldValue: existing, newValue: row });
  res.json(GetReservationResponse.parse(serializeRow(row)));
});

router.delete("/reservations/:id", requirePermission("reservations.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(reservationsTable).set({ isDeleted: true, isActive: false }).where(and(eq(reservationsTable.id, id), eq(reservationsTable.isDeleted, false))).returning();
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
  const [row] = await db.insert(reservationPaymentsTable).values({ ...parsed.data }).returning();
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
  const [row] = await db.update(reservationPaymentsTable).set({ isDeleted: true, isActive: false }).where(and(eq(reservationPaymentsTable.id, id), eq(reservationPaymentsTable.isDeleted, false))).returning();
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
  const [row] = await db.insert(contractsTable).values({ ...parsed.data }).returning();
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
  const [row] = Object.keys(update).length
    ? await db.update(contractsTable).set(update).where(eq(contractsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "contract", entityId: id, oldValue: existing, newValue: row });
  res.json(GetContractResponse.parse(serializeRow(row)));
});

router.delete("/contracts/:id", requirePermission("contracts.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(contractsTable).set({ isDeleted: true, isActive: false }).where(and(eq(contractsTable.id, id), eq(contractsTable.isDeleted, false))).returning();
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
  const [row] = await db.insert(contractCancellationsTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "contractCancellation", entityId: row.id, newValue: row });
  res.status(201).json(GetContractCancellationResponse.parse(serializeRow(row)));
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
  const [row] = await db.insert(unitTransfersTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "unitTransfer", entityId: row.id, newValue: row });
  res.status(201).json(GetUnitTransferResponse.parse(serializeRow(row)));
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

export default router;
