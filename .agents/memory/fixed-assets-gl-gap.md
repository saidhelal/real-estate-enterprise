---
name: Fixed Assets GL posting gap
description: Fixed-asset depreciation/disposal endpoints only flip a status field — they never post to the general ledger.
---

# Fixed Assets is not wired to the accounting engine

`artifacts/api-server/src/routes/fixed-assets.ts` has NO call to `postAutomaticEntry` /
`reverseAutomaticEntriesForSource`. The lifecycle endpoints
`/asset-depreciations/:id/post`, `/asset-depreciations/:id/reverse`, and
`/asset-disposals/:id/approve` only `UPDATE ... SET status = 'posted'|'reversed'|'approved'`
— no journal entry is created.

Supporting gaps:
- `DEFAULT_MAPPINGS` in `seed.ts` has no depreciation/disposal event keys
  (e.g. `depreciation.post`, `asset.disposal`).
- The seeded Chart of Accounts (`DEFAULT_ACCOUNTS`) has Property & Equipment (1210) but
  NO depreciation-expense, accumulated-depreciation (contra-asset), or gain/loss-on-disposal
  accounts.
- Yet the seed `MODULES` grants `assetDepreciations` the `post`/`reverse` extraActions and
  `assetDisposals` the `approve` extraAction — so RBAC implies posting was intended.

**Why:** the "post"/"reverse" permission codes and depreciation `status` enum make it look
integrated, but it is a status-only workflow. Any claim that "fixed-asset transactions post
to the Chart of Accounts" is currently false.

**How to apply:** completing this needs (1) new COA accounts, (2) new account_mappings keys,
(3) `postAutomaticEntry` in the post/reverse/disposal handlers inside their tx (mirror the
finance/inventory pattern, idempotent per `(sourceType, sourceId)`). This is feature work, not
a bug fix — do not bundle it into an "audit only / do not create" task.
