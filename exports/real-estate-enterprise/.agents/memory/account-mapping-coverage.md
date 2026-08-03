---
name: Account-mapping coverage for posting event keys
description: Every postAutomaticEntry eventKey string used in routes must have a DEFAULT_MAPPINGS row, or GL posting is silently skipped.
---

# Account-mapping coverage

`postAutomaticEntry` / `postAutomaticLines` resolve an `account_mappings` row by
`(companyId, eventKey)`. They are **best-effort**: if no mapping exists for the
eventKey, posting is skipped silently (no error). So a business event can succeed
at the API level while never touching the GL.

**Rule:** every `eventKey` literal passed to `postAutomaticEntry` from a route
must have a matching tuple in `DEFAULT_MAPPINGS` in `seed.ts`. When adding a new
financial event, add its mapping in the same change.

**Why:** the contractor extract used `engineering.contractor_invoice` with no
seeded mapping, so contractor invoices never posted to the ledger — the bug was
invisible because the create call returned 201.

**Correct contractor model:** extract posts `Dr Inventory(1040) / Cr AP(2010)`
(capitalize construction WIP to inventory for a developer building units to sell),
then the payment voucher settles `Dr AP(2010) / Cr Cheques Payable(2030)` with NO
`expenseAccountId` (passing an expense account double-expenses and bypasses AP).

**How to apply:** after wiring any new auto-posting eventKey, grep routes for the
literal, confirm it exists in `DEFAULT_MAPPINGS`, and re-seed (idempotent insert
adds missing mappings to existing companies). For an in-flight demo schema, insert
the row directly into `demo.account_mappings` since a full re-seed isn't required.
