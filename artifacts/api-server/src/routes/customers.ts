import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  db,
  customersTable,
  customerContactsTable,
  customerDocumentsTable,
  customerNotesTable,
} from "@workspace/db";
import {
  ListCustomersResponse,
  CreateCustomerBody,
  GetCustomerResponse,
  UpdateCustomerBody,
  ListCustomerContactsResponse,
  CreateCustomerContactBody,
  GetCustomerContactResponse,
  UpdateCustomerContactBody,
  ListCustomerDocumentsResponse,
  CreateCustomerDocumentBody,
  GetCustomerDocumentResponse,
  UpdateCustomerDocumentBody,
  ListCustomerNotesResponse,
  CreateCustomerNoteBody,
  GetCustomerNoteResponse,
  UpdateCustomerNoteBody,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { nextNumber } from "../lib/doc-number";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

// ----- customers -----
router.get("/customers", requirePermission("customers.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(customersTable.isDeleted, false)];
  if (search) {
    const s = or(
      ilike(customersTable.code, `%${search}%`),
      ilike(customersTable.fullName, `%${search}%`),
    );
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(customersTable.companyId, companyId));
  const branchId = qStr(q, "branchId");
  if (branchId) filters.push(eq(customersTable.branchId, branchId));
  const type = qStr(q, "type");
  if (type) filters.push(eq(customersTable.type, type));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customersTable)
    .where(where);
  const rows = await db
    .select()
    .from(customersTable)
    .where(where)
    .orderBy(desc(customersTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListCustomersResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/customers", requirePermission("customers.create"), async (req, res): Promise<void> => {
  const parsed = CreateCustomerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(customersTable).values({ ...parsed.data, code: (await nextNumber("customer", req.authUser?.companyId ?? null)).value }).returning();
  await recordAudit(req, { action: "create", entity: "customer", entityId: row.id, newValue: row });
  res.status(201).json(GetCustomerResponse.parse(serializeRow(row)));
});

router.get("/customers/:id", requirePermission("customers.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(customersTable).where(and(eq(customersTable.id, id), eq(customersTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetCustomerResponse.parse(serializeRow(row)));
});

router.patch("/customers/:id", requirePermission("customers.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateCustomerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(customersTable).where(and(eq(customersTable.id, id), eq(customersTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  // The code belongs to the sequence that issued it, not to the editor.
  delete (update as Record<string, unknown>).code;
  const [row] = Object.keys(update).length
    ? await db.update(customersTable).set(update).where(eq(customersTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "customer", entityId: id, oldValue: existing, newValue: row });
  res.json(GetCustomerResponse.parse(serializeRow(row)));
});

router.delete("/customers/:id", requirePermission("customers.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(customersTable).set({ isDeleted: true, isActive: false }).where(and(eq(customersTable.id, id), eq(customersTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "customer", entityId: id });
  res.json({ success: true });
});

// ----- customerContacts -----
router.get("/customer-contacts", requirePermission("customerContacts.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(customerContactsTable.isDeleted, false)];
  if (search) {
    const s = or(ilike(customerContactsTable.name, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(customerContactsTable.companyId, companyId));
  const customerId = qStr(q, "customerId");
  if (customerId) filters.push(eq(customerContactsTable.customerId, customerId));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customerContactsTable)
    .where(where);
  const rows = await db
    .select()
    .from(customerContactsTable)
    .where(where)
    .orderBy(desc(customerContactsTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListCustomerContactsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/customer-contacts", requirePermission("customerContacts.create"), async (req, res): Promise<void> => {
  const parsed = CreateCustomerContactBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(customerContactsTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "customerContact", entityId: row.id, newValue: row });
  res.status(201).json(GetCustomerContactResponse.parse(serializeRow(row)));
});

router.get("/customer-contacts/:id", requirePermission("customerContacts.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(customerContactsTable).where(and(eq(customerContactsTable.id, id), eq(customerContactsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetCustomerContactResponse.parse(serializeRow(row)));
});

router.patch("/customer-contacts/:id", requirePermission("customerContacts.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateCustomerContactBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(customerContactsTable).where(and(eq(customerContactsTable.id, id), eq(customerContactsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(customerContactsTable).set(update).where(eq(customerContactsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "customerContact", entityId: id, oldValue: existing, newValue: row });
  res.json(GetCustomerContactResponse.parse(serializeRow(row)));
});

router.delete("/customer-contacts/:id", requirePermission("customerContacts.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(customerContactsTable).set({ isDeleted: true, isActive: false }).where(and(eq(customerContactsTable.id, id), eq(customerContactsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "customerContact", entityId: id });
  res.json({ success: true });
});

// ----- customerDocuments -----
router.get("/customer-documents", requirePermission("customerDocuments.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(customerDocumentsTable.isDeleted, false)];
  if (search) {
    const s = or(
      ilike(customerDocumentsTable.docType, `%${search}%`),
      ilike(customerDocumentsTable.docNumber, `%${search}%`),
    );
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(customerDocumentsTable.companyId, companyId));
  const customerId = qStr(q, "customerId");
  if (customerId) filters.push(eq(customerDocumentsTable.customerId, customerId));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customerDocumentsTable)
    .where(where);
  const rows = await db
    .select()
    .from(customerDocumentsTable)
    .where(where)
    .orderBy(desc(customerDocumentsTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListCustomerDocumentsResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/customer-documents", requirePermission("customerDocuments.create"), async (req, res): Promise<void> => {
  const parsed = CreateCustomerDocumentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(customerDocumentsTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "customerDocument", entityId: row.id, newValue: row });
  res.status(201).json(GetCustomerDocumentResponse.parse(serializeRow(row)));
});

router.get("/customer-documents/:id", requirePermission("customerDocuments.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(customerDocumentsTable).where(and(eq(customerDocumentsTable.id, id), eq(customerDocumentsTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetCustomerDocumentResponse.parse(serializeRow(row)));
});

router.patch("/customer-documents/:id", requirePermission("customerDocuments.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateCustomerDocumentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(customerDocumentsTable).where(and(eq(customerDocumentsTable.id, id), eq(customerDocumentsTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(customerDocumentsTable).set(update).where(eq(customerDocumentsTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "customerDocument", entityId: id, oldValue: existing, newValue: row });
  res.json(GetCustomerDocumentResponse.parse(serializeRow(row)));
});

router.delete("/customer-documents/:id", requirePermission("customerDocuments.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(customerDocumentsTable).set({ isDeleted: true, isActive: false }).where(and(eq(customerDocumentsTable.id, id), eq(customerDocumentsTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "customerDocument", entityId: id });
  res.json({ success: true });
});

// ----- customerNotes -----
router.get("/customer-notes", requirePermission("customerNotes.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const search = qStr(q, "search");
  const filters: SQL[] = [eq(customerNotesTable.isDeleted, false)];
  if (search) {
    const s = or(ilike(customerNotesTable.note, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(customerNotesTable.companyId, companyId));
  const customerId = qStr(q, "customerId");
  if (customerId) filters.push(eq(customerNotesTable.customerId, customerId));
  const where = and(...filters);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customerNotesTable)
    .where(where);
  const rows = await db
    .select()
    .from(customerNotesTable)
    .where(where)
    .orderBy(desc(customerNotesTable.createdAt))
    .limit(pageSize)
    .offset(offset);
  res.json(ListCustomerNotesResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/customer-notes", requirePermission("customerNotes.create"), async (req, res): Promise<void> => {
  const parsed = CreateCustomerNoteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(customerNotesTable).values({ ...parsed.data }).returning();
  await recordAudit(req, { action: "create", entity: "customerNote", entityId: row.id, newValue: row });
  res.status(201).json(GetCustomerNoteResponse.parse(serializeRow(row)));
});

router.get("/customer-notes/:id", requirePermission("customerNotes.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(customerNotesTable).where(and(eq(customerNotesTable.id, id), eq(customerNotesTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetCustomerNoteResponse.parse(serializeRow(row)));
});

router.patch("/customer-notes/:id", requirePermission("customerNotes.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateCustomerNoteBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [existing] = await db.select().from(customerNotesTable).where(and(eq(customerNotesTable.id, id), eq(customerNotesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = { ...parsed.data };
  const [row] = Object.keys(update).length
    ? await db.update(customerNotesTable).set(update).where(eq(customerNotesTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "customerNote", entityId: id, oldValue: existing, newValue: row });
  res.json(GetCustomerNoteResponse.parse(serializeRow(row)));
});

router.delete("/customer-notes/:id", requirePermission("customerNotes.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.update(customerNotesTable).set({ isDeleted: true, isActive: false }).where(and(eq(customerNotesTable.id, id), eq(customerNotesTable.isDeleted, false))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await recordAudit(req, { action: "delete", entity: "customerNote", entityId: id });
  res.json({ success: true });
});

export default router;
