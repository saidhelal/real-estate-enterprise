---
name: Cheque ↔ voucher bridge (double-count trap)
description: Why cheque-linked receipt/payment vouchers must post AR/AP through a bridge account and skip the cheque collection leg.
---

# Cheque ↔ voucher posting must use a bridge account, not settle AR/AP twice

When a cheque is linked to a receipt voucher (incoming) or payment voucher (outgoing),
the originating voucher already moves AR/AP into a **bridge** account on post:
- incoming `receipt.cheque`: Dr **1050 Cheques Under Collection** / Cr **1030 AR**
- outgoing `payment.cheque`: Dr **2010 AP** / Cr **2030 Cheques Payable**

The cheque lifecycle then posts ONLY the **clearing** leg on clear (bridge → Bank):
- incoming: Dr **1020 Bank** / Cr **1050**
- outgoing: Dr **2030** / Cr **1020 Bank**

**The trap:** a cheque normally also posts a **collection** leg (settling AR/AP itself).
If a *linked* cheque posts its collection leg, AR/AP is settled twice — once by the
voucher into the bridge, once by the cheque — leaving a phantom AR/AP balance and a
double-counted Bank. The trial balance still *balances* (debits=credits), so the bug
is invisible there; it only shows up as the GL control account diverging from the
AR/AP aging subledger.

**Rule:** in the cheque transition handler, compute
`linkedToVoucher = !!(receiptId || paymentVoucherId)` and have the collection-leg
poster return early when linked. Standalone cheques (no voucher) still post both legs.
Keep the two directions **symmetric** — if you fix one side, mirror it on the other and
re-point the seed default mapping (e.g. `receipt.cheque` debit must be the bridge 1050,
not Bank 1020) AND add it to the idempotent mapping-fix UPDATE so existing DBs are
remediated, not just fresh seeds.

**Why:** verified empirically — pre-fix a linked incoming cheque left AR = −1150 phantom
and Bank double-counted +2300; post-fix AR delta 0, Bank +1150 single, bridge nets 0.

**How to apply:** any new cheque-settled instrument or voucher type, or any change to the
`*.cheque` mappings, must preserve: voucher → bridge, cheque clear → bridge→bank, linked
cheque skips collection. Test create+clear nets AR/AP to 0 and moves Bank exactly once.

## Known residual edge cases (not yet hardened — see follow-ups)
- Linked cheque returned/cancelled *before* clearing posts no cheque leg, so the bridge
  stays held by the voucher until the voucher itself is reversed.
- Orphan bridge: posting a `*.cheque` voucher but never creating the cheque record leaves
  the bridge balance uncleared (no reconciliation/exception report yet).
- No DB/service constraint enforces exactly-one-of `receiptId`/`paymentVoucherId` with a
  direction-compatible link; malformed links are possible via API misuse.
