---
name: Reversal must link side-effect rows by FK, not free text
description: Why posting side-effect rows (treasury/bank) need a stable source FK for safe reversal
---

When a posted voucher's reversal soft-deletes its cash/bank (treasury/bank) side-effect rows, match them by a stable source FK (e.g. `receiptId`, `paymentVoucherId`), never by `reference = code` text.

**Why:** `reference` is user-visible free text; a manual or other-module transaction can share the same string as a voucher code, so a `WHERE reference = code` delete can wipe unrelated rows and corrupt balances/audit. The receipt flow already used `receiptId`; payment vouchers had no such column and fell back to `reference` — caught in code review.

**How to apply:** every posting that inserts a downstream side-effect row must stamp the originating entity's id on it (add the FK column to the side-effect table if missing) and the reverse path must filter by that id. Mirror the existing `receiptId` pattern for any new voucher type.
