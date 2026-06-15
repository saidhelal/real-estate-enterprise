---
name: Accounting reversal & report status filter
description: Why GL/report aggregations must count reversed entries, and how automatic posting stays idempotent.
---

# Reversal-aware report aggregation

Reversing a journal entry creates a posted *mirror* entry (swapped debit/credit, sourceType `reversal`) AND flips the original to status `reversed`. The original's lines are NOT deleted.

**Rule:** every ledger aggregation (trial balance, general ledger, balance sheet, income statement, cash flow, budget-vs-actual, financial dashboard — all flow through `accountBalances`) must filter `status IN ('posted','reversed')`, not `status = 'posted'`.

**Why:** if reports count only `posted`, the reversed original is excluded while its posted mirror is still counted, so they don't cancel — leaving a phantom (non-zero) balance. A create+reverse cycle must net back to the pre-entry baseline. Verified: baseline → create collection (+N, balanced) → delete/reverse → back to baseline.

**How to apply:** when adding any new accounting report or aggregation, reuse `accountBalances` or replicate its `inArray(journalEntriesTable.status, ["posted","reversed"])` filter. Entry-status *count* metrics (e.g. dashboard "posted entries" count) are display-only and stay `status = 'posted'`.

# Automatic posting idempotency

`postAutomaticEntry` no-ops (returns the existing row) when a non-deleted automatic JE already exists for the same `(sourceType, sourceId)` and is not `reversed`. This prevents duplicate postings from retries/double calls overstating balances. A new post is allowed again only after the prior one is reversed.

**How to apply:** integration hooks (receipts, treasury, bank, installment collections, reservation payments, contracts) call `postAutomaticEntry` on create inside the same tx, and `reverseAutomaticEntriesForSource` on delete. Both are best-effort and skip cleanly when accounting is unconfigured.
