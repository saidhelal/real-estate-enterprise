import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import {
  db,
  taxCodesTable,
  customerInvoicesTable,
  customerInvoiceLinesTable,
  supplierInvoicesTable,
  supplierInvoiceLinesTable,
  paymentVouchersTable,
  paymentAllocationsTable,
  customersTable,
  suppliersTable,
  contractorsTable,
  cashboxesTable,
  bankAccountsTable,
  treasuryTransactionsTable,
  bankTransactionsTable,
} from "@workspace/db";
import {
  ListTaxCodesResponse,
  CreateTaxCodeBody,
  GetTaxCodeResponse,
  UpdateTaxCodeBody,
  ListCustomerInvoicesResponse,
  CreateCustomerInvoiceBody,
  GetCustomerInvoiceResponse,
  UpdateCustomerInvoiceBody,
  ListSupplierInvoicesResponse,
  CreateSupplierInvoiceBody,
  GetSupplierInvoiceResponse,
  UpdateSupplierInvoiceBody,
  ListPaymentVouchersResponse,
  CreatePaymentVoucherBody,
  GetPaymentVoucherResponse,
  UpdatePaymentVoucherBody,
  GetArAgingResponse,
  GetApAgingResponse,
  GetTaxReportResponse,
} from "@workspace/api-zod";
import { serializeRow, pageParams, qStr } from "../lib/serialize";
import { recordAudit } from "../lib/audit";
import { callerCompanyId } from "../lib/register-crud";
import { requireAuth, requirePermission } from "../middleware/auth";
import {
  PostingError,
  getCompanyMapping,
  postAutomaticLines,
  reverseAutomaticEntriesForSource,
  nextJournalNumber,
  type Tx,
  type EntryLineInput,
} from "../lib/posting";
import { toCents, fromCents, amountOrThrow, validAmount } from "../lib/money";

const router: IRouter = Router();
router.use(requireAuth);

// Map a payment method to the account-mapping event key for payment vouchers.
const PAYMENT_EVENT: Record<string, string> = {
  cash: "payment.cash",
  bank_transfer: "payment.bank",
  cheque: "payment.cheque",
};

// ---- decimal-safe line math (integer cents / scaled rationals) -----------
// Parse a quantity (numeric(14,4)) to an integer scaled by 10^4, or null.
function qtyScaled(value: string | null | undefined): bigint | null {
  const v = (value ?? "1").trim();
  if (!/^\d+(\.\d+)?$/.test(v)) return null;
  const [intPart, fracRaw = ""] = v.split(".");
  const frac = (fracRaw + "0000").slice(0, 4);
  return BigInt(intPart) * 10000n + BigInt(frac);
}
// Parse a percentage rate (numeric(7,4)) to an integer scaled by 10^4, or null.
function rateScaled(value: string | null | undefined): bigint | null {
  const v = (value ?? "0").trim();
  if (!/^\d+(\.\d+)?$/.test(v)) return null;
  const [intPart, fracRaw = ""] = v.split(".");
  const frac = (fracRaw + "0000").slice(0, 4);
  return BigInt(intPart) * 10000n + BigInt(frac);
}
// unitPriceCents * qty(/10^4), half-up rounded to cents.
function lineSubtotalCents(unitPriceCents: bigint, qty4: bigint): bigint {
  const num = unitPriceCents * qty4;
  const q = num / 10000n;
  const r = num % 10000n;
  return r * 2n >= 10000n ? q + 1n : q;
}
// baseCents * rate%(/10^4), half-up rounded to cents.
function taxCents(baseCents: bigint, rate4: bigint): bigint {
  const num = baseCents * rate4;
  const den = 1_000_000n;
  const q = num / den;
  const r = num % den;
  return r * 2n >= den ? q + 1n : q;
}

interface ComputedLine {
  lineNumber: number;
  description: string;
  quantity: string;
  unitPrice: string;
  lineSubtotal: string;
  taxCodeId: string | null;
  taxRate: string;
  taxAmount: string;
  lineTotal: string;
  costCenterId: string | null;
  profitCenterId: string | null;
  revenueAccountId?: string | null;
  expenseAccountId?: string | null;
  subtotalCents: bigint;
  taxAmountCents: bigint;
}

interface InvoiceLineInput {
  description: string;
  quantity?: string;
  unitPrice?: string;
  taxCodeId?: string;
  revenueAccountId?: string;
  expenseAccountId?: string;
  costCenterId?: string;
  profitCenterId?: string;
}

// Resolve each line's amounts using its tax code (loaded once per request).
async function computeLines(
  tx: Tx,
  companyId: string,
  lines: InvoiceLineInput[],
  kind: "customer" | "supplier",
): Promise<{ computed: ComputedLine[]; subtotalCents: bigint; taxTotalCents: bigint }> {
  const taxCodeIds = Array.from(new Set(lines.map((l) => l.taxCodeId).filter((x): x is string => !!x)));
  const taxCodes = taxCodeIds.length
    ? await tx.select().from(taxCodesTable).where(and(eq(taxCodesTable.companyId, companyId), eq(taxCodesTable.isDeleted, false)))
    : [];
  const taxById = new Map(taxCodes.map((t) => [t.id, t]));

  const computed: ComputedLine[] = [];
  let subtotalCents = 0n;
  let taxTotalCents = 0n;
  let n = 1;
  for (const l of lines) {
    const unitCents = toCents(l.unitPrice ?? "0");
    const qty4 = qtyScaled(l.quantity ?? "1");
    if (unitCents === null || qty4 === null) throw new PostingError(400, "Invalid quantity or unit price on a line");
    const subCents = lineSubtotalCents(unitCents, qty4);
    let rate4 = 0n;
    if (l.taxCodeId) {
      const tc = taxById.get(l.taxCodeId);
      if (!tc) throw new PostingError(400, "Tax code not found");
      const r = rateScaled(tc.rate);
      if (r === null) throw new PostingError(400, "Invalid tax rate");
      rate4 = r;
    }
    const taxAmtCents = taxCents(subCents, rate4);
    subtotalCents += subCents;
    taxTotalCents += taxAmtCents;
    computed.push({
      lineNumber: n++,
      description: l.description,
      quantity: l.quantity ?? "1",
      unitPrice: fromCents(unitCents),
      lineSubtotal: fromCents(subCents),
      taxCodeId: l.taxCodeId ?? null,
      taxRate: fromCents(rate4 / 100n) /* rate4 is /10^4; show with 2dp */,
      taxAmount: fromCents(taxAmtCents),
      lineTotal: fromCents(subCents + taxAmtCents),
      costCenterId: l.costCenterId ?? null,
      profitCenterId: l.profitCenterId ?? null,
      revenueAccountId: kind === "customer" ? l.revenueAccountId ?? null : undefined,
      expenseAccountId: kind === "supplier" ? l.expenseAccountId ?? null : undefined,
      subtotalCents: subCents,
      taxAmountCents: taxAmtCents,
    });
  }
  return { computed, subtotalCents, taxTotalCents };
}

// ===================== tax codes =====================
router.get("/tax-codes", requirePermission("taxCodes.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(taxCodesTable.isDeleted, false)];
  const search = qStr(q, "search");
  if (search) {
    const s = or(ilike(taxCodesTable.code, `%${search}%`), ilike(taxCodesTable.name, `%${search}%`), ilike(taxCodesTable.nameAr, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(taxCodesTable.companyId, companyId));
  const taxType = qStr(q, "taxType");
  if (taxType) filters.push(eq(taxCodesTable.taxType, taxType));
  const status = qStr(q, "status");
  if (status) filters.push(eq(taxCodesTable.status, status));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(taxCodesTable).where(where);
  const rows = await db.select().from(taxCodesTable).where(where).orderBy(desc(taxCodesTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListTaxCodesResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/tax-codes", requirePermission("taxCodes.create"), async (req, res): Promise<void> => {
  const parsed = CreateTaxCodeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (validAmount(parsed.data.rate) === null) { res.status(400).json({ error: "Invalid rate" }); return; }
  const [row] = await db.insert(taxCodesTable).values(parsed.data).returning();
  await recordAudit(req, { action: "create", entity: "taxCode", entityId: row.id, newValue: row });
  res.status(201).json(GetTaxCodeResponse.parse(serializeRow(row)));
});

router.get("/tax-codes/:id", requirePermission("taxCodes.view"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db.select().from(taxCodesTable).where(and(eq(taxCodesTable.id, id), eq(taxCodesTable.isDeleted, false)));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetTaxCodeResponse.parse(serializeRow(row)));
});

router.patch("/tax-codes/:id", requirePermission("taxCodes.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateTaxCodeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  if (parsed.data.rate !== undefined && validAmount(parsed.data.rate) === null) { res.status(400).json({ error: "Invalid rate" }); return; }
  const [existing] = await db.select().from(taxCodesTable).where(and(eq(taxCodesTable.id, id), eq(taxCodesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const [row] = Object.keys(parsed.data).length
    ? await db.update(taxCodesTable).set(parsed.data).where(eq(taxCodesTable.id, id)).returning()
    : [existing];
  await recordAudit(req, { action: "update", entity: "taxCode", entityId: id, oldValue: existing, newValue: row });
  res.json(GetTaxCodeResponse.parse(serializeRow(row)));
});

router.delete("/tax-codes/:id", requirePermission("taxCodes.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [existing] = await db.select().from(taxCodesTable).where(and(eq(taxCodesTable.id, id), eq(taxCodesTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  await db.update(taxCodesTable).set({ isDeleted: true, isActive: false }).where(eq(taxCodesTable.id, id));
  await recordAudit(req, { action: "delete", entity: "taxCode", entityId: id, oldValue: existing });
  res.json({ success: true });
});

// ===================== customer invoices (AR) =====================
async function loadCustomerInvoice(tx: Tx, id: string) {
  const [inv] = await tx.select().from(customerInvoicesTable).where(and(eq(customerInvoicesTable.id, id), eq(customerInvoicesTable.isDeleted, false)));
  if (!inv) return null;
  const lines = await tx.select().from(customerInvoiceLinesTable)
    .where(and(eq(customerInvoiceLinesTable.invoiceId, id), eq(customerInvoiceLinesTable.isDeleted, false)))
    .orderBy(customerInvoiceLinesTable.lineNumber);
  return { inv, lines };
}

function customerInvoiceDetail(inv: Record<string, unknown>, lines: Record<string, unknown>[]) {
  return { ...serializeRow(inv), lines: lines.map(serializeRow) };
}

router.get("/customer-invoices", requirePermission("customerInvoices.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(customerInvoicesTable.isDeleted, false)];
  const search = qStr(q, "search");
  if (search) {
    const s = or(ilike(customerInvoicesTable.number, `%${search}%`), ilike(customerInvoicesTable.reference, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(customerInvoicesTable.companyId, companyId));
  const customerId = qStr(q, "customerId");
  if (customerId) filters.push(eq(customerInvoicesTable.customerId, customerId));
  const contractId = qStr(q, "contractId");
  if (contractId) filters.push(eq(customerInvoicesTable.contractId, contractId));
  const status = qStr(q, "status");
  if (status) filters.push(eq(customerInvoicesTable.status, status));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(customerInvoicesTable).where(where);
  const rows = await db.select().from(customerInvoicesTable).where(where).orderBy(desc(customerInvoicesTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListCustomerInvoicesResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/customer-invoices", requirePermission("customerInvoices.create"), async (req, res): Promise<void> => {
  const parsed = CreateCustomerInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;
  if (!data.lines.length) { res.status(400).json({ error: "An invoice needs at least one line" }); return; }
  try {
    const result = await db.transaction(async (tx) => {
      const { computed, subtotalCents, taxTotalCents } = await computeLines(tx, data.companyId, data.lines, "customer");
      // Its own sequence (CINV), not the journal's: an invoice carrying a
      // journal-entry number is unreadable to anyone reconciling the two. Any
      // `number` the client sent is discarded — it is not theirs to choose.
      const number = await nextJournalNumber(tx, callerCompanyId(req), "Customer Invoice");
      const [inv] = await tx.insert(customerInvoicesTable).values({
        companyId: data.companyId,
        branchId: data.branchId ?? null,
        number,
        customerId: data.customerId,
        contractId: data.contractId ?? null,
        unitId: data.unitId ?? null,
        invoiceDate: data.invoiceDate,
        dueDate: data.dueDate ?? null,
        status: "draft",
        currencyId: data.currencyId ?? null,
        receivableAccountId: data.receivableAccountId ?? null,
        subtotal: fromCents(subtotalCents),
        taxTotal: fromCents(taxTotalCents),
        total: fromCents(subtotalCents + taxTotalCents),
        reference: data.reference ?? null,
        description: data.description ?? null,
        notes: data.notes ?? null,
        userId: req.authUser?.id ?? null,
      }).returning();
      const lines = await tx.insert(customerInvoiceLinesTable).values(computed.map((c) => ({
        companyId: data.companyId,
        invoiceId: inv.id,
        lineNumber: c.lineNumber,
        description: c.description,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        lineSubtotal: c.lineSubtotal,
        taxCodeId: c.taxCodeId,
        taxRate: c.taxRate,
        taxAmount: c.taxAmount,
        lineTotal: c.lineTotal,
        revenueAccountId: c.revenueAccountId ?? null,
        costCenterId: c.costCenterId,
        profitCenterId: c.profitCenterId,
      }))).returning();
      return { inv, lines };
    });
    await recordAudit(req, { action: "create", entity: "customerInvoice", entityId: result.inv.id, newValue: result.inv });
    res.status(201).json(GetCustomerInvoiceResponse.parse(customerInvoiceDetail(result.inv, result.lines)));
  } catch (e) {
    if (e instanceof PostingError) { res.status(e.status).json({ error: e.message }); return; }
    throw e;
  }
});

router.get("/customer-invoices/:id", requirePermission("customerInvoices.view"), async (req, res): Promise<void> => {
  const got = await loadCustomerInvoice(db as unknown as Tx, String(req.params.id));
  if (!got) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetCustomerInvoiceResponse.parse(customerInvoiceDetail(got.inv, got.lines)));
});

router.patch("/customer-invoices/:id", requirePermission("customerInvoices.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateCustomerInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;
  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(customerInvoicesTable).where(and(eq(customerInvoicesTable.id, id), eq(customerInvoicesTable.isDeleted, false))).for("update");
      if (!existing) return { notFound: true as const };
      if (existing.status !== "draft") return { conflict: "Only a draft invoice can be edited" as const };
      const patch: Record<string, unknown> = {
        branchId: data.branchId ?? existing.branchId,
        customerId: data.customerId ?? existing.customerId,
        contractId: data.contractId ?? existing.contractId,
        unitId: data.unitId ?? existing.unitId,
        invoiceDate: data.invoiceDate ?? existing.invoiceDate,
        dueDate: data.dueDate ?? existing.dueDate,
        currencyId: data.currencyId ?? existing.currencyId,
        receivableAccountId: data.receivableAccountId ?? existing.receivableAccountId,
        reference: data.reference ?? existing.reference,
        description: data.description ?? existing.description,
        notes: data.notes ?? existing.notes,
      };
      if (data.lines) {
        const { computed, subtotalCents, taxTotalCents } = await computeLines(tx, existing.companyId, data.lines, "customer");
        patch.subtotal = fromCents(subtotalCents);
        patch.taxTotal = fromCents(taxTotalCents);
        patch.total = fromCents(subtotalCents + taxTotalCents);
        await tx.delete(customerInvoiceLinesTable).where(eq(customerInvoiceLinesTable.invoiceId, id));
        await tx.insert(customerInvoiceLinesTable).values(computed.map((c) => ({
          companyId: existing.companyId, invoiceId: id, lineNumber: c.lineNumber, description: c.description,
          quantity: c.quantity, unitPrice: c.unitPrice, lineSubtotal: c.lineSubtotal, taxCodeId: c.taxCodeId,
          taxRate: c.taxRate, taxAmount: c.taxAmount, lineTotal: c.lineTotal, revenueAccountId: c.revenueAccountId ?? null,
          costCenterId: c.costCenterId, profitCenterId: c.profitCenterId,
        })));
      }
      await tx.update(customerInvoicesTable).set(patch).where(eq(customerInvoicesTable.id, id));
      const got = await loadCustomerInvoice(tx, id);
      return { got: got! };
    });
    if ("notFound" in result) { res.status(404).json({ error: "Not found" }); return; }
    if ("conflict" in result) { res.status(409).json({ error: result.conflict }); return; }
    await recordAudit(req, { action: "update", entity: "customerInvoice", entityId: id, newValue: result.got.inv });
    res.json(GetCustomerInvoiceResponse.parse(customerInvoiceDetail(result.got.inv, result.got.lines)));
  } catch (e) {
    if (e instanceof PostingError) { res.status(e.status).json({ error: e.message }); return; }
    throw e;
  }
});

router.delete("/customer-invoices/:id", requirePermission("customerInvoices.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(customerInvoicesTable).where(and(eq(customerInvoicesTable.id, id), eq(customerInvoicesTable.isDeleted, false))).for("update");
    if (!existing) return { notFound: true as const };
    if (existing.status !== "draft" && existing.status !== "cancelled") return { conflict: "Only a draft invoice can be deleted; reverse a posted invoice instead" as const };
    await tx.update(customerInvoicesTable).set({ isDeleted: true, isActive: false }).where(eq(customerInvoicesTable.id, id));
    return { existing };
  });
  if ("notFound" in result) { res.status(404).json({ error: "Not found" }); return; }
  if ("conflict" in result) { res.status(409).json({ error: result.conflict }); return; }
  await recordAudit(req, { action: "delete", entity: "customerInvoice", entityId: id, oldValue: result.existing });
  res.json({ success: true });
});

router.post("/customer-invoices/:id/post", requirePermission("customerInvoices.post"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  try {
    const result = await db.transaction(async (tx) => {
      const [inv] = await tx.select().from(customerInvoicesTable).where(and(eq(customerInvoicesTable.id, id), eq(customerInvoicesTable.isDeleted, false))).for("update");
      if (!inv) return { notFound: true as const };
      if (inv.status !== "draft") return { conflict: "Only a draft invoice can be posted" as const };
      const lines = await tx.select().from(customerInvoiceLinesTable).where(and(eq(customerInvoiceLinesTable.invoiceId, id), eq(customerInvoiceLinesTable.isDeleted, false))).orderBy(customerInvoiceLinesTable.lineNumber);
      const [cust] = await tx.select({ recv: customersTable.receivableAccountId }).from(customersTable).where(eq(customersTable.id, inv.customerId));
      const arMap = await getCompanyMapping(tx, inv.companyId, "invoice.customer.revenue");
      const taxMap = await getCompanyMapping(tx, inv.companyId, "invoice.customer.tax");
      const receivableId = inv.receivableAccountId ?? cust?.recv ?? arMap?.debitAccountId ?? null;
      if (!receivableId) throw new PostingError(409, "No receivable account configured for this customer invoice");

      const taxCodeIds = Array.from(new Set(lines.map((l) => l.taxCodeId).filter((x): x is string => !!x)));
      const taxCodes = taxCodeIds.length ? await tx.select().from(taxCodesTable).where(eq(taxCodesTable.companyId, inv.companyId)) : [];
      const taxAcctByCode = new Map(taxCodes.map((t) => [t.id, t.taxAccountId]));

      const entryLines: EntryLineInput[] = [{ accountId: receivableId, debit: amountOrThrow(inv.total), credit: "0", description: `Invoice ${inv.number}` }];
      for (const l of lines) {
        const subCents = toCents(l.lineSubtotal) ?? 0n;
        if (subCents > 0n) {
          const revId = l.revenueAccountId ?? arMap?.creditAccountId ?? null;
          if (!revId) throw new PostingError(409, "No revenue account configured for an invoice line");
          entryLines.push({ accountId: revId, debit: "0", credit: fromCents(subCents), costCenterId: l.costCenterId, profitCenterId: l.profitCenterId, description: l.description });
        }
        const taxAmtCents = toCents(l.taxAmount) ?? 0n;
        if (taxAmtCents > 0n) {
          const taxId = (l.taxCodeId ? taxAcctByCode.get(l.taxCodeId) : null) ?? taxMap?.creditAccountId ?? null;
          if (!taxId) throw new PostingError(409, "No tax account configured for an invoice line");
          entryLines.push({ accountId: taxId, debit: "0", credit: fromCents(taxAmtCents), description: `Output tax ${inv.number}` });
        }
      }
      const je = await postAutomaticLines(tx, {
        companyId: inv.companyId, branchId: inv.branchId, entryDate: inv.invoiceDate,
        description: `Customer invoice ${inv.number}`, reference: inv.number,
        sourceType: "customerInvoice", sourceId: inv.id, userId: req.authUser?.id ?? null, lines: entryLines,
      });
      await tx.update(customerInvoicesTable).set({ status: "posted", postedAt: new Date(), postedBy: req.authUser?.id ?? null, journalEntryId: je.id }).where(eq(customerInvoicesTable.id, id));
      const got = await loadCustomerInvoice(tx, id);
      return { got: got! };
    });
    if ("notFound" in result) { res.status(404).json({ error: "Not found" }); return; }
    if ("conflict" in result) { res.status(409).json({ error: result.conflict }); return; }
    await recordAudit(req, { action: "post", entity: "customerInvoice", entityId: id, newValue: result.got.inv });
    res.json(GetCustomerInvoiceResponse.parse(customerInvoiceDetail(result.got.inv, result.got.lines)));
  } catch (e) {
    if (e instanceof PostingError) { res.status(e.status).json({ error: e.message }); return; }
    throw e;
  }
});

router.post("/customer-invoices/:id/reverse", requirePermission("customerInvoices.reverse"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  try {
    const result = await db.transaction(async (tx) => {
      const [inv] = await tx.select().from(customerInvoicesTable).where(and(eq(customerInvoicesTable.id, id), eq(customerInvoicesTable.isDeleted, false))).for("update");
      if (!inv) return { notFound: true as const };
      if (inv.status !== "posted") return { conflict: "Only a posted invoice can be reversed" as const };
      if ((toCents(inv.paidAmount) ?? 0n) > 0n) return { conflict: "Unallocate receipts before reversing this invoice" as const };
      await reverseAutomaticEntriesForSource(tx, "customerInvoice", inv.id, req.authUser?.id ?? null);
      await tx.update(customerInvoicesTable).set({ status: "reversed", reversedAt: new Date(), reversedBy: req.authUser?.id ?? null }).where(eq(customerInvoicesTable.id, id));
      const got = await loadCustomerInvoice(tx, id);
      return { got: got! };
    });
    if ("notFound" in result) { res.status(404).json({ error: "Not found" }); return; }
    if ("conflict" in result) { res.status(409).json({ error: result.conflict }); return; }
    await recordAudit(req, { action: "reverse", entity: "customerInvoice", entityId: id, newValue: result.got.inv });
    res.json(GetCustomerInvoiceResponse.parse(customerInvoiceDetail(result.got.inv, result.got.lines)));
  } catch (e) {
    if (e instanceof PostingError) { res.status(e.status).json({ error: e.message }); return; }
    throw e;
  }
});

router.post("/customer-invoices/:id/cancel", requirePermission("customerInvoices.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const result = await db.transaction(async (tx) => {
    const [inv] = await tx.select().from(customerInvoicesTable).where(and(eq(customerInvoicesTable.id, id), eq(customerInvoicesTable.isDeleted, false))).for("update");
    if (!inv) return { notFound: true as const };
    if (inv.status !== "draft") return { conflict: "Only a draft invoice can be cancelled" as const };
    await tx.update(customerInvoicesTable).set({ status: "cancelled", cancelledAt: new Date(), cancelledBy: req.authUser?.id ?? null }).where(eq(customerInvoicesTable.id, id));
    const got = await loadCustomerInvoice(tx, id);
    return { got: got! };
  });
  if ("notFound" in result) { res.status(404).json({ error: "Not found" }); return; }
  if ("conflict" in result) { res.status(409).json({ error: result.conflict }); return; }
  await recordAudit(req, { action: "cancel", entity: "customerInvoice", entityId: id, newValue: result.got.inv });
  res.json(GetCustomerInvoiceResponse.parse(customerInvoiceDetail(result.got.inv, result.got.lines)));
});

// ===================== supplier invoices (AP) =====================
async function loadSupplierInvoice(tx: Tx, id: string) {
  const [inv] = await tx.select().from(supplierInvoicesTable).where(and(eq(supplierInvoicesTable.id, id), eq(supplierInvoicesTable.isDeleted, false)));
  if (!inv) return null;
  const lines = await tx.select().from(supplierInvoiceLinesTable)
    .where(and(eq(supplierInvoiceLinesTable.invoiceId, id), eq(supplierInvoiceLinesTable.isDeleted, false)))
    .orderBy(supplierInvoiceLinesTable.lineNumber);
  return { inv, lines };
}

function supplierInvoiceDetail(inv: Record<string, unknown>, lines: Record<string, unknown>[]) {
  return { ...serializeRow(inv), lines: lines.map(serializeRow) };
}

router.get("/supplier-invoices", requirePermission("supplierInvoices.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(supplierInvoicesTable.isDeleted, false)];
  const search = qStr(q, "search");
  if (search) {
    const s = or(ilike(supplierInvoicesTable.number, `%${search}%`), ilike(supplierInvoicesTable.supplierInvoiceNumber, `%${search}%`), ilike(supplierInvoicesTable.reference, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(supplierInvoicesTable.companyId, companyId));
  const supplierId = qStr(q, "supplierId");
  if (supplierId) filters.push(eq(supplierInvoicesTable.supplierId, supplierId));
  const status = qStr(q, "status");
  if (status) filters.push(eq(supplierInvoicesTable.status, status));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(supplierInvoicesTable).where(where);
  const rows = await db.select().from(supplierInvoicesTable).where(where).orderBy(desc(supplierInvoicesTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListSupplierInvoicesResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/supplier-invoices", requirePermission("supplierInvoices.create"), async (req, res): Promise<void> => {
  const parsed = CreateSupplierInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;
  if (!data.lines.length) { res.status(400).json({ error: "An invoice needs at least one line" }); return; }
  try {
    const result = await db.transaction(async (tx) => {
      const { computed, subtotalCents, taxTotalCents } = await computeLines(tx, data.companyId, data.lines, "supplier");
      // SINV, its own counter. A client-sent `number` is discarded.
      const number = await nextJournalNumber(tx, callerCompanyId(req), "Supplier Invoice");
      const [inv] = await tx.insert(supplierInvoicesTable).values({
        companyId: data.companyId,
        branchId: data.branchId ?? null,
        number,
        supplierId: data.supplierId,
        contractId: data.contractId ?? null,
        supplierInvoiceNumber: data.supplierInvoiceNumber ?? null,
        invoiceDate: data.invoiceDate,
        dueDate: data.dueDate ?? null,
        status: "draft",
        currencyId: data.currencyId ?? null,
        payableAccountId: data.payableAccountId ?? null,
        subtotal: fromCents(subtotalCents),
        taxTotal: fromCents(taxTotalCents),
        total: fromCents(subtotalCents + taxTotalCents),
        reference: data.reference ?? null,
        description: data.description ?? null,
        notes: data.notes ?? null,
        userId: req.authUser?.id ?? null,
      }).returning();
      const lines = await tx.insert(supplierInvoiceLinesTable).values(computed.map((c) => ({
        companyId: data.companyId, invoiceId: inv.id, lineNumber: c.lineNumber, description: c.description,
        quantity: c.quantity, unitPrice: c.unitPrice, lineSubtotal: c.lineSubtotal, taxCodeId: c.taxCodeId,
        taxRate: c.taxRate, taxAmount: c.taxAmount, lineTotal: c.lineTotal, expenseAccountId: c.expenseAccountId ?? null,
        costCenterId: c.costCenterId, profitCenterId: c.profitCenterId,
      }))).returning();
      return { inv, lines };
    });
    await recordAudit(req, { action: "create", entity: "supplierInvoice", entityId: result.inv.id, newValue: result.inv });
    res.status(201).json(GetSupplierInvoiceResponse.parse(supplierInvoiceDetail(result.inv, result.lines)));
  } catch (e) {
    if (e instanceof PostingError) { res.status(e.status).json({ error: e.message }); return; }
    throw e;
  }
});

router.get("/supplier-invoices/:id", requirePermission("supplierInvoices.view"), async (req, res): Promise<void> => {
  const got = await loadSupplierInvoice(db as unknown as Tx, String(req.params.id));
  if (!got) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetSupplierInvoiceResponse.parse(supplierInvoiceDetail(got.inv, got.lines)));
});

router.patch("/supplier-invoices/:id", requirePermission("supplierInvoices.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateSupplierInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;
  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(supplierInvoicesTable).where(and(eq(supplierInvoicesTable.id, id), eq(supplierInvoicesTable.isDeleted, false))).for("update");
      if (!existing) return { notFound: true as const };
      if (existing.status !== "draft") return { conflict: "Only a draft invoice can be edited" as const };
      const patch: Record<string, unknown> = {
        branchId: data.branchId ?? existing.branchId,
        supplierId: data.supplierId ?? existing.supplierId,
        contractId: data.contractId ?? existing.contractId,
        supplierInvoiceNumber: data.supplierInvoiceNumber ?? existing.supplierInvoiceNumber,
        invoiceDate: data.invoiceDate ?? existing.invoiceDate,
        dueDate: data.dueDate ?? existing.dueDate,
        currencyId: data.currencyId ?? existing.currencyId,
        payableAccountId: data.payableAccountId ?? existing.payableAccountId,
        reference: data.reference ?? existing.reference,
        description: data.description ?? existing.description,
        notes: data.notes ?? existing.notes,
      };
      if (data.lines) {
        const { computed, subtotalCents, taxTotalCents } = await computeLines(tx, existing.companyId, data.lines, "supplier");
        patch.subtotal = fromCents(subtotalCents);
        patch.taxTotal = fromCents(taxTotalCents);
        patch.total = fromCents(subtotalCents + taxTotalCents);
        await tx.delete(supplierInvoiceLinesTable).where(eq(supplierInvoiceLinesTable.invoiceId, id));
        await tx.insert(supplierInvoiceLinesTable).values(computed.map((c) => ({
          companyId: existing.companyId, invoiceId: id, lineNumber: c.lineNumber, description: c.description,
          quantity: c.quantity, unitPrice: c.unitPrice, lineSubtotal: c.lineSubtotal, taxCodeId: c.taxCodeId,
          taxRate: c.taxRate, taxAmount: c.taxAmount, lineTotal: c.lineTotal, expenseAccountId: c.expenseAccountId ?? null,
          costCenterId: c.costCenterId, profitCenterId: c.profitCenterId,
        })));
      }
      await tx.update(supplierInvoicesTable).set(patch).where(eq(supplierInvoicesTable.id, id));
      const got = await loadSupplierInvoice(tx, id);
      return { got: got! };
    });
    if ("notFound" in result) { res.status(404).json({ error: "Not found" }); return; }
    if ("conflict" in result) { res.status(409).json({ error: result.conflict }); return; }
    await recordAudit(req, { action: "update", entity: "supplierInvoice", entityId: id, newValue: result.got.inv });
    res.json(GetSupplierInvoiceResponse.parse(supplierInvoiceDetail(result.got.inv, result.got.lines)));
  } catch (e) {
    if (e instanceof PostingError) { res.status(e.status).json({ error: e.message }); return; }
    throw e;
  }
});

router.delete("/supplier-invoices/:id", requirePermission("supplierInvoices.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(supplierInvoicesTable).where(and(eq(supplierInvoicesTable.id, id), eq(supplierInvoicesTable.isDeleted, false))).for("update");
    if (!existing) return { notFound: true as const };
    if (existing.status !== "draft" && existing.status !== "cancelled") return { conflict: "Only a draft invoice can be deleted; reverse a posted invoice instead" as const };
    await tx.update(supplierInvoicesTable).set({ isDeleted: true, isActive: false }).where(eq(supplierInvoicesTable.id, id));
    return { existing };
  });
  if ("notFound" in result) { res.status(404).json({ error: "Not found" }); return; }
  if ("conflict" in result) { res.status(409).json({ error: result.conflict }); return; }
  await recordAudit(req, { action: "delete", entity: "supplierInvoice", entityId: id, oldValue: result.existing });
  res.json({ success: true });
});

router.post("/supplier-invoices/:id/post", requirePermission("supplierInvoices.post"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  try {
    const result = await db.transaction(async (tx) => {
      const [inv] = await tx.select().from(supplierInvoicesTable).where(and(eq(supplierInvoicesTable.id, id), eq(supplierInvoicesTable.isDeleted, false))).for("update");
      if (!inv) return { notFound: true as const };
      if (inv.status !== "draft") return { conflict: "Only a draft invoice can be posted" as const };
      const lines = await tx.select().from(supplierInvoiceLinesTable).where(and(eq(supplierInvoiceLinesTable.invoiceId, id), eq(supplierInvoiceLinesTable.isDeleted, false))).orderBy(supplierInvoiceLinesTable.lineNumber);
      const [supp] = await tx.select({ pay: suppliersTable.payableAccountId }).from(suppliersTable).where(eq(suppliersTable.id, inv.supplierId));
      const apMap = await getCompanyMapping(tx, inv.companyId, "invoice.supplier.expense");
      const taxMap = await getCompanyMapping(tx, inv.companyId, "invoice.supplier.tax");
      const payableId = inv.payableAccountId ?? supp?.pay ?? apMap?.creditAccountId ?? null;
      if (!payableId) throw new PostingError(409, "No payable account configured for this supplier invoice");

      const taxCodeIds = Array.from(new Set(lines.map((l) => l.taxCodeId).filter((x): x is string => !!x)));
      const taxCodes = taxCodeIds.length ? await tx.select().from(taxCodesTable).where(eq(taxCodesTable.companyId, inv.companyId)) : [];
      const taxAcctByCode = new Map(taxCodes.map((t) => [t.id, t.taxAccountId]));

      const entryLines: EntryLineInput[] = [];
      for (const l of lines) {
        const subCents = toCents(l.lineSubtotal) ?? 0n;
        if (subCents > 0n) {
          const expId = l.expenseAccountId ?? apMap?.debitAccountId ?? null;
          if (!expId) throw new PostingError(409, "No expense account configured for an invoice line");
          entryLines.push({ accountId: expId, debit: fromCents(subCents), credit: "0", costCenterId: l.costCenterId, profitCenterId: l.profitCenterId, description: l.description });
        }
        const taxAmtCents = toCents(l.taxAmount) ?? 0n;
        if (taxAmtCents > 0n) {
          const taxId = (l.taxCodeId ? taxAcctByCode.get(l.taxCodeId) : null) ?? taxMap?.debitAccountId ?? null;
          if (!taxId) throw new PostingError(409, "No tax account configured for an invoice line");
          entryLines.push({ accountId: taxId, debit: fromCents(taxAmtCents), credit: "0", description: `Input tax ${inv.number}` });
        }
      }
      entryLines.push({ accountId: payableId, debit: "0", credit: amountOrThrow(inv.total), description: `Invoice ${inv.number}` });
      const je = await postAutomaticLines(tx, {
        companyId: inv.companyId, branchId: inv.branchId, entryDate: inv.invoiceDate,
        description: `Supplier invoice ${inv.number}`, reference: inv.number,
        sourceType: "supplierInvoice", sourceId: inv.id, userId: req.authUser?.id ?? null, lines: entryLines,
      });
      await tx.update(supplierInvoicesTable).set({ status: "posted", postedAt: new Date(), postedBy: req.authUser?.id ?? null, journalEntryId: je.id }).where(eq(supplierInvoicesTable.id, id));
      const got = await loadSupplierInvoice(tx, id);
      return { got: got! };
    });
    if ("notFound" in result) { res.status(404).json({ error: "Not found" }); return; }
    if ("conflict" in result) { res.status(409).json({ error: result.conflict }); return; }
    await recordAudit(req, { action: "post", entity: "supplierInvoice", entityId: id, newValue: result.got.inv });
    res.json(GetSupplierInvoiceResponse.parse(supplierInvoiceDetail(result.got.inv, result.got.lines)));
  } catch (e) {
    if (e instanceof PostingError) { res.status(e.status).json({ error: e.message }); return; }
    throw e;
  }
});

router.post("/supplier-invoices/:id/reverse", requirePermission("supplierInvoices.reverse"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  try {
    const result = await db.transaction(async (tx) => {
      const [inv] = await tx.select().from(supplierInvoicesTable).where(and(eq(supplierInvoicesTable.id, id), eq(supplierInvoicesTable.isDeleted, false))).for("update");
      if (!inv) return { notFound: true as const };
      if (inv.status !== "posted") return { conflict: "Only a posted invoice can be reversed" as const };
      if ((toCents(inv.paidAmount) ?? 0n) > 0n) return { conflict: "Unallocate payments before reversing this invoice" as const };
      await reverseAutomaticEntriesForSource(tx, "supplierInvoice", inv.id, req.authUser?.id ?? null);
      await tx.update(supplierInvoicesTable).set({ status: "reversed", reversedAt: new Date(), reversedBy: req.authUser?.id ?? null }).where(eq(supplierInvoicesTable.id, id));
      const got = await loadSupplierInvoice(tx, id);
      return { got: got! };
    });
    if ("notFound" in result) { res.status(404).json({ error: "Not found" }); return; }
    if ("conflict" in result) { res.status(409).json({ error: result.conflict }); return; }
    await recordAudit(req, { action: "reverse", entity: "supplierInvoice", entityId: id, newValue: result.got.inv });
    res.json(GetSupplierInvoiceResponse.parse(supplierInvoiceDetail(result.got.inv, result.got.lines)));
  } catch (e) {
    if (e instanceof PostingError) { res.status(e.status).json({ error: e.message }); return; }
    throw e;
  }
});

router.post("/supplier-invoices/:id/cancel", requirePermission("supplierInvoices.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const result = await db.transaction(async (tx) => {
    const [inv] = await tx.select().from(supplierInvoicesTable).where(and(eq(supplierInvoicesTable.id, id), eq(supplierInvoicesTable.isDeleted, false))).for("update");
    if (!inv) return { notFound: true as const };
    if (inv.status !== "draft") return { conflict: "Only a draft invoice can be cancelled" as const };
    await tx.update(supplierInvoicesTable).set({ status: "cancelled", cancelledAt: new Date(), cancelledBy: req.authUser?.id ?? null }).where(eq(supplierInvoicesTable.id, id));
    const got = await loadSupplierInvoice(tx, id);
    return { got: got! };
  });
  if ("notFound" in result) { res.status(404).json({ error: "Not found" }); return; }
  if ("conflict" in result) { res.status(409).json({ error: result.conflict }); return; }
  await recordAudit(req, { action: "cancel", entity: "supplierInvoice", entityId: id, newValue: result.got.inv });
  res.json(GetSupplierInvoiceResponse.parse(supplierInvoiceDetail(result.got.inv, result.got.lines)));
});

// ===================== payment vouchers =====================
async function loadPaymentVoucher(tx: Tx, id: string) {
  const [pv] = await tx.select().from(paymentVouchersTable).where(and(eq(paymentVouchersTable.id, id), eq(paymentVouchersTable.isDeleted, false)));
  if (!pv) return null;
  const allocations = await tx.select().from(paymentAllocationsTable)
    .where(and(eq(paymentAllocationsTable.paymentVoucherId, id), eq(paymentAllocationsTable.isDeleted, false)));
  return { pv, allocations };
}

function paymentVoucherDetail(pv: Record<string, unknown>, allocations: Record<string, unknown>[]) {
  return { ...serializeRow(pv), allocations: allocations.map(serializeRow) };
}

router.get("/payment-vouchers", requirePermission("paymentVouchers.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const { page, pageSize, offset } = pageParams(q);
  const filters: SQL[] = [eq(paymentVouchersTable.isDeleted, false)];
  const search = qStr(q, "search");
  if (search) {
    const s = or(ilike(paymentVouchersTable.code, `%${search}%`), ilike(paymentVouchersTable.payeeName, `%${search}%`), ilike(paymentVouchersTable.reference, `%${search}%`));
    if (s) filters.push(s);
  }
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(paymentVouchersTable.companyId, companyId));
  const supplierId = qStr(q, "supplierId");
  if (supplierId) filters.push(eq(paymentVouchersTable.supplierId, supplierId));
  const contractorId = qStr(q, "contractorId");
  if (contractorId) filters.push(eq(paymentVouchersTable.contractorId, contractorId));
  const payeeType = qStr(q, "payeeType");
  if (payeeType) filters.push(eq(paymentVouchersTable.payeeType, payeeType));
  const paymentMethod = qStr(q, "paymentMethod");
  if (paymentMethod) filters.push(eq(paymentVouchersTable.paymentMethod, paymentMethod));
  const status = qStr(q, "status");
  if (status) filters.push(eq(paymentVouchersTable.status, status));
  const where = and(...filters);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(paymentVouchersTable).where(where);
  const rows = await db.select().from(paymentVouchersTable).where(where).orderBy(desc(paymentVouchersTable.createdAt)).limit(pageSize).offset(offset);
  res.json(ListPaymentVouchersResponse.parse({ data: rows.map(serializeRow), total: count, page, pageSize }));
});

router.post("/payment-vouchers", requirePermission("paymentVouchers.create"), async (req, res): Promise<void> => {
  const parsed = CreatePaymentVoucherBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;
  if (validAmount(data.amount) === null) { res.status(400).json({ error: "Invalid amount" }); return; }
  const result = await db.transaction(async (tx) => {
    // PV, its own counter. A client-sent `code` is discarded.
    const code = await nextJournalNumber(tx, callerCompanyId(req), "Payment Voucher");
    const [pv] = await tx.insert(paymentVouchersTable).values({
      companyId: data.companyId, branchId: data.branchId ?? null, code, payeeType: data.payeeType,
      supplierId: data.supplierId ?? null, contractorId: data.contractorId ?? null, payeeName: data.payeeName ?? null,
      amount: data.amount, paymentDate: data.paymentDate, paymentMethod: data.paymentMethod,
      cashboxId: data.cashboxId ?? null, bankAccountId: data.bankAccountId ?? null, chequeId: data.chequeId ?? null,
      chequeNumber: data.chequeNumber ?? null, chequeDate: data.chequeDate ?? null, bankName: data.bankName ?? null,
      expenseAccountId: data.expenseAccountId ?? null, payableAccountId: data.payableAccountId ?? null,
      reference: data.reference ?? null, status: "draft", description: data.description ?? null, notes: data.notes ?? null,
      userId: req.authUser?.id ?? null,
    }).returning();
    const allocations = data.allocations?.length
      ? await tx.insert(paymentAllocationsTable).values(data.allocations.map((a) => ({
          companyId: data.companyId, paymentVoucherId: pv.id, supplierInvoiceId: a.supplierInvoiceId ?? null, amount: a.amount, notes: a.notes ?? null,
        }))).returning()
      : [];
    return { pv, allocations };
  });
  await recordAudit(req, { action: "create", entity: "paymentVoucher", entityId: result.pv.id, newValue: result.pv });
  res.status(201).json(GetPaymentVoucherResponse.parse(paymentVoucherDetail(result.pv, result.allocations)));
});

router.get("/payment-vouchers/:id", requirePermission("paymentVouchers.view"), async (req, res): Promise<void> => {
  const got = await loadPaymentVoucher(db as unknown as Tx, String(req.params.id));
  if (!got) { res.status(404).json({ error: "Not found" }); return; }
  res.json(GetPaymentVoucherResponse.parse(paymentVoucherDetail(got.pv, got.allocations)));
});

router.patch("/payment-vouchers/:id", requirePermission("paymentVouchers.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdatePaymentVoucherBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;
  if (data.amount !== undefined && validAmount(data.amount) === null) { res.status(400).json({ error: "Invalid amount" }); return; }
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(paymentVouchersTable).where(and(eq(paymentVouchersTable.id, id), eq(paymentVouchersTable.isDeleted, false))).for("update");
    if (!existing) return { notFound: true as const };
    if (existing.status !== "draft") return { conflict: "Only a draft voucher can be edited" as const };
    const { allocations: allocInput, ...rest } = data;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) patch[k] = v;
    if (Object.keys(patch).length) await tx.update(paymentVouchersTable).set(patch).where(eq(paymentVouchersTable.id, id));
    if (allocInput) {
      await tx.update(paymentAllocationsTable).set({ isDeleted: true, isActive: false }).where(eq(paymentAllocationsTable.paymentVoucherId, id));
      if (allocInput.length) {
        await tx.insert(paymentAllocationsTable).values(allocInput.map((a) => ({
          companyId: existing.companyId, paymentVoucherId: id, supplierInvoiceId: a.supplierInvoiceId ?? null, amount: a.amount, notes: a.notes ?? null,
        })));
      }
    }
    const got = await loadPaymentVoucher(tx, id);
    return { got: got! };
  });
  if ("notFound" in result) { res.status(404).json({ error: "Not found" }); return; }
  if ("conflict" in result) { res.status(409).json({ error: result.conflict }); return; }
  await recordAudit(req, { action: "update", entity: "paymentVoucher", entityId: id, newValue: result.got.pv });
  res.json(GetPaymentVoucherResponse.parse(paymentVoucherDetail(result.got.pv, result.got.allocations)));
});

router.delete("/payment-vouchers/:id", requirePermission("paymentVouchers.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(paymentVouchersTable).where(and(eq(paymentVouchersTable.id, id), eq(paymentVouchersTable.isDeleted, false))).for("update");
    if (!existing) return { notFound: true as const };
    if (existing.status !== "draft" && existing.status !== "cancelled") return { conflict: "Only a draft voucher can be deleted; reverse a posted voucher instead" as const };
    await tx.update(paymentVouchersTable).set({ isDeleted: true, isActive: false }).where(eq(paymentVouchersTable.id, id));
    return { existing };
  });
  if ("notFound" in result) { res.status(404).json({ error: "Not found" }); return; }
  if ("conflict" in result) { res.status(409).json({ error: result.conflict }); return; }
  await recordAudit(req, { action: "delete", entity: "paymentVoucher", entityId: id, oldValue: result.existing });
  res.json({ success: true });
});

router.post("/payment-vouchers/:id/approve", requirePermission("paymentVouchers.approve"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const result = await db.transaction(async (tx) => {
    const [pv] = await tx.select().from(paymentVouchersTable).where(and(eq(paymentVouchersTable.id, id), eq(paymentVouchersTable.isDeleted, false))).for("update");
    if (!pv) return { notFound: true as const };
    if (pv.status !== "draft") return { conflict: "Only a draft voucher can be approved" as const };
    await tx.update(paymentVouchersTable).set({ status: "approved", approvedAt: new Date(), approvedBy: req.authUser?.id ?? null }).where(eq(paymentVouchersTable.id, id));
    const got = await loadPaymentVoucher(tx, id);
    return { got: got! };
  });
  if ("notFound" in result) { res.status(404).json({ error: "Not found" }); return; }
  if ("conflict" in result) { res.status(409).json({ error: result.conflict }); return; }
  await recordAudit(req, { action: "approve", entity: "paymentVoucher", entityId: id, newValue: result.got.pv });
  res.json(GetPaymentVoucherResponse.parse(paymentVoucherDetail(result.got.pv, result.got.allocations)));
});

router.post("/payment-vouchers/:id/post", requirePermission("paymentVouchers.post"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  try {
    const result = await db.transaction(async (tx) => {
      const [pv] = await tx.select().from(paymentVouchersTable).where(and(eq(paymentVouchersTable.id, id), eq(paymentVouchersTable.isDeleted, false))).for("update");
      if (!pv) return { notFound: true as const };
      if (pv.status !== "approved") return { conflict: "Only an approved voucher can be posted" as const };
      const amount = amountOrThrow(pv.amount);
      const eventKey = PAYMENT_EVENT[pv.paymentMethod] ?? "payment.bank";
      const payMap = await getCompanyMapping(tx, pv.companyId, eventKey);
      // Credit (cash/bank out) account.
      const creditId = payMap?.creditAccountId ?? null;
      if (!creditId) throw new PostingError(409, "No cash/bank account configured for this payment method");
      // Debit account: explicit expense, else payee's payable control, else mapping default.
      let payablePay: string | null = null;
      if (pv.payeeType === "supplier" && pv.supplierId) {
        const [s] = await tx.select({ pay: suppliersTable.payableAccountId }).from(suppliersTable).where(eq(suppliersTable.id, pv.supplierId));
        payablePay = s?.pay ?? null;
      } else if (pv.payeeType === "contractor" && pv.contractorId) {
        const [c] = await tx.select({ pay: contractorsTable.payableAccountId }).from(contractorsTable).where(eq(contractorsTable.id, pv.contractorId));
        payablePay = c?.pay ?? null;
      }
      const debitId = pv.expenseAccountId ?? pv.payableAccountId ?? payablePay ?? payMap?.debitAccountId ?? null;
      if (!debitId) throw new PostingError(409, "No expense/payable account configured for this voucher");

      // Apply cash/bank balance + transaction.
      if (pv.paymentMethod === "cash" && pv.cashboxId) {
        await tx.insert(treasuryTransactionsTable).values({
          companyId: pv.companyId, cashboxId: pv.cashboxId, type: "out", amount,
          transactionDate: pv.paymentDate, reference: pv.code, description: "Payment voucher",
          paymentVoucherId: pv.id, userId: req.authUser?.id ?? null,
        });
        await tx.update(cashboxesTable).set({ currentBalance: sql`${cashboxesTable.currentBalance} - ${amount}::numeric` }).where(eq(cashboxesTable.id, pv.cashboxId));
      } else if (pv.paymentMethod === "bank_transfer" && pv.bankAccountId) {
        await tx.insert(bankTransactionsTable).values({
          companyId: pv.companyId, bankAccountId: pv.bankAccountId, type: "out", amount,
          transactionDate: pv.paymentDate, reference: pv.code, description: "Payment voucher",
          paymentVoucherId: pv.id, userId: req.authUser?.id ?? null,
        });
        await tx.update(bankAccountsTable).set({ currentBalance: sql`${bankAccountsTable.currentBalance} - ${amount}::numeric` }).where(eq(bankAccountsTable.id, pv.bankAccountId));
      }

      const je = await postAutomaticLines(tx, {
        companyId: pv.companyId, branchId: pv.branchId, entryDate: pv.paymentDate,
        description: `Payment voucher ${pv.code}`, reference: pv.code,
        sourceType: "paymentVoucher", sourceId: pv.id, userId: req.authUser?.id ?? null,
        lines: [
          { accountId: debitId, debit: amount, credit: "0", description: pv.description ?? `Payment ${pv.code}` },
          { accountId: creditId, debit: "0", credit: amount, description: `Payment ${pv.code}` },
        ],
      });

      // Settle allocated supplier invoices.
      const allocs = await tx.select().from(paymentAllocationsTable).where(and(eq(paymentAllocationsTable.paymentVoucherId, id), eq(paymentAllocationsTable.isDeleted, false)));
      for (const a of allocs) {
        if (!a.supplierInvoiceId) continue;
        const aAmt = amountOrThrow(a.amount);
        await tx.update(supplierInvoicesTable).set({
          paidAmount: sql`${supplierInvoicesTable.paidAmount} + ${aAmt}::numeric`,
          status: sql`CASE
            WHEN ${supplierInvoicesTable.paidAmount} + ${aAmt}::numeric >= ${supplierInvoicesTable.total} THEN 'paid'
            WHEN ${supplierInvoicesTable.paidAmount} + ${aAmt}::numeric > 0 THEN 'partially_paid'
            ELSE ${supplierInvoicesTable.status} END`,
        }).where(and(eq(supplierInvoicesTable.id, a.supplierInvoiceId), eq(supplierInvoicesTable.isDeleted, false)));
      }

      await tx.update(paymentVouchersTable).set({ status: "posted", postedAt: new Date(), postedBy: req.authUser?.id ?? null, journalEntryId: je.id }).where(eq(paymentVouchersTable.id, id));
      const got = await loadPaymentVoucher(tx, id);
      return { got: got! };
    });
    if ("notFound" in result) { res.status(404).json({ error: "Not found" }); return; }
    if ("conflict" in result) { res.status(409).json({ error: result.conflict }); return; }
    await recordAudit(req, { action: "post", entity: "paymentVoucher", entityId: id, newValue: result.got.pv });
    res.json(GetPaymentVoucherResponse.parse(paymentVoucherDetail(result.got.pv, result.got.allocations)));
  } catch (e) {
    if (e instanceof PostingError) { res.status(e.status).json({ error: e.message }); return; }
    throw e;
  }
});

router.post("/payment-vouchers/:id/reverse", requirePermission("paymentVouchers.reverse"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  try {
    const result = await db.transaction(async (tx) => {
      const [pv] = await tx.select().from(paymentVouchersTable).where(and(eq(paymentVouchersTable.id, id), eq(paymentVouchersTable.isDeleted, false))).for("update");
      if (!pv) return { notFound: true as const };
      if (pv.status !== "posted") return { conflict: "Only a posted voucher can be reversed" as const };
      const amount = amountOrThrow(pv.amount);
      // Revert allocated supplier invoices.
      const allocs = await tx.select().from(paymentAllocationsTable).where(and(eq(paymentAllocationsTable.paymentVoucherId, id), eq(paymentAllocationsTable.isDeleted, false)));
      for (const a of allocs) {
        if (!a.supplierInvoiceId) continue;
        const aAmt = amountOrThrow(a.amount);
        await tx.update(supplierInvoicesTable).set({
          paidAmount: sql`GREATEST(${supplierInvoicesTable.paidAmount} - ${aAmt}::numeric, 0)`,
          status: sql`CASE
            WHEN ${supplierInvoicesTable.paidAmount} - ${aAmt}::numeric >= ${supplierInvoicesTable.total} THEN 'paid'
            WHEN ${supplierInvoicesTable.paidAmount} - ${aAmt}::numeric > 0 THEN 'partially_paid'
            ELSE 'posted' END`,
        }).where(and(eq(supplierInvoicesTable.id, a.supplierInvoiceId), eq(supplierInvoicesTable.isDeleted, false)));
      }
      // Revert cash/bank balance + soft-delete its transaction.
      if (pv.paymentMethod === "cash" && pv.cashboxId) {
        await tx.update(cashboxesTable).set({ currentBalance: sql`${cashboxesTable.currentBalance} + ${amount}::numeric` }).where(eq(cashboxesTable.id, pv.cashboxId));
        await tx.update(treasuryTransactionsTable).set({ isDeleted: true, isActive: false }).where(and(eq(treasuryTransactionsTable.paymentVoucherId, pv.id), eq(treasuryTransactionsTable.isDeleted, false)));
      } else if (pv.paymentMethod === "bank_transfer" && pv.bankAccountId) {
        await tx.update(bankAccountsTable).set({ currentBalance: sql`${bankAccountsTable.currentBalance} + ${amount}::numeric` }).where(eq(bankAccountsTable.id, pv.bankAccountId));
        await tx.update(bankTransactionsTable).set({ isDeleted: true, isActive: false }).where(and(eq(bankTransactionsTable.paymentVoucherId, pv.id), eq(bankTransactionsTable.isDeleted, false)));
      }
      await reverseAutomaticEntriesForSource(tx, "paymentVoucher", pv.id, req.authUser?.id ?? null);
      await tx.update(paymentVouchersTable).set({ status: "reversed", reversedAt: new Date(), reversedBy: req.authUser?.id ?? null }).where(eq(paymentVouchersTable.id, id));
      const got = await loadPaymentVoucher(tx, id);
      return { got: got! };
    });
    if ("notFound" in result) { res.status(404).json({ error: "Not found" }); return; }
    if ("conflict" in result) { res.status(409).json({ error: result.conflict }); return; }
    await recordAudit(req, { action: "reverse", entity: "paymentVoucher", entityId: id, newValue: result.got.pv });
    res.json(GetPaymentVoucherResponse.parse(paymentVoucherDetail(result.got.pv, result.got.allocations)));
  } catch (e) {
    if (e instanceof PostingError) { res.status(e.status).json({ error: e.message }); return; }
    throw e;
  }
});

router.post("/payment-vouchers/:id/cancel", requirePermission("paymentVouchers.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const result = await db.transaction(async (tx) => {
    const [pv] = await tx.select().from(paymentVouchersTable).where(and(eq(paymentVouchersTable.id, id), eq(paymentVouchersTable.isDeleted, false))).for("update");
    if (!pv) return { notFound: true as const };
    if (pv.status !== "draft" && pv.status !== "approved") return { conflict: "Only a draft or approved voucher can be cancelled" as const };
    await tx.update(paymentVouchersTable).set({ status: "cancelled", cancelledAt: new Date(), cancelledBy: req.authUser?.id ?? null }).where(eq(paymentVouchersTable.id, id));
    const got = await loadPaymentVoucher(tx, id);
    return { got: got! };
  });
  if ("notFound" in result) { res.status(404).json({ error: "Not found" }); return; }
  if ("conflict" in result) { res.status(409).json({ error: result.conflict }); return; }
  await recordAudit(req, { action: "cancel", entity: "paymentVoucher", entityId: id, newValue: result.got.pv });
  res.json(GetPaymentVoucherResponse.parse(paymentVoucherDetail(result.got.pv, result.got.allocations)));
});

// ===================== AR / AP aging + tax reports =====================
interface AgingBuckets { current: bigint; days30: bigint; days60: bigint; days90: bigint; days120plus: bigint }
function emptyBuckets(): AgingBuckets { return { current: 0n, days30: 0n, days60: 0n, days90: 0n, days120plus: 0n }; }
function bucketFor(b: AgingBuckets, daysOverdue: number, cents: bigint): void {
  if (daysOverdue <= 0) b.current += cents;
  else if (daysOverdue <= 30) b.days30 += cents;
  else if (daysOverdue <= 60) b.days60 += cents;
  else if (daysOverdue <= 90) b.days90 += cents;
  else b.days120plus += cents;
}
function bucketRow(partyId: string, partyName: string, b: AgingBuckets) {
  const total = b.current + b.days30 + b.days60 + b.days90 + b.days120plus;
  return {
    partyId, partyName,
    current: fromCents(b.current), days30: fromCents(b.days30), days60: fromCents(b.days60),
    days90: fromCents(b.days90), days120plus: fromCents(b.days120plus), total: fromCents(total),
  };
}
function daysBetween(asOf: string, due: string | null): number {
  if (!due) return 0;
  return Math.floor((Date.parse(asOf) - Date.parse(due)) / 86_400_000);
}

router.get("/reports/ar-aging", requirePermission("customerInvoices.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const asOf = qStr(q, "asOfDate") || new Date().toISOString().slice(0, 10);
  const filters: SQL[] = [eq(customerInvoicesTable.isDeleted, false), sql`${customerInvoicesTable.status} in ('posted','partially_paid','paid')`];
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(customerInvoicesTable.companyId, companyId));
  const customerId = qStr(q, "customerId");
  if (customerId) filters.push(eq(customerInvoicesTable.customerId, customerId));
  const invoices = await db.select().from(customerInvoicesTable).where(and(...filters));
  const custIds = Array.from(new Set(invoices.map((i) => i.customerId)));
  const custs = custIds.length ? await db.select({ id: customersTable.id, name: customersTable.fullName }).from(customersTable).where(inArray(customersTable.id, custIds)) : [];
  const nameById = new Map(custs.map((c) => [c.id, c.name]));
  const byParty = new Map<string, AgingBuckets>();
  const totals = emptyBuckets();
  for (const inv of invoices) {
    const outstanding = (toCents(inv.total) ?? 0n) - (toCents(inv.paidAmount) ?? 0n);
    if (outstanding <= 0n) continue;
    const days = daysBetween(asOf, inv.dueDate);
    if (!byParty.has(inv.customerId)) byParty.set(inv.customerId, emptyBuckets());
    bucketFor(byParty.get(inv.customerId)!, days, outstanding);
    bucketFor(totals, days, outstanding);
  }
  const rows = Array.from(byParty.entries()).map(([pid, b]) => bucketRow(pid, nameById.get(pid) ?? pid, b));
  res.json(GetArAgingResponse.parse({ rows, totals: bucketRow("", "Total", totals) }));
});

router.get("/reports/ap-aging", requirePermission("supplierInvoices.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const asOf = qStr(q, "asOfDate") || new Date().toISOString().slice(0, 10);
  const filters: SQL[] = [eq(supplierInvoicesTable.isDeleted, false), sql`${supplierInvoicesTable.status} in ('posted','partially_paid','paid')`];
  const companyId = qStr(q, "companyId");
  if (companyId) filters.push(eq(supplierInvoicesTable.companyId, companyId));
  const supplierId = qStr(q, "supplierId");
  if (supplierId) filters.push(eq(supplierInvoicesTable.supplierId, supplierId));
  const invoices = await db.select().from(supplierInvoicesTable).where(and(...filters));
  const suppIds = Array.from(new Set(invoices.map((i) => i.supplierId)));
  const supps = suppIds.length ? await db.select({ id: suppliersTable.id, name: suppliersTable.name }).from(suppliersTable).where(inArray(suppliersTable.id, suppIds)) : [];
  const nameById = new Map(supps.map((s) => [s.id, s.name]));
  const byParty = new Map<string, AgingBuckets>();
  const totals = emptyBuckets();
  for (const inv of invoices) {
    const outstanding = (toCents(inv.total) ?? 0n) - (toCents(inv.paidAmount) ?? 0n);
    if (outstanding <= 0n) continue;
    const days = daysBetween(asOf, inv.dueDate);
    if (!byParty.has(inv.supplierId)) byParty.set(inv.supplierId, emptyBuckets());
    bucketFor(byParty.get(inv.supplierId)!, days, outstanding);
    bucketFor(totals, days, outstanding);
  }
  const rows = Array.from(byParty.entries()).map(([pid, b]) => bucketRow(pid, nameById.get(pid) ?? pid, b));
  res.json(GetApAgingResponse.parse({ rows, totals: bucketRow("", "Total", totals) }));
});

router.get("/reports/tax-report", requirePermission("taxCodes.view"), async (req, res): Promise<void> => {
  const q = req.query as Record<string, unknown>;
  const companyId = qStr(q, "companyId");
  const fromDate = qStr(q, "fromDate");
  const toDate = qStr(q, "toDate");

  const tcFilters: SQL[] = [eq(taxCodesTable.isDeleted, false)];
  if (companyId) tcFilters.push(eq(taxCodesTable.companyId, companyId));
  const taxCodes = await db.select().from(taxCodesTable).where(and(...tcFilters));

  // Aggregate base + tax per tax code from posted invoice lines within the date range.
  async function aggregate(invTable: typeof customerInvoicesTable | typeof supplierInvoicesTable, lineTable: typeof customerInvoiceLinesTable | typeof supplierInvoiceLinesTable) {
    const filters: SQL[] = [eq(invTable.isDeleted, false), sql`${invTable.status} in ('posted','partially_paid','paid')`];
    if (companyId) filters.push(eq(invTable.companyId, companyId));
    if (fromDate) filters.push(sql`${invTable.invoiceDate} >= ${fromDate}`);
    if (toDate) filters.push(sql`${invTable.invoiceDate} <= ${toDate}`);
    const rows = await db
      .select({ taxCodeId: lineTable.taxCodeId, base: sql<string>`coalesce(sum(${lineTable.lineSubtotal}),0)`, tax: sql<string>`coalesce(sum(${lineTable.taxAmount}),0)` })
      .from(lineTable)
      .innerJoin(invTable, eq(lineTable.invoiceId, invTable.id))
      .where(and(...filters))
      .groupBy(lineTable.taxCodeId);
    return rows;
  }
  const arAgg = await aggregate(customerInvoicesTable, customerInvoiceLinesTable);
  const apAgg = await aggregate(supplierInvoicesTable, supplierInvoiceLinesTable);
  const aggByCode = new Map<string, { base: bigint; tax: bigint }>();
  for (const r of [...arAgg, ...apAgg]) {
    if (!r.taxCodeId) continue;
    const cur = aggByCode.get(r.taxCodeId) ?? { base: 0n, tax: 0n };
    cur.base += toCents(r.base) ?? 0n;
    cur.tax += toCents(r.tax) ?? 0n;
    aggByCode.set(r.taxCodeId, cur);
  }
  let outputTax = 0n;
  let inputTax = 0n;
  const rows = taxCodes
    .map((tc) => {
      const agg = aggByCode.get(tc.id) ?? { base: 0n, tax: 0n };
      if (tc.taxType === "input") inputTax += agg.tax; else outputTax += agg.tax;
      return { taxCodeId: tc.id, code: tc.code, name: tc.name, taxType: tc.taxType, rate: tc.rate, base: fromCents(agg.base), tax: fromCents(agg.tax) };
    })
    .filter((r) => (toCents(r.base) ?? 0n) > 0n || (toCents(r.tax) ?? 0n) > 0n);
  res.json(GetTaxReportResponse.parse({ rows, outputTax: fromCents(outputTax), inputTax: fromCents(inputTax), netTax: fromCents(outputTax - inputTax) }));
});

export default router;
