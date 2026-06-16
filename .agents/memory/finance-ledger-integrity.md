---
name: Finance ledger integrity
description: Rules for keeping money-moving records (receipts, treasury/bank transactions) consistent with cashbox/bank balances and installment schedules.
---

# Finance ledger integrity

Any record that posts to a balance or schedule (receipts, treasury/bank transactions) must keep its
create and delete side-effects symmetric, and must never let descriptive edits silently desync the ledger.

**Rules:**
- Build balance math with parameterized SQL only — `sql\`${col} + ${amount}::numeric\`` / `- ${amount}`. Never `sql.raw(userAmount)` (SQL injection). Generated bodies type `amount` as `z.string()`, so validate it (`/^\d+(\.\d+)?$/`) and return 400 on bad input before touching the DB.
- Financial fields are immutable via PATCH (amount, type, parent account/cashbox id, companyId, and for receipts also customerId/contractId/scheduleId/paymentMethod and **status**). Strip them from the update payload; the only way to reverse a posting is DELETE.
- DELETE must run in a `db.transaction` and reverse every side-effect: opposite balance delta, schedule `paidAmount` (`GREATEST(...-amt,0)` + status CASE), and soft-delete linked txns by `receiptId`.
- Posting is gated on an **immutable** status: a receipt posts at create iff `status === "confirmed"`, and DELETE reverses iff `status === "confirmed"`. Because status can't change via PATCH, create and delete always agree on whether a posting exists. Don't gate delete-reversal on a mutable status (`!== "cancelled"`) — that lets a PATCH-cancel orphan a posted balance.
- Schedule `paidAmount` updates must be a single atomic UPDATE (`paidAmount = paidAmount + amt`, status via CASE), never read-modify-write — concurrent receipts on the same schedule otherwise lose updates.
- For a **derived** total that feeds a posting (e.g. payment-certificate `netAmount = current + additions − retention − advanceRecovery − deductions`): once the row is posted, freeze the derived field AND every component column it derives from. Freezing only the total lets a PATCH edit the breakdown so the components no longer reconcile to the posted/ledger total. In the construction `registerCrud` factory this is `FinancialConfig.componentFields` — strip them all in the posted branch.
- Reports for "X vs recovered/released" must pick ONE source of truth. A static rollup column (e.g. advance `recoveredAmount`, never auto-maintained) plus the dedicated transaction entity (advance-recoveries rows) double-counts if summed together. Prefer aggregating the transaction entity and use it for both the summary card and the detail report so they can't disagree.

**Why:** an architect review caught `sql.raw` injection, delete paths that left balances/schedules posted after the record was gone, a read-modify-write race, and a PATCH `status->cancelled` that diverged the ledger from reporting.

**How to apply:** whenever adding/editing a route that moves money or marks a schedule paid, walk create AND delete AND patch together and confirm the three stay consistent.
