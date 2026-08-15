import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  companiesTable,
  warehousesTable,
  inventoryItemsTable,
  inventoryLedgerTable,
  reorderLevelsTable,
  notificationsTable,
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
  sweepReorderLevels,
  postGoodsReceipt,
  postGoodsIssue,
  postInventoryTransfer,
  postStockAdjustment,
} from "../src/lib/stock";
import { PostingError } from "../src/lib/posting";

/**
 * Stock movements.
 *
 * Inventory had nineteen registers and no stock: a goods receipt did not
 * increase anything, a goods issue did not reduce anything, and the dashboard
 * computed levels from a ledger that nothing ever wrote to. So the tests here
 * are about consequence, not storage — after posting a receipt, is the stock
 * actually there; after an issue, is it gone; and can an issue take out more
 * than exists.
 *
 * Everything is FIXTURE data under a per-run tag, removed in `afterAll`.
 */

const tag = `stocktest-${Date.now()}`;
const id = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-${tag.slice(-12).padStart(12, "0")}`;

const COMPANY = id(1);
const WAREHOUSE_A = id(2);
const WAREHOUSE_B = id(3);
const ITEM = id(4);

const receiptId = id(10);
const issueId = id(11);
const transferId = id(12);
const adjustmentId = id(13);
const overIssueId = id(14);

const today = new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  await db.insert(companiesTable).values({
    id: COMPANY,
    code: `${tag}-C`,
    name: `${tag} Company`,
    nameAr: "شركة اختبار",
  });
  await db.insert(warehousesTable).values([
    { id: WAREHOUSE_A, companyId: COMPANY, code: `${tag}-WA`, name: "Main store", nameAr: "المخزن الرئيسي" },
    { id: WAREHOUSE_B, companyId: COMPANY, code: `${tag}-WB`, name: "Site store", nameAr: "مخزن الموقع" },
  ]);
  await db.insert(inventoryItemsTable).values({
    id: ITEM,
    companyId: COMPANY,
    code: `${tag}-ITEM`,
    name: "Cement bag",
    nameAr: "كيس أسمنت",
  });
});

afterAll(async () => {
  // The reorder sweep notifies, and a notification carries the company. The
  // FK refuses to let the company go while one exists — which is the
  // constraint working, not a problem with it.
  await db.delete(notificationsTable).where(eq(notificationsTable.companyId, COMPANY));
  await db.delete(reorderLevelsTable).where(eq(reorderLevelsTable.companyId, COMPANY));
  await db.delete(inventoryLedgerTable).where(eq(inventoryLedgerTable.companyId, COMPANY));
  await db.delete(goodsReceiptItemsTable).where(eq(goodsReceiptItemsTable.companyId, COMPANY));
  await db.delete(goodsReceiptsTable).where(eq(goodsReceiptsTable.companyId, COMPANY));
  await db.delete(goodsIssueItemsTable).where(eq(goodsIssueItemsTable.companyId, COMPANY));
  await db.delete(goodsIssuesTable).where(eq(goodsIssuesTable.companyId, COMPANY));
  await db.delete(inventoryTransferItemsTable).where(eq(inventoryTransferItemsTable.companyId, COMPANY));
  await db.delete(inventoryTransfersTable).where(eq(inventoryTransfersTable.companyId, COMPANY));
  await db.delete(stockAdjustmentItemsTable).where(eq(stockAdjustmentItemsTable.companyId, COMPANY));
  await db.delete(stockAdjustmentsTable).where(eq(stockAdjustmentsTable.companyId, COMPANY));
  await db.delete(inventoryItemsTable).where(eq(inventoryItemsTable.id, ITEM));
  await db.delete(warehousesTable).where(inArray(warehousesTable.id, [WAREHOUSE_A, WAREHOUSE_B]));
  await db.delete(companiesTable).where(eq(companiesTable.id, COMPANY));
});

describe("stock arrives", () => {
  it("starts at nothing", async () => {
    expect(await onHand(db, COMPANY, ITEM, WAREHOUSE_A)).toBe(0);
  });

  it("increases by what the receipt says was received", async () => {
    await db.insert(goodsReceiptsTable).values({
      id: receiptId,
      companyId: COMPANY,
      code: `${tag}-GRN`,
      warehouseId: WAREHOUSE_A,
      receiptDate: today,
      status: "draft",
    });
    await db.insert(goodsReceiptItemsTable).values({
      companyId: COMPANY,
      receiptId,
      itemId: ITEM,
      quantity: "100",
      unitCost: "25.50",
    });

    const result = await db.transaction((tx) => postGoodsReceipt(tx, receiptId));
    expect(result.movements).toBe(1);
    expect(await onHand(db, COMPANY, ITEM, WAREHOUSE_A)).toBe(100);
  });

  it("records the running balance on the movement itself", async () => {
    // A ledger you have to sum to read is a list; one that carries the balance
    // is a statement.
    const [row] = await db
      .select()
      .from(inventoryLedgerTable)
      .where(eq(inventoryLedgerTable.referenceNumber, `${tag}-GRN`));
    expect(Number(row.quantityIn)).toBe(100);
    expect(Number(row.balanceQuantity)).toBe(100);
    // The cost is carried from the receipt, which is the document that knows
    // it. Nothing here decides a valuation method.
    expect(Number(row.unitCost)).toBe(25.5);
  });
});

describe("stock leaves", () => {
  it("decreases by what the issue says was taken", async () => {
    await db.insert(goodsIssuesTable).values({
      id: issueId,
      companyId: COMPANY,
      code: `${tag}-ISS`,
      warehouseId: WAREHOUSE_A,
      issueDate: today,
      status: "draft",
    });
    await db.insert(goodsIssueItemsTable).values({
      companyId: COMPANY,
      issueId,
      itemId: ITEM,
      quantity: "30",
    });

    await db.transaction((tx) => postGoodsIssue(tx, issueId));
    expect(await onHand(db, COMPANY, ITEM, WAREHOUSE_A)).toBe(70);
  });

  it("refuses to hand over stock that is not there", async () => {
    // Negative stock is not a smaller number; it is a claim the warehouse gave
    // away goods it did not have, and everything downstream inherits it.
    await db.insert(goodsIssuesTable).values({
      id: overIssueId,
      companyId: COMPANY,
      code: `${tag}-ISS2`,
      warehouseId: WAREHOUSE_A,
      issueDate: today,
      status: "draft",
    });
    await db.insert(goodsIssueItemsTable).values({
      companyId: COMPANY,
      issueId: overIssueId,
      itemId: ITEM,
      quantity: "500",
    });

    await expect(db.transaction((tx) => postGoodsIssue(tx, overIssueId))).rejects.toBeInstanceOf(
      PostingError,
    );
    // And the refusal left nothing behind.
    expect(await onHand(db, COMPANY, ITEM, WAREHOUSE_A)).toBe(70);
  });
});

describe("stock moves between warehouses", () => {
  it("writes two movements, so both warehouses read correctly", async () => {
    await db.insert(inventoryTransfersTable).values({
      id: transferId,
      companyId: COMPANY,
      code: `${tag}-TRF`,
      fromWarehouseId: WAREHOUSE_A,
      toWarehouseId: WAREHOUSE_B,
      transferDate: today,
      status: "draft",
    });
    await db.insert(inventoryTransferItemsTable).values({
      companyId: COMPANY,
      transferId,
      itemId: ITEM,
      quantity: "20",
    });

    const result = await db.transaction((tx) => postInventoryTransfer(tx, transferId));
    expect(result.movements).toBe(2);
    expect(await onHand(db, COMPANY, ITEM, WAREHOUSE_A)).toBe(50);
    expect(await onHand(db, COMPANY, ITEM, WAREHOUSE_B)).toBe(20);
  });
});

describe("the count wins", () => {
  it("moves stock to whatever was actually counted", async () => {
    await db.insert(stockAdjustmentsTable).values({
      id: adjustmentId,
      companyId: COMPANY,
      code: `${tag}-ADJ`,
      warehouseId: WAREHOUSE_A,
      adjustmentDate: today,
      status: "draft",
    });
    await db.insert(stockAdjustmentItemsTable).values({
      companyId: COMPANY,
      adjustmentId,
      itemId: ITEM,
      // The count sheet was prepared when the system held a different figure;
      // the engine must recompute the difference, not trust the stale one.
      systemQuantity: "999",
      actualQuantity: "45",
      differenceQuantity: "-954",
    });

    await db.transaction((tx) => postStockAdjustment(tx, adjustmentId));
    expect(await onHand(db, COMPANY, ITEM, WAREHOUSE_A)).toBe(45);
  });

  it("says what it reconciled, in the ledger", async () => {
    const [row] = await db
      .select()
      .from(inventoryLedgerTable)
      .where(eq(inventoryLedgerTable.referenceNumber, `${tag}-ADJ`));
    expect(Number(row.quantityOut)).toBe(5); // 50 on hand, 45 counted
    expect(row.notes).toContain("45");
    expect(row.notes).toContain("50");
  });
});

describe("stock reaching its reorder level", () => {
  //  held a minimum per item and warehouse since the module was
  // written, and only the dashboard ever compared against it — for whoever
  // happened to open that screen. A minimum nobody is told about is a number,
  // not a control.
  it("says nothing while stock is above the minimum", async () => {
    await db.insert(reorderLevelsTable).values({
      companyId: COMPANY,
      itemId: ITEM,
      warehouseId: WAREHOUSE_A,
      minQuantity: "10",
      reorderQuantity: "100",
    });
    // 45 on hand after the adjustment above.
    const r = await sweepReorderLevels(COMPANY);
    expect(r.checked).toBe(1);
    expect(r.below).toBe(0);
  });

  it("reports the shortage once stock falls to the minimum", async () => {
    await db
      .update(reorderLevelsTable)
      .set({ minQuantity: "500" })
      .where(eq(reorderLevelsTable.companyId, COMPANY));
    const r = await sweepReorderLevels(COMPANY);
    expect(r.below).toBe(1);
  });

  it("ignores a rule with no minimum set", async () => {
    // A zero or missing minimum is not a promise to hold zero stock; it means
    // nobody has decided a level yet, and alerting on it would be noise.
    await db
      .update(reorderLevelsTable)
      .set({ minQuantity: "0" })
      .where(eq(reorderLevelsTable.companyId, COMPANY));
    const r = await sweepReorderLevels(COMPANY);
    expect(r.below).toBe(0);
  });
});

describe("what a document cannot do", () => {
  it("refuses a receipt with no warehouse", async () => {
    const orphan = id(20);
    await db.insert(goodsReceiptsTable).values({
      id: orphan,
      companyId: COMPANY,
      code: `${tag}-GRN2`,
      receiptDate: today,
      status: "draft",
    });
    await expect(db.transaction((tx) => postGoodsReceipt(tx, orphan))).rejects.toThrow(
      /nowhere to put/i,
    );
  });

  it("refuses a transfer that goes nowhere", async () => {
    const circular = id(21);
    await db.insert(inventoryTransfersTable).values({
      id: circular,
      companyId: COMPANY,
      code: `${tag}-TRF2`,
      fromWarehouseId: WAREHOUSE_A,
      toWarehouseId: WAREHOUSE_A,
      transferDate: today,
      status: "draft",
    });
    await expect(db.transaction((tx) => postInventoryTransfer(tx, circular))).rejects.toThrow(
      /same warehouse/i,
    );
  });
});
