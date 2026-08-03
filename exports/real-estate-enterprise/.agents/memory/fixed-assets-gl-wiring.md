---
name: Fixed Assets GL wiring
description: How Fixed Assets transactions post to the general ledger via the shared auto-posting engine.
---

# Fixed Assets is wired to the accounting engine

`artifacts/api-server/src/routes/fixed-assets.ts` posts to the GL using the shared
posting infra (no bespoke ledger code):

- Acquisition: `POST /fixed-assets` → `postAutomaticEntry` (`asset.acquisition`),
  `sourceType "fixedAsset"`; `DELETE` reverses.
- Depreciation: `/asset-depreciations/:id/post` → `postAutomaticEntry`
  (`asset.depreciation`), `sourceType "assetDepreciation"`; `/reverse` + `DELETE`
  reverse. The expense entry carries the asset's branch + cost center (fetched
  from the asset, since the depreciation row has neither).
- Disposal: `/asset-disposals/:id/approve` → multi-line `postAutomaticLines` via
  the `postDisposalEntry` helper, `sourceType "assetDisposal"`; `DELETE` reverses.

## Disposal entry shape (the non-obvious part)

Built in integer cents from the **asset's** `acquisitionCost` + `accumulatedDepreciation`
and the disposal's `proceeds`; gain/loss is the residual `proceeds - (cost - accum)`:
Dr Cash (proceeds), Dr Accumulated Depreciation (accum), Cr Property & Equipment
(gross cost), and Cr Gain **or** Dr Loss for the residual. Always balances by
construction (only nonzero lines emitted).

**Why:** a single account_mapping only holds a debit+credit pair, but disposal needs
5 accounts. They are sourced from three mappings: `asset.disposal` (debit=Cash,
credit=P&E), `asset.disposal.gainloss` (debit=Loss, credit=Gain), and the
**Accumulated Depreciation account is reused from `asset.depreciation`'s credit slot**
(it is the same 1220 account by definition).

**How to apply:** `postAutomaticLines` throws loudly (closed period, unusable account),
so `postDisposalEntry` must stay best-effort: it pre-checks every mapped account
(company match + isPostable + not deleted) and `return`s early when any is unusable
or mappings are missing — mirroring `postAutomaticEntry`'s own guard — so a
misconfigured company still approves the disposal and just skips GL. The approve
handler still wraps the tx in try/catch for `PostingError` to surface true hard
failures (e.g. closed fiscal period) as a clean status code, not a 500.

## Seed additions (completing the COA, not duplicating)

`DEFAULT_ACCOUNTS`: 1220 Accumulated Depreciation (asset/credit, parent 12),
5050 Depreciation Expense, 4040 Gain on Disposal, 5060 Loss on Disposal.
`DEFAULT_MAPPINGS`: `asset.acquisition` (1210/2010), `asset.depreciation` (5050/1220),
`asset.disposal` (1010/1210), `asset.disposal.gainloss` (5060/4040). seedAccounting
stays idempotent by company+code / company+eventKey.
