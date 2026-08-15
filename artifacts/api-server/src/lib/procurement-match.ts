import { and, eq } from "drizzle-orm";
import {
  db,
  purchaseOrdersTable,
  purchaseOrderItemsTable,
  goodsReceiptNotesTable,
  grnItemsTable,
} from "@workspace/db";
import { PostingError, type Tx } from "./posting";

/**
 * What a purchase order has actually received.
 *
 * A purchase order carried a `received_quantity` on every line and nothing
 * ever wrote to it: it was a number somebody typed into a form. So an order
 * had no idea what had arrived against it. Nothing could tell a fully
 * received order from an untouched one, nothing stopped a supplier delivering
 * three times against a single order line, and the only way to know where an
 * order stood was to read the receipts by eye.
 *
 * This module owns the link between the two documents — the receiving half of
 * a three-way match. It answers one question, "how much of this order has
 * arrived", and enforces one rule, "not more than was ordered".
 *
 * ---------------------------------------------------------------------------
 * Over-receipt tolerance: zero.
 *
 * This was an open business decision and has been decided: no delivery may
 * exceed what remains outstanding on the order line. A supplier who sends more
 * than was ordered has changed the order, and changing an order is the buyer's
 * act — so the receipt is refused and the buyer amends the purchase order,
 * which is a decision somebody makes rather than one that happens quietly at
 * the loading bay.
 *
 * The rule lives here, in the matching engine, and nowhere else. Putting it on
 * the receiving screen would leave the API open, and every other caller —
 * an import, an integration, a second screen — would be unguarded.
 * ---------------------------------------------------------------------------
 */

/**
 * How much more than the outstanding quantity a delivery may carry.
 *
 * Zero, by decision. Named rather than written as a bare `>` so the policy is
 * visible as a policy: if it is ever revised it changes here, once, and every
 * refusal below follows.
 */
export const OVER_RECEIPT_TOLERANCE = 0;

export interface OrderProgress {
  ordered: number;
  received: number;
  /** Every line fully satisfied. */
  complete: boolean;
  /** Something has arrived, but not everything. */
  partial: boolean;
}

/**
 * How far along an order is.
 *
 * Derived from the lines rather than stored on the order, so it cannot drift
 * from them — an order whose header says "fully received" while a line is
 * still outstanding is worse than an order with no status at all.
 */
export async function orderProgress(
  exec: Tx | typeof db,
  poId: string,
): Promise<OrderProgress> {
  const rows = await exec
    .select({
      quantity: purchaseOrderItemsTable.quantity,
      receivedQuantity: purchaseOrderItemsTable.receivedQuantity,
    })
    .from(purchaseOrderItemsTable)
    .where(
      and(eq(purchaseOrderItemsTable.poId, poId), eq(purchaseOrderItemsTable.isDeleted, false)),
    );

  let ordered = 0;
  let received = 0;
  let allLinesComplete = rows.length > 0;

  for (const r of rows) {
    const q = Number(r.quantity ?? 0);
    const got = Number(r.receivedQuantity ?? 0);
    ordered += q;
    received += got;
    if (got < q) allLinesComplete = false;
  }

  return {
    ordered,
    received,
    complete: allLinesComplete,
    partial: received > 0 && !allLinesComplete,
  };
}

/**
 * The status an order's own lines say it is in.
 *
 * Only the receiving states are decided here. `draft`, `approved` and
 * `cancelled` are the buyer's business and are left exactly as they are — this
 * never moves an order backwards or overrides a human decision.
 */
function receivingStatus(current: string, progress: OrderProgress): string | null {
  if (current === "cancelled" || current === "closed") return null;
  if (progress.complete) return "fully_received";
  if (progress.partial) return "partially_received";
  return null;
}

export interface ReceiveResult {
  /** Order lines whose received quantity moved. */
  linesUpdated: number;
  /** Purchase orders whose status changed as a result. */
  ordersAdvanced: number;
}

/**
 * Record a goods receipt note against the order it fulfils.
 *
 * The accepted quantity is what counts, not the delivered one: goods that
 * arrived and failed inspection have not been received, and treating them as
 * received is how an order closes with a rejected pallet still on the dock.
 * Where a line records no inspection outcome, the received quantity stands in.
 *
 * Runs inside the caller's transaction, so the order's position and the
 * receipt that changed it commit together.
 */
export async function receiveAgainstOrder(tx: Tx, grnId: string): Promise<ReceiveResult> {
  const [grn] = await tx
    .select()
    .from(goodsReceiptNotesTable)
    .where(eq(goodsReceiptNotesTable.id, grnId))
    .for("update");
  if (!grn) throw new PostingError(404, "Goods receipt note not found");

  const lines = await tx
    .select()
    .from(grnItemsTable)
    .where(and(eq(grnItemsTable.grnId, grnId), eq(grnItemsTable.isDeleted, false)));

  const touchedOrders = new Set<string>();
  let linesUpdated = 0;

  for (const line of lines) {
    // A line not tied to an order line is a receipt without a purchase — it
    // still moves stock, it simply has no order to advance.
    if (!line.poItemId) continue;

    const accepted =
      line.acceptedQuantity !== null && line.acceptedQuantity !== undefined
        ? Number(line.acceptedQuantity)
        : Number(line.receivedQuantity ?? 0);
    if (!Number.isFinite(accepted) || accepted === 0) continue;

    const [orderLine] = await tx
      .select()
      .from(purchaseOrderItemsTable)
      .where(eq(purchaseOrderItemsTable.id, line.poItemId))
      .for("update");
    if (!orderLine) continue;

    const ordered = Number(orderLine.quantity ?? 0);
    const already = Number(orderLine.receivedQuantity ?? 0);
    const total = already + accepted;

    if (total > ordered + OVER_RECEIPT_TOLERANCE) {
      throw new PostingError(
        409,
        `This would receive ${total} against an order line for ${ordered}` +
          `${already > 0 ? ` (${already} already received)` : ""}. ` +
          `Amend the purchase order if the extra quantity is intended.`,
      );
    }

    await tx
      .update(purchaseOrderItemsTable)
      .set({ receivedQuantity: String(total) })
      .where(eq(purchaseOrderItemsTable.id, orderLine.id));
    linesUpdated++;
    if (orderLine.poId) touchedOrders.add(orderLine.poId);
  }

  let ordersAdvanced = 0;
  for (const poId of touchedOrders) {
    const [order] = await tx
      .select({ status: purchaseOrdersTable.status })
      .from(purchaseOrdersTable)
      .where(eq(purchaseOrdersTable.id, poId));
    if (!order) continue;

    const progress = await orderProgress(tx, poId);
    const next = receivingStatus(String(order.status), progress);
    if (!next || next === order.status) continue;

    await tx
      .update(purchaseOrdersTable)
      .set({ status: next })
      .where(eq(purchaseOrdersTable.id, poId));
    ordersAdvanced++;
  }

  return { linesUpdated, ordersAdvanced };
}
