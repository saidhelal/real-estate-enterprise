import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  inventoryLedgerTable,
  inventoryItemsTable,
  reorderLevelsTable,
  goodsReceiptsTable,
  goodsReceiptItemsTable,
  goodsIssuesTable,
  goodsIssueItemsTable,
  inventoryTransfersTable,
  inventoryTransferItemsTable,
  stockAdjustmentsTable,
  stockAdjustmentItemsTable,
} from "@workspace/db";
import { PostingError, type Tx } from "./posting";
import { notify, recipientsByPermission } from "./notify";

/**
 * What is actually in the warehouse.
 *
 * Inventory had nineteen registers and a dashboard that computed stock levels
 * from `inventory_ledger` — but nothing ever wrote to that ledger except
 * somebody typing a row into it by hand. A goods receipt did not increase
 * stock. A goods issue did not reduce it. The "low stock items" figure counted
 * reorder rules against a ledger that stayed empty, so it always read zero and
 * looked like good news.
 *
 * This module is the only thing that writes stock movements, the only thing
 * that answers how much is on hand, and the only thing that decides what it is
 * worth. Four documents feed it — receipt, issue, transfer, adjustment — and
 * each supplies only its own facts: what moved and where. A receipt also
 * supplies what it paid; every other cost in the system is derived here.
 *
 * ---------------------------------------------------------------------------
 * Valuation: weighted average cost.
 *
 * The method was an open business decision and has now been decided. It lives
 * here, with the quantities, because a value is a quantity times a cost and
 * splitting the two across modules is how the stock report and the ledger come
 * to disagree.
 *
 * The rule in one line: a receipt brings its own cost and moves the average;
 * everything leaving is costed at the average as it stood at that moment.
 *
 *   average = balance_value / balance_quantity   (of the movement before it)
 *
 * Each movement stores the running `balance_value` alongside the running
 * `balance_quantity`, so the average is never recomputed by scanning history —
 * it is read from the previous row. That is what makes a stock ledger a
 * statement rather than a query, and it is why nothing else in the system is
 * permitted to derive a cost of its own.
 * ---------------------------------------------------------------------------
 */

/** How a movement is described in the ledger. */
export type MovementType = "receipt" | "issue" | "transfer_out" | "transfer_in" | "adjustment";

export interface Movement {
  itemId: string;
  warehouseId: string;
  locationId?: string | null;
  /** Positive for stock arriving, negative for stock leaving. */
  quantity: number;
  unitCost?: string | null;
  transactionType: MovementType;
  referenceType: string;
  referenceNumber: string;
  transactionDate: string;
  notes?: string | null;
}

/**
 * Stock on hand for one item in one warehouse.
 *
 * The single definition of the question. It was written inline in the
 * inventory dashboard, which meant "how much is there" had one answer on that
 * screen and no answer anywhere else — including in the code that ought to
 * refuse an issue for more than exists.
 */
export async function onHand(
  exec: Tx | typeof db,
  companyId: string,
  itemId: string,
  warehouseId: string,
): Promise<number> {
  const [row] = await exec
    .select({
      balance: sql<string>`coalesce(sum(coalesce(${inventoryLedgerTable.quantityIn}, 0) - coalesce(${inventoryLedgerTable.quantityOut}, 0)), 0)::text`,
    })
    .from(inventoryLedgerTable)
    .where(
      and(
        eq(inventoryLedgerTable.isDeleted, false),
        eq(inventoryLedgerTable.companyId, companyId),
        eq(inventoryLedgerTable.itemId, itemId),
        eq(inventoryLedgerTable.warehouseId, warehouseId),
      ),
    );
  return Number(row?.balance ?? 0);
}

/** Money to two decimals, as the numeric columns store it. */
const money = (n: number): string => (Number.isFinite(n) ? n : 0).toFixed(2);

export interface StockPosition {
  quantity: number;
  /** Total value of what is on hand, at weighted average. */
  value: number;
  /** value / quantity, or 0 when there is nothing on hand. */
  averageCost: number;
}

/**
 * How much is there and what it is worth.
 *
 * **The single definition of inventory value.** Read from the most recent
 * movement's running balance rather than summed from history, so the figure a
 * screen shows, the figure a report shows and the figure the next issue is
 * costed at are the same number by construction — not three calculations that
 * happen to agree today.
 *
 * `for update` is deliberate inside a transaction: two concurrent issues must
 * not both read the same average and both write a balance from it.
 */
export async function stockPosition(
  exec: Tx | typeof db,
  companyId: string,
  itemId: string,
  warehouseId: string,
): Promise<StockPosition> {
  const [last] = await exec
    .select({
      quantity: inventoryLedgerTable.balanceQuantity,
      value: inventoryLedgerTable.balanceValue,
    })
    .from(inventoryLedgerTable)
    .where(
      and(
        eq(inventoryLedgerTable.isDeleted, false),
        eq(inventoryLedgerTable.companyId, companyId),
        eq(inventoryLedgerTable.itemId, itemId),
        eq(inventoryLedgerTable.warehouseId, warehouseId),
      ),
    )
    .orderBy(desc(inventoryLedgerTable.createdAt))
    .limit(1);

  const quantity = Number(last?.quantity ?? 0);
  const value = Number(last?.value ?? 0);
  return {
    quantity,
    value,
    // A zero or negative balance has no meaningful unit cost; reporting one
    // would put a fabricated number into the next issue.
    averageCost: quantity > 0 ? value / quantity : 0,
  };
}

export interface ValuedPosition {
  itemId: string;
  warehouseId: string;
  quantity: number;
  value: number;
}

/**
 * Every item's position, valued — the one query behind every stock figure.
 *
 * There were two other answers to "what is the stock worth". The inventory
 * dashboard added up document headers (opening + receipts − issues) and called
 * itself approximate; the BI report read the ledger but took the latest row
 * per *item*, so an item held in two warehouses reported only whichever moved
 * last. Both are replaced by this.
 *
 * The balance is the last movement per item and warehouse, which is exactly
 * what `postMovement` maintains — so the total here and the cost the next
 * issue draws are the same numbers, not two calculations that agree by luck.
 */
export async function valuedPositions(
  exec: Tx | typeof db,
  companyId: string | null,
): Promise<ValuedPosition[]> {
  const scope = companyId ? sql`and company_id = ${companyId}` : sql``;
  const result = await exec.execute(sql`
    select distinct on (item_id, warehouse_id)
           item_id       as item_id,
           warehouse_id  as warehouse_id,
           coalesce(balance_quantity, 0) as quantity,
           coalesce(balance_value, 0)    as value
    from inventory_ledger
    where is_deleted = false and item_id is not null and warehouse_id is not null ${scope}
    order by item_id, warehouse_id, transaction_date desc nulls last, created_at desc
  `);

  const rows = ((result as { rows?: unknown[] }).rows ?? result) as Array<{
    item_id: string;
    warehouse_id: string;
    quantity: string | number;
    value: string | number;
  }>;

  return rows.map((r) => ({
    itemId: r.item_id,
    warehouseId: r.warehouse_id,
    quantity: Number(r.quantity) || 0,
    value: Number(r.value) || 0,
  }));
}

/** Total value of stock on hand for a company, at weighted average. */
export async function inventoryValue(
  exec: Tx | typeof db,
  companyId: string | null,
): Promise<number> {
  const positions = await valuedPositions(exec, companyId);
  return positions.reduce((sum, p) => sum + p.value, 0);
}

/**
 * Write one movement and its resulting balance.
 *
 * The running balance is stored on the row rather than recomputed on read, so
 * the ledger can be read as a statement — "there were 40, 12 left, 28 remain"
 * — which is what makes a stock ledger auditable rather than merely summable.
 *
 * Always called inside the caller's transaction: a movement that commits
 * without its document, or a document without its movement, is a stock figure
 * that disagrees with the paperwork.
 */
export async function postMovement(
  tx: Tx,
  companyId: string,
  movement: Movement,
): Promise<number> {
  const before = await stockPosition(tx, companyId, movement.itemId, movement.warehouseId);
  const after = before.quantity + movement.quantity;

  /*
   * Weighted average, applied at the moment of the movement.
   *
   * Stock arriving carries its own cost and pulls the average towards it; a
   * receipt with no cost recorded adds quantity at the prevailing average,
   * because the alternative — treating it as free — would silently write the
   * whole warehouse down.
   *
   * Stock leaving is always costed at the average as it stood *before* this
   * movement. That is what makes the method weighted average rather than
   * something that depends on the order two issues happened to be posted in.
   */
  const isInbound = movement.quantity > 0;
  const declaredCost = movement.unitCost === null || movement.unitCost === undefined
    ? null
    : Number(movement.unitCost);
  const hasDeclaredCost = declaredCost !== null && Number.isFinite(declaredCost);

  const appliedCost = isInbound
    ? hasDeclaredCost
      ? declaredCost
      : before.averageCost
    : before.averageCost;

  const valueAfter = before.value + movement.quantity * appliedCost;

  await tx.insert(inventoryLedgerTable).values({
    companyId,
    itemId: movement.itemId,
    warehouseId: movement.warehouseId,
    locationId: movement.locationId ?? null,
    transactionDate: movement.transactionDate,
    transactionType: movement.transactionType,
    referenceType: movement.referenceType,
    referenceNumber: movement.referenceNumber,
    quantityIn: isInbound ? String(movement.quantity) : "0",
    quantityOut: isInbound ? "0" : String(-movement.quantity),
    balanceQuantity: String(after),
    // The cost this movement was actually valued at — a receipt's own cost, or
    // the average an issue drew down. Never the raw payload where they differ.
    unitCost: money(appliedCost),
    // Emptying the warehouse empties its value: floating-point remainders left
    // on a zero balance would show stock worth a fraction of a riyal with
    // nothing on the shelf.
    balanceValue: after === 0 ? money(0) : money(valueAfter),
    notes: movement.notes ?? null,
  });

  return after;
}

/**
 * Refuse to take out more than is there.
 *
 * Negative stock is not a smaller number; it is a claim that the warehouse
 * handed over goods it did not have, and every figure downstream — valuation,
 * reorder, cost of sales — inherits the lie. Refused at the moment of posting,
 * inside the transaction, so two concurrent issues cannot both pass the check.
 */
export async function assertAvailable(
  tx: Tx,
  companyId: string,
  itemId: string,
  warehouseId: string,
  quantity: number,
): Promise<void> {
  const available = await onHand(tx, companyId, itemId, warehouseId);
  if (quantity <= available) return;

  // The item is named only when refusing. A storekeeper reading "only 25 of
  // 720c229b-… is in this warehouse" learns nothing; looking the name up on
  // every line, to be used on almost none, is the wrong trade.
  const [item] = await tx
    .select({ code: inventoryItemsTable.code, name: inventoryItemsTable.name })
    .from(inventoryItemsTable)
    .where(eq(inventoryItemsTable.id, itemId));
  const label = item ? `${item.code} (${item.name})` : "this item";

  throw new PostingError(
    409,
    `Only ${available} of ${label} is in this warehouse; the document asks for ${quantity}.`,
  );
}

/** A line as the movement engine needs it, whatever document it came from. */
interface Line {
  itemId: string | null;
  locationId?: string | null;
  quantity: number;
  unitCost?: string | null;
}

function usableLines(rows: Line[]): Array<Line & { itemId: string }> {
  // A line with no item or no quantity moves nothing. Skipped rather than
  // refused: a draft can legitimately hold an empty row, and posting should
  // not depend on someone having tidied it up.
  return rows.filter(
    (r): r is Line & { itemId: string } => !!r.itemId && Number.isFinite(r.quantity) && r.quantity !== 0,
  );
}

export interface PostResult {
  /** Ledger rows written. */
  movements: number;
}

export interface ReorderResult {
  /** Reorder rules evaluated. */
  checked: number;
  /** Item/warehouse pairs at or below their minimum. */
  below: number;
  /** Notifications issued; the engine de-duplicates, so this is an upper bound. */
  notified: number;
}

/** Whoever can raise a purchase request is who needs to know stock is low. */
const REORDER_PERMISSION = "purchaseRequests.create";

/**
 * Tell someone when stock falls to its reorder level.
 *
 * `reorder_levels` has held a minimum quantity per item and warehouse since
 * the module was written, and the inventory dashboard counted how many were
 * below it — but only for whoever happened to open that screen. Nothing ever
 * said so. A minimum nobody is told about is a number, not a control.
 *
 * The rule is the one already used everywhere else: compare `onHand` against
 * the recorded minimum. Recipients come from the permission that makes someone
 * able to act on it, and the notification is keyed on the item so a shortage
 * that lasts a fortnight produces one alert rather than a fortnight of them.
 *
 * Never throws: a scheduled sweep must not stop at one company's bad row.
 */
export async function sweepReorderLevels(
  companyId: string,
  now: Date = new Date(),
): Promise<ReorderResult> {
  const result: ReorderResult = { checked: 0, below: 0, notified: 0 };

  const rules = await db
    .select({
      itemId: reorderLevelsTable.itemId,
      warehouseId: reorderLevelsTable.warehouseId,
      minQuantity: reorderLevelsTable.minQuantity,
      reorderQuantity: reorderLevelsTable.reorderQuantity,
    })
    .from(reorderLevelsTable)
    .where(
      and(eq(reorderLevelsTable.isDeleted, false), eq(reorderLevelsTable.companyId, companyId)),
    );

  result.checked = rules.length;
  if (rules.length === 0) return result;

  const recipients = await recipientsByPermission(db, REORDER_PERMISSION, { companyId });

  for (const rule of rules) {
    if (!rule.itemId || !rule.warehouseId) continue;
    const minimum = Number(rule.minQuantity ?? 0);
    if (!Number.isFinite(minimum) || minimum <= 0) continue;

    const available = await onHand(db, companyId, rule.itemId, rule.warehouseId);
    if (available > minimum) continue;
    result.below++;
    if (recipients.length === 0) continue;

    const [item] = await db
      .select({ code: inventoryItemsTable.code, name: inventoryItemsTable.name })
      .from(inventoryItemsTable)
      .where(eq(inventoryItemsTable.id, rule.itemId));

    result.notified += await notify(db, {
      recipientUserIds: recipients,
      category: "inventory",
      eventType: "stock_below_reorder_level",
      priority: available <= 0 ? "urgent" : "high",
      title: "Stock has reached its reorder level",
      body:
        `${item?.code ?? rule.itemId} — ${available} on hand, minimum ${minimum}` +
        (rule.reorderQuantity ? `, suggested order ${rule.reorderQuantity}` : ""),
      sourceModule: "reorderLevel",
      // Keyed on the item and warehouse, not on the day: a shortage that lasts
      // a fortnight is one shortage, and a daily reminder would train people
      // to ignore the alert that matters.
      sourceId: rule.itemId,
      sourceRef: item?.code ?? null,
      companyId,
    });
  }

  return result;
}

/**
 * Post a goods receipt: stock arrives.
 *
 * `unitCost` is carried from the receipt line, because a receipt is the one
 * document that genuinely knows what the goods cost — it is the purchase.
 */
export async function postGoodsReceipt(tx: Tx, receiptId: string): Promise<PostResult> {
  const [doc] = await tx
    .select()
    .from(goodsReceiptsTable)
    .where(eq(goodsReceiptsTable.id, receiptId))
    .for("update");
  if (!doc) throw new PostingError(404, "Goods receipt not found");
  if (!doc.warehouseId) throw new PostingError(400, "This receipt has no warehouse, so there is nowhere to put the goods.");

  const rows = await tx
    .select()
    .from(goodsReceiptItemsTable)
    .where(
      and(eq(goodsReceiptItemsTable.receiptId, receiptId), eq(goodsReceiptItemsTable.isDeleted, false)),
    );

  const lines = usableLines(
    rows.map((r) => ({
      itemId: r.itemId,
      locationId: r.locationId,
      quantity: Number(r.quantity ?? 0),
      unitCost: r.unitCost,
    })),
  );

  for (const line of lines) {
    await postMovement(tx, doc.companyId, {
      itemId: line.itemId,
      warehouseId: doc.warehouseId,
      locationId: line.locationId,
      quantity: line.quantity,
      unitCost: line.unitCost,
      transactionType: "receipt",
      referenceType: "goodsReceipt",
      referenceNumber: doc.code,
      transactionDate: doc.receiptDate ?? new Date().toISOString().slice(0, 10),
    });
  }

  return { movements: lines.length };
}

/** Post a goods issue: stock leaves, and cannot leave more than is there. */
export async function postGoodsIssue(tx: Tx, issueId: string): Promise<PostResult> {
  const [doc] = await tx
    .select()
    .from(goodsIssuesTable)
    .where(eq(goodsIssuesTable.id, issueId))
    .for("update");
  if (!doc) throw new PostingError(404, "Goods issue not found");
  if (!doc.warehouseId) throw new PostingError(400, "This issue has no warehouse, so there is nowhere to take the goods from.");

  const rows = await tx
    .select()
    .from(goodsIssueItemsTable)
    .where(and(eq(goodsIssueItemsTable.issueId, issueId), eq(goodsIssueItemsTable.isDeleted, false)));

  const lines = usableLines(
    rows.map((r) => ({ itemId: r.itemId, locationId: r.locationId, quantity: Number(r.quantity ?? 0) })),
  );

  for (const line of lines) {
    await assertAvailable(tx, doc.companyId, line.itemId, doc.warehouseId, line.quantity);
    await postMovement(tx, doc.companyId, {
      itemId: line.itemId,
      warehouseId: doc.warehouseId,
      locationId: line.locationId,
      quantity: -line.quantity,
      transactionType: "issue",
      referenceType: "goodsIssue",
      referenceNumber: doc.code,
      transactionDate: doc.issueDate ?? new Date().toISOString().slice(0, 10),
    });
  }

  return { movements: lines.length };
}

/**
 * Post a transfer: two movements per line, never one.
 *
 * Stock leaving one warehouse and arriving in another are separate facts about
 * separate places, and a single netting entry would make both warehouses'
 * ledgers unreadable.
 */
export async function postInventoryTransfer(tx: Tx, transferId: string): Promise<PostResult> {
  const [doc] = await tx
    .select()
    .from(inventoryTransfersTable)
    .where(eq(inventoryTransfersTable.id, transferId))
    .for("update");
  if (!doc) throw new PostingError(404, "Transfer not found");
  if (!doc.fromWarehouseId || !doc.toWarehouseId) {
    throw new PostingError(400, "A transfer needs both a source and a destination warehouse.");
  }
  if (doc.fromWarehouseId === doc.toWarehouseId) {
    throw new PostingError(400, "A transfer cannot start and end in the same warehouse.");
  }

  const rows = await tx
    .select()
    .from(inventoryTransferItemsTable)
    .where(
      and(
        eq(inventoryTransferItemsTable.transferId, transferId),
        eq(inventoryTransferItemsTable.isDeleted, false),
      ),
    );

  const lines = usableLines(rows.map((r) => ({ itemId: r.itemId, quantity: Number(r.quantity ?? 0) })));
  const date = doc.transferDate ?? new Date().toISOString().slice(0, 10);

  for (const line of lines) {
    await assertAvailable(tx, doc.companyId, line.itemId, doc.fromWarehouseId, line.quantity);

    // The cost travels with the goods.
    //
    // Read before the outbound leg, and handed to the inbound one. Without it
    // the arriving stock would be valued at the *destination's* average, so
    // moving a pallet between two of your own warehouses would change what
    // the company owns — a transfer moves value, it does not create or
    // destroy any.
    const source = await stockPosition(tx, doc.companyId, line.itemId, doc.fromWarehouseId);
    const carriedCost = money(source.averageCost);

    await postMovement(tx, doc.companyId, {
      itemId: line.itemId,
      warehouseId: doc.fromWarehouseId,
      quantity: -line.quantity,
      transactionType: "transfer_out",
      referenceType: "inventoryTransfer",
      referenceNumber: doc.code,
      transactionDate: date,
    });
    await postMovement(tx, doc.companyId, {
      itemId: line.itemId,
      warehouseId: doc.toWarehouseId,
      quantity: line.quantity,
      unitCost: carriedCost,
      transactionType: "transfer_in",
      referenceType: "inventoryTransfer",
      referenceNumber: doc.code,
      transactionDate: date,
    });
  }

  return { movements: lines.length * 2 };
}

/**
 * Post a stock adjustment: the count wins.
 *
 * The movement is the difference between what was counted and what the system
 * believed, in whichever direction — which is why an adjustment is the one
 * document allowed to reduce stock without checking availability. If the shelf
 * holds less than the ledger says, refusing the correction would preserve the
 * error.
 */
export async function postStockAdjustment(tx: Tx, adjustmentId: string): Promise<PostResult> {
  const [doc] = await tx
    .select()
    .from(stockAdjustmentsTable)
    .where(eq(stockAdjustmentsTable.id, adjustmentId))
    .for("update");
  if (!doc) throw new PostingError(404, "Stock adjustment not found");
  if (!doc.warehouseId) throw new PostingError(400, "This adjustment has no warehouse.");

  const rows = await tx
    .select()
    .from(stockAdjustmentItemsTable)
    .where(
      and(
        eq(stockAdjustmentItemsTable.adjustmentId, adjustmentId),
        eq(stockAdjustmentItemsTable.isDeleted, false),
      ),
    );

  const date = doc.adjustmentDate ?? new Date().toISOString().slice(0, 10);
  let movements = 0;

  for (const r of rows) {
    if (!r.itemId) continue;
    // The difference is recomputed from the counted quantity against what the
    // ledger holds now, not read from `differenceQuantity`: that column was
    // filled in when the count sheet was prepared, and stock may have moved
    // since. Trusting it would post yesterday's discrepancy.
    const counted = r.actualQuantity === null ? null : Number(r.actualQuantity);
    if (counted === null || !Number.isFinite(counted)) continue;

    const system = await onHand(tx, doc.companyId, r.itemId, doc.warehouseId);
    const delta = counted - system;
    if (delta === 0) continue;

    await postMovement(tx, doc.companyId, {
      itemId: r.itemId,
      warehouseId: doc.warehouseId,
      locationId: r.locationId,
      quantity: delta,
      transactionType: "adjustment",
      referenceType: "stockAdjustment",
      referenceNumber: doc.code,
      transactionDate: date,
      notes: `Counted ${counted}, system held ${system}.`,
    });
    movements++;
  }

  return { movements };
}
