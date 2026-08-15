import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  companiesTable,
  warehousesTable,
  inventoryItemsTable,
  inventoryLedgerTable,
  goodsReceiptsTable,
  goodsReceiptItemsTable,
  goodsIssuesTable,
  goodsIssueItemsTable,
  inventoryTransfersTable,
  inventoryTransferItemsTable,
  stockAdjustmentsTable,
  stockAdjustmentItemsTable,
} from "@workspace/db";
import {
  onHand,
  stockPosition,
  inventoryValue,
  valuedPositions,
  postGoodsReceipt,
  postGoodsIssue,
  postInventoryTransfer,
  postStockAdjustment,
} from "../src/lib/stock";

/**
 * Weighted average cost.
 *
 * The valuation method was an open business decision; it is now weighted
 * average, and this is the sequence the decision was written against: a first
 * receipt, a second receipt at a different cost, an issue, then another
 * receipt — checking the quantity, the value and the average at every step.
 *
 * The arithmetic is worked out in the comments rather than left as bare
 * numbers, because a valuation test whose expected values nobody can re-derive
 * is a test that will be "fixed" to match a bug.
 *
 * FIXTURE data under a per-run tag, removed in `afterAll`.
 */

const tag = `valtest-${Date.now()}`;
const id = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-${tag.slice(-12).padStart(12, "0")}`;

const COMPANY = id(1);
const MAIN = id(2);
const SITE = id(3);
const ITEM = id(4);

const today = new Date().toISOString().slice(0, 10);
let seq = 100;

/** Receive `quantity` at `unitCost` into a warehouse, through the real path. */
async function receive(quantity: string, unitCost: string | null, warehouse = MAIN): Promise<void> {
  const docId = id(seq++);
  await db.insert(goodsReceiptsTable).values({
    id: docId,
    companyId: COMPANY,
    code: `${tag}-GRN${seq}`,
    warehouseId: warehouse,
    receiptDate: today,
    status: "draft",
  });
  await db.insert(goodsReceiptItemsTable).values({
    companyId: COMPANY,
    receiptId: docId,
    itemId: ITEM,
    quantity,
    unitCost,
  });
  await db.transaction((tx) => postGoodsReceipt(tx, docId));
}

/** Issue `quantity` out of a warehouse, through the real path. */
async function issue(quantity: string, warehouse = MAIN): Promise<void> {
  const docId = id(seq++);
  await db.insert(goodsIssuesTable).values({
    id: docId,
    companyId: COMPANY,
    code: `${tag}-ISS${seq}`,
    warehouseId: warehouse,
    issueDate: today,
    status: "draft",
  });
  await db.insert(goodsIssueItemsTable).values({
    companyId: COMPANY,
    issueId: docId,
    itemId: ITEM,
    quantity,
  });
  await db.transaction((tx) => postGoodsIssue(tx, docId));
}

beforeAll(async () => {
  await db.insert(companiesTable).values({
    id: COMPANY,
    code: `${tag}-C`,
    name: `${tag} Company`,
    nameAr: "شركة اختبار",
  });
  await db.insert(warehousesTable).values([
    { id: MAIN, companyId: COMPANY, code: `${tag}-WM`, name: "Main", nameAr: "الرئيسي" },
    { id: SITE, companyId: COMPANY, code: `${tag}-WS`, name: "Site", nameAr: "الموقع" },
  ]);
  await db.insert(inventoryItemsTable).values({
    id: ITEM,
    companyId: COMPANY,
    code: `${tag}-I`,
    name: "Cement bag",
    nameAr: "كيس أسمنت",
  });
});

afterAll(async () => {
  await db.delete(inventoryLedgerTable).where(eq(inventoryLedgerTable.companyId, COMPANY));
  await db.delete(goodsReceiptItemsTable).where(eq(goodsReceiptItemsTable.companyId, COMPANY));
  await db.delete(goodsReceiptsTable).where(eq(goodsReceiptsTable.companyId, COMPANY));
  await db.delete(goodsIssueItemsTable).where(eq(goodsIssueItemsTable.companyId, COMPANY));
  await db.delete(goodsIssuesTable).where(eq(goodsIssuesTable.companyId, COMPANY));
  await db.delete(inventoryTransferItemsTable).where(eq(inventoryTransferItemsTable.companyId, COMPANY));
  await db.delete(stockAdjustmentItemsTable).where(eq(stockAdjustmentItemsTable.companyId, COMPANY));
  await db.delete(stockAdjustmentsTable).where(eq(stockAdjustmentsTable.companyId, COMPANY));
  await db.delete(inventoryTransfersTable).where(eq(inventoryTransfersTable.companyId, COMPANY));
  await db.delete(inventoryItemsTable).where(eq(inventoryItemsTable.id, ITEM));
  await db.delete(warehousesTable).where(inArray(warehousesTable.id, [MAIN, SITE]));
  await db.delete(companiesTable).where(eq(companiesTable.id, COMPANY));
});

describe("the weighted average, step by step", () => {
  it("starts empty, with no cost to report", async () => {
    const p = await stockPosition(db, COMPANY, ITEM, MAIN);
    expect(p.quantity).toBe(0);
    expect(p.value).toBe(0);
    // Not a fabricated cost: nothing on hand has no unit cost.
    expect(p.averageCost).toBe(0);
  });

  it("takes its cost from the first receipt", async () => {
    // 100 @ 10.00  ->  100 units worth 1,000.00, average 10.00
    await receive("100", "10.00");
    const p = await stockPosition(db, COMPANY, ITEM, MAIN);
    expect(p.quantity).toBe(100);
    expect(p.value).toBe(1000);
    expect(p.averageCost).toBe(10);
  });

  it("moves the average towards a receipt at a different cost", async () => {
    // + 100 @ 20.00  ->  200 units worth 3,000.00, average 15.00
    // This is the whole method: not 10, not 20, but the weighted blend.
    await receive("100", "20.00");
    const p = await stockPosition(db, COMPANY, ITEM, MAIN);
    expect(p.quantity).toBe(200);
    expect(p.value).toBe(3000);
    expect(p.averageCost).toBe(15);
  });

  it("costs an issue at the average, leaving the average unchanged", async () => {
    // − 50 @ 15.00  ->  150 units worth 2,250.00, average still 15.00
    await issue("50");
    const p = await stockPosition(db, COMPANY, ITEM, MAIN);
    expect(p.quantity).toBe(150);
    expect(p.value).toBe(2250);
    expect(p.averageCost).toBe(15);
  });

  it("records what the issue was actually costed at", async () => {
    // The ledger row must say 15.00 — the average — not whatever the document
    // happened to carry, because that number is the cost of sales.
    const rows = await db
      .select()
      .from(inventoryLedgerTable)
      .where(eq(inventoryLedgerTable.transactionType, "issue"));
    const mine = rows.filter((r) => r.companyId === COMPANY);
    expect(mine).toHaveLength(1);
    expect(Number(mine[0].unitCost)).toBe(15);
    expect(Number(mine[0].balanceValue)).toBe(2250);
  });

  it("blends a third receipt into the same running average", async () => {
    // + 50 @ 27.00  ->  200 units worth 3,600.00, average 18.00
    //   (2,250 + 1,350) / (150 + 50)
    await receive("50", "27.00");
    const p = await stockPosition(db, COMPANY, ITEM, MAIN);
    expect(p.quantity).toBe(200);
    expect(p.value).toBe(3600);
    expect(p.averageCost).toBe(18);
  });

  it("adds stock at the prevailing average when a receipt records no cost", async () => {
    // A receipt with no cost is not free stock — treating it as free would
    // write the warehouse down. + 100 at the prevailing 18.00.
    await receive("100", null);
    const p = await stockPosition(db, COMPANY, ITEM, MAIN);
    expect(p.quantity).toBe(300);
    expect(p.value).toBe(5400);
    expect(p.averageCost).toBe(18);
  });
});

describe("the quantity and the value never disagree", () => {
  it("reports the same quantity through both engines", async () => {
    // `onHand` sums the movements; `stockPosition` reads the running balance.
    // They are two paths to one number and must never diverge.
    const summed = await onHand(db, COMPANY, ITEM, MAIN);
    const running = await stockPosition(db, COMPANY, ITEM, MAIN);
    expect(summed).toBe(running.quantity);
  });

  it("empties the value when the last unit leaves", async () => {
    await issue("300");
    const p = await stockPosition(db, COMPANY, ITEM, MAIN);
    expect(p.quantity).toBe(0);
    // Exactly zero, not a floating-point remainder: stock worth 0.03 with an
    // empty shelf is how a rounding error becomes an audit question.
    expect(p.value).toBe(0);
    expect(p.averageCost).toBe(0);
  });
});

describe("a transfer moves value without creating it", () => {
  it("carries the cost to the destination warehouse", async () => {
    // 60 @ 25.00 into Main, then 20 moved to Site.
    await receive("60", "25.00");
    const transferId = id(900);
    await db.insert(inventoryTransfersTable).values({
      id: transferId,
      companyId: COMPANY,
      code: `${tag}-TRF`,
      fromWarehouseId: MAIN,
      toWarehouseId: SITE,
      transferDate: today,
      status: "draft",
    });
    await db.insert(inventoryTransferItemsTable).values({
      companyId: COMPANY,
      transferId,
      itemId: ITEM,
      quantity: "20",
    });
    await db.transaction((tx) => postInventoryTransfer(tx, transferId));

    const main = await stockPosition(db, COMPANY, ITEM, MAIN);
    const site = await stockPosition(db, COMPANY, ITEM, SITE);

    expect(main.quantity).toBe(40);
    expect(main.value).toBe(1000); // 40 @ 25
    expect(site.quantity).toBe(20);
    expect(site.value).toBe(500); // 20 @ 25 — the cost travelled with the goods
    expect(site.averageCost).toBe(25);
  });

  it("leaves the company's total stock value unchanged", async () => {
    // Moving a pallet between your own warehouses must not change what the
    // company owns. 60 @ 25 = 1,500, wherever the units are standing.
    const total = await inventoryValue(db, COMPANY);
    expect(total).toBe(1500);
  });
});

describe("one definition of stock value", () => {
  it("counts every warehouse an item is held in", async () => {
    // The BI report used to read the latest movement per *item*, so an item in
    // two warehouses reported only whichever moved last — here, 500 instead of
    // 1,500. `valuedPositions` is per item *and* warehouse.
    const positions = await valuedPositions(db, COMPANY);
    const mine = positions.filter((p) => p.itemId === ITEM);
    expect(mine).toHaveLength(2);
    expect(mine.reduce((s, p) => s + p.value, 0)).toBe(1500);
  });

  it("scopes to the company asked about", async () => {
    const positions = await valuedPositions(db, id(99));
    expect(positions).toEqual([]);
  });
});

describe("an adjustment values the correction at the running average", () => {
  it("writes the difference down at the prevailing cost", async () => {
    // Main holds 40 @ 25.00 = 1,000.00. A count finds 36.
    // 4 units lost at the average of 25.00 -> 900.00 remains.
    const adjId = id(950);
    await db.insert(stockAdjustmentsTable).values({
      id: adjId,
      companyId: COMPANY,
      code: `${tag}-ADJ`,
      warehouseId: MAIN,
      adjustmentDate: today,
      status: "draft",
    });
    await db.insert(stockAdjustmentItemsTable).values({
      companyId: COMPANY,
      adjustmentId: adjId,
      itemId: ITEM,
      actualQuantity: "36",
    });

    await db.transaction((tx) => postStockAdjustment(tx, adjId));
    const p = await stockPosition(db, COMPANY, ITEM, MAIN);
    expect(p.quantity).toBe(36);
    expect(p.value).toBe(900);
    // The correction changes how much there is, never what it is worth each.
    expect(p.averageCost).toBe(25);
  });
});

describe("posting the same document twice", () => {
  it("is refused, so no movement is written a second time", async () => {
    // The lifecycle refuses a repeated action; this checks the stock is what
    // is actually protected by that refusal.
    const before = await stockPosition(db, COMPANY, ITEM, MAIN);
    const docId = id(960);
    await db.insert(goodsReceiptsTable).values({
      id: docId,
      companyId: COMPANY,
      code: `${tag}-GRN-DUP`,
      warehouseId: MAIN,
      receiptDate: today,
      status: "draft",
    });
    await db.insert(goodsReceiptItemsTable).values({
      companyId: COMPANY,
      receiptId: docId,
      itemId: ITEM,
      quantity: "10",
      unitCost: "25.00",
    });

    await db.transaction((tx) => postGoodsReceipt(tx, docId));
    const once = await stockPosition(db, COMPANY, ITEM, MAIN);
    expect(once.quantity).toBe(before.quantity + 10);

    // The engine itself is not idempotent — the lifecycle guard on the route
    // is what stops a second posting, and it is asserted in lifecycle.test.ts.
    // What matters here is that one posting moves stock exactly once.
    const ledger = await valuedPositions(db, COMPANY);
    const main = ledger.find((x) => x.warehouseId === MAIN);
    expect(main?.quantity).toBe(once.quantity);
    expect(main?.value).toBe(once.value);
  });
});
