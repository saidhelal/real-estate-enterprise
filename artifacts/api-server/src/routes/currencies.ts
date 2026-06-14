import { Router, type IRouter } from "express";
import { and, eq, ne, desc } from "drizzle-orm";
import { db, currenciesTable, exchangeRatesTable } from "@workspace/db";
import {
  ListCurrenciesResponse,
  CreateCurrencyBody,
  UpdateCurrencyBody,
  ListExchangeRatesResponse,
  CreateExchangeRateBody,
} from "@workspace/api-zod";
import { toCurrency, toExchangeRate } from "../lib/presenters";
import { recordAudit } from "../lib/audit";
import { requireAuth, requirePermission } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

router.get("/currencies", requirePermission("currencies.view"), async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(currenciesTable)
    .where(eq(currenciesTable.isDeleted, false))
    .orderBy(currenciesTable.code);
  res.json(ListCurrenciesResponse.parse(rows.map(toCurrency)));
});

router.post("/currencies", requirePermission("currencies.create"), async (req, res): Promise<void> => {
  const parsed = CreateCurrencyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db
    .select({ id: currenciesTable.id })
    .from(currenciesTable)
    .where(and(eq(currenciesTable.code, parsed.data.code), eq(currenciesTable.isDeleted, false)));
  if (existing) {
    res.status(409).json({ error: "Currency code already exists" });
    return;
  }
  const isBase = parsed.data.isBase ?? false;
  if (isBase) {
    await db.update(currenciesTable).set({ isBase: false });
  }
  const [row] = await db
    .insert(currenciesTable)
    .values({
      code: parsed.data.code,
      name: parsed.data.name,
      symbol: parsed.data.symbol,
      isBase,
    })
    .returning();
  await recordAudit(req, { action: "create", entity: "currency", entityId: row.id, newValue: row });
  res.status(201).json(toCurrency(row));
});

router.patch("/currencies/:id", requirePermission("currencies.update"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const parsed = UpdateCurrencyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(currenciesTable)
    .where(and(eq(currenciesTable.id, id), eq(currenciesTable.isDeleted, false)));
  if (!existing) {
    res.status(404).json({ error: "Currency not found" });
    return;
  }
  if (parsed.data.isBase) {
    await db.update(currenciesTable).set({ isBase: false }).where(ne(currenciesTable.id, id));
  }
  const update: Record<string, unknown> = {};
  for (const key of ["name", "symbol", "isBase"] as const) {
    if (parsed.data[key] !== undefined) update[key] = parsed.data[key];
  }
  const [row] = Object.keys(update).length
    ? await db.update(currenciesTable).set(update).where(eq(currenciesTable.id, id)).returning()
    : [existing];
  await recordAudit(req, {
    action: "update",
    entity: "currency",
    entityId: id,
    oldValue: existing,
    newValue: row,
  });
  res.json(toCurrency(row));
});

router.delete("/currencies/:id", requirePermission("currencies.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db
    .update(currenciesTable)
    .set({ isDeleted: true, isActive: false })
    .where(and(eq(currenciesTable.id, id), eq(currenciesTable.isDeleted, false)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Currency not found" });
    return;
  }
  await recordAudit(req, { action: "delete", entity: "currency", entityId: id });
  res.json({ success: true });
});

router.get("/exchange-rates", requirePermission("currencies.view"), async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(exchangeRatesTable)
    .orderBy(desc(exchangeRatesTable.rateDate));
  res.json(ListExchangeRatesResponse.parse(rows.map(toExchangeRate)));
});

router.post("/exchange-rates", requirePermission("currencies.create"), async (req, res): Promise<void> => {
  const parsed = CreateExchangeRateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(exchangeRatesTable)
    .values({
      fromCurrency: parsed.data.fromCurrency,
      toCurrency: parsed.data.toCurrency,
      rate: parsed.data.rate,
      rateDate: parsed.data.rateDate,
    })
    .returning();
  await recordAudit(req, { action: "create", entity: "exchangeRate", entityId: row.id, newValue: row });
  res.status(201).json(toExchangeRate(row));
});

router.delete("/exchange-rates/:id", requirePermission("currencies.delete"), async (req, res): Promise<void> => {
  const id = String(req.params.id);
  const [row] = await db
    .delete(exchangeRatesTable)
    .where(eq(exchangeRatesTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Exchange rate not found" });
    return;
  }
  await recordAudit(req, { action: "delete", entity: "exchangeRate", entityId: id });
  res.json({ success: true });
});

export default router;
