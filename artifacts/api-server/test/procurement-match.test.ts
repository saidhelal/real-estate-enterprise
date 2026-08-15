import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  db,
  companiesTable,
  purchaseOrdersTable,
  purchaseOrderItemsTable,
  goodsReceiptNotesTable,
  grnItemsTable,
} from "@workspace/db";
import {
  orderProgress,
  receiveAgainstOrder,
  OVER_RECEIPT_TOLERANCE,
} from "../src/lib/procurement-match";
import { PostingError } from "../src/lib/posting";

/**
 * Receiving against a purchase order.
 *
 * A purchase order line carried a `received_quantity` that nothing ever wrote
 * to — it was a number somebody typed into a form. So an order could not tell
 * a full delivery from no delivery, and a supplier could deliver against the
 * same line indefinitely.
 *
 * These check the consequence: after accepting a receipt, does the order know;
 * after two partial receipts, is it complete; and is a third one refused.
 *
 * FIXTURE data under a per-run tag, removed in `afterAll`.
 */

const tag = `matchtest-${Date.now()}`;
const id = (n: number) => `${String(n).padStart(8, "0")}-0000-4000-8000-${tag.slice(-12).padStart(12, "0")}`;

const COMPANY = id(1);
const PO = id(2);
const LINE_A = id(3);
const LINE_B = id(4);

const grnPartial = id(10);
const grnRest = id(11);
const grnExcess = id(12);

const today = new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  await db.insert(companiesTable).values({
    id: COMPANY,
    code: `${tag}-C`,
    name: `${tag} Company`,
    nameAr: "شركة اختبار",
  });
  await db.insert(purchaseOrdersTable).values({
    id: PO,
    companyId: COMPANY,
    code: `${tag}-PO`,
    status: "approved",
    orderDate: today,
  });
  await db.insert(purchaseOrderItemsTable).values([
    { id: LINE_A, companyId: COMPANY, poId: PO, quantity: "100", unitPrice: "10" },
    { id: LINE_B, companyId: COMPANY, poId: PO, quantity: "50", unitPrice: "20" },
  ]);
});

afterAll(async () => {
  await db.delete(grnItemsTable).where(eq(grnItemsTable.companyId, COMPANY));
  await db.delete(goodsReceiptNotesTable).where(eq(goodsReceiptNotesTable.companyId, COMPANY));
  await db.delete(purchaseOrderItemsTable).where(eq(purchaseOrderItemsTable.companyId, COMPANY));
  await db.delete(purchaseOrdersTable).where(eq(purchaseOrdersTable.companyId, COMPANY));
  await db.delete(companiesTable).where(eq(companiesTable.id, COMPANY));
});

/** A receipt note against this order, with one line per (poItem, accepted). */
async function makeGrn(
  grnId: string,
  suffix: string,
  lines: Array<{ poItemId: string; accepted: string }>,
): Promise<void> {
  await db.insert(goodsReceiptNotesTable).values({
    id: grnId,
    companyId: COMPANY,
    code: `${tag}-${suffix}`,
    poId: PO,
    receiptDate: today,
    status: "draft",
  });
  await db.insert(grnItemsTable).values(
    lines.map((l) => ({
      companyId: COMPANY,
      grnId,
      poItemId: l.poItemId,
      receivedQuantity: l.accepted,
      acceptedQuantity: l.accepted,
    })),
  );
}

describe("an order knows what has arrived", () => {
  it("starts with nothing received", async () => {
    const p = await orderProgress(db, PO);
    expect(p.ordered).toBe(150);
    expect(p.received).toBe(0);
    expect(p.complete).toBe(false);
    expect(p.partial).toBe(false);
  });

  it("records a part delivery against the order lines", async () => {
    await makeGrn(grnPartial, "GRN1", [
      { poItemId: LINE_A, accepted: "60" },
      { poItemId: LINE_B, accepted: "50" },
    ]);

    const result = await db.transaction((tx) => receiveAgainstOrder(tx, grnPartial));
    expect(result.linesUpdated).toBe(2);
    expect(result.ordersAdvanced).toBe(1);

    const p = await orderProgress(db, PO);
    expect(p.received).toBe(110);
    expect(p.partial).toBe(true);
    expect(p.complete).toBe(false);

    const [order] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, PO));
    expect(order.status).toBe("partially_received");
  });

  it("adds a second delivery to the first rather than replacing it", async () => {
    await makeGrn(grnRest, "GRN2", [{ poItemId: LINE_A, accepted: "40" }]);
    await db.transaction((tx) => receiveAgainstOrder(tx, grnRest));

    const p = await orderProgress(db, PO);
    expect(p.received).toBe(150);
    expect(p.complete).toBe(true);

    const [order] = await db.select().from(purchaseOrdersTable).where(eq(purchaseOrdersTable.id, PO));
    expect(order.status).toBe("fully_received");
  });

  it("refuses a delivery beyond what was ordered", async () => {
    // Without this an order line for 100 could receive 100 again, and again.
    await makeGrn(grnExcess, "GRN3", [{ poItemId: LINE_A, accepted: "10" }]);
    await expect(db.transaction((tx) => receiveAgainstOrder(tx, grnExcess))).rejects.toBeInstanceOf(
      PostingError,
    );
  });

  it("says the numbers when it refuses, so a buyer can act", async () => {
    try {
      await db.transaction((tx) => receiveAgainstOrder(tx, grnExcess));
      throw new Error("should have refused");
    } catch (err) {
      const message = (err as PostingError).message;
      expect(message).toContain("110"); // what it would become
      expect(message).toContain("100"); // what was ordered
      expect(message).toMatch(/amend/i);
    }
  });

  it("leaves the order untouched after a refusal", async () => {
    const p = await orderProgress(db, PO);
    expect(p.received).toBe(150);
  });
});

describe("the over-receipt policy", () => {
  // Decided: zero tolerance. A supplier who sends more than was ordered has
  // changed the order, and changing an order is the buyer's act.
  it("is zero, and is stated as a policy rather than hidden in a comparison", () => {
    expect(OVER_RECEIPT_TOLERANCE).toBe(0);
  });

  it("accepts a delivery equal to what is outstanding", async () => {
    const po = id(40);
    const line = id(41);
    const grn = id(42);
    await db.insert(purchaseOrdersTable).values({ id: po, companyId: COMPANY, code: `${tag}-PO-EQ`, status: "approved", orderDate: today });
    await db.insert(purchaseOrderItemsTable).values({ id: line, companyId: COMPANY, poId: po, quantity: "30", unitPrice: "1" });
    await db.insert(goodsReceiptNotesTable).values({ id: grn, companyId: COMPANY, code: `${tag}-GRN-EQ`, poId: po, receiptDate: today, status: "draft" });
    await db.insert(grnItemsTable).values({ companyId: COMPANY, grnId: grn, poItemId: line, receivedQuantity: "30", acceptedQuantity: "30" });

    await db.transaction((tx) => receiveAgainstOrder(tx, grn));
    const p = await orderProgress(db, po);
    expect(p.received).toBe(30);
    expect(p.complete).toBe(true);
  });

  it("accepts a delivery smaller than what is outstanding", async () => {
    const po = id(50);
    const line = id(51);
    const grn = id(52);
    await db.insert(purchaseOrdersTable).values({ id: po, companyId: COMPANY, code: `${tag}-PO-LT`, status: "approved", orderDate: today });
    await db.insert(purchaseOrderItemsTable).values({ id: line, companyId: COMPANY, poId: po, quantity: "30", unitPrice: "1" });
    await db.insert(goodsReceiptNotesTable).values({ id: grn, companyId: COMPANY, code: `${tag}-GRN-LT`, poId: po, receiptDate: today, status: "draft" });
    await db.insert(grnItemsTable).values({ companyId: COMPANY, grnId: grn, poItemId: line, receivedQuantity: "10", acceptedQuantity: "10" });

    await db.transaction((tx) => receiveAgainstOrder(tx, grn));
    const p = await orderProgress(db, po);
    expect(p.received).toBe(10);
    expect(p.partial).toBe(true);
  });

  it("refuses a delivery one unit over the outstanding quantity", async () => {
    // One unit, not a percentage: the tolerance is zero, so the smallest
    // possible excess is the case that matters.
    const po = id(60);
    const line = id(61);
    const grn = id(62);
    await db.insert(purchaseOrdersTable).values({ id: po, companyId: COMPANY, code: `${tag}-PO-GT`, status: "approved", orderDate: today });
    await db.insert(purchaseOrderItemsTable).values({ id: line, companyId: COMPANY, poId: po, quantity: "30", unitPrice: "1" });
    await db.insert(goodsReceiptNotesTable).values({ id: grn, companyId: COMPANY, code: `${tag}-GRN-GT`, poId: po, receiptDate: today, status: "draft" });
    await db.insert(grnItemsTable).values({ companyId: COMPANY, grnId: grn, poItemId: line, receivedQuantity: "31", acceptedQuantity: "31" });

    await expect(db.transaction((tx) => receiveAgainstOrder(tx, grn))).rejects.toBeInstanceOf(PostingError);
    const p = await orderProgress(db, po);
    expect(p.received).toBe(0);
  });
});

describe("what receiving does not do", () => {
  it("ignores a receipt line with no order line behind it", async () => {
    // A direct purchase still moves stock; it simply has no order to advance.
    const loose = id(20);
    await db.insert(goodsReceiptNotesTable).values({
      id: loose,
      companyId: COMPANY,
      code: `${tag}-GRN4`,
      receiptDate: today,
      status: "draft",
    });
    await db.insert(grnItemsTable).values({
      companyId: COMPANY,
      grnId: loose,
      receivedQuantity: "5",
      acceptedQuantity: "5",
    });

    const result = await db.transaction((tx) => receiveAgainstOrder(tx, loose));
    expect(result.linesUpdated).toBe(0);
    expect(result.ordersAdvanced).toBe(0);
  });

  it("counts what was accepted, not merely what turned up", async () => {
    // Goods that arrived and failed inspection have not been received; an
    // order that closes with a rejected pallet on the dock is the bug.
    const rejected = id(21);
    const line = id(22);
    const order = id(23);
    await db.insert(purchaseOrdersTable).values({
      id: order,
      companyId: COMPANY,
      code: `${tag}-PO2`,
      status: "approved",
      orderDate: today,
    });
    await db.insert(purchaseOrderItemsTable).values({
      id: line,
      companyId: COMPANY,
      poId: order,
      quantity: "20",
      unitPrice: "5",
    });
    await db.insert(goodsReceiptNotesTable).values({
      id: rejected,
      companyId: COMPANY,
      code: `${tag}-GRN5`,
      poId: order,
      receiptDate: today,
      status: "draft",
    });
    await db.insert(grnItemsTable).values({
      companyId: COMPANY,
      grnId: rejected,
      poItemId: line,
      receivedQuantity: "20",
      acceptedQuantity: "15",
      rejectedQuantity: "5",
    });

    await db.transaction((tx) => receiveAgainstOrder(tx, rejected));
    const p = await orderProgress(db, order);
    expect(p.received).toBe(15);
    expect(p.complete).toBe(false);
  });
});
