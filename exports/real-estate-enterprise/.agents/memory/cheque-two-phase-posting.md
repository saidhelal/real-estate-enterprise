---
name: Two-phase cheque posting
description: How cheque lifecycle auto-posts accounting across collection and clearing legs without double-posting.
---

Cheque auto-posting uses two independent legs distinguished by `sourceType`, so the per-`(sourceType, sourceId)` idempotency of `postAutomaticEntry` lets both coexist on one cheque:

- **Collection leg** (`sourceType "chequeCollection"`, event `cheque.*.collection`) posts when the cheque enters a collecting status (under_collection/deposited): incoming Dr "Cheques Under Collection" (1050) / Cr AR (1030); outgoing Dr AP (2010) / Cr "Cheques Payable" (2030).
- **Clearing leg** (`sourceType "cheque"`, event `cheque.*.cleared`) posts on cleared: incoming Dr Bank (1020) / Cr 1050; outgoing Dr 2030 / Cr Bank (1020).
- On `cleared`, ensure the collection leg exists first (paths that skip under_collection still balance), then post clearing. Net effect equals the original single-leg Bank↔AR / AP↔Bank.
- On `returned`/`cancelled`, reverse BOTH source types (no-op for a leg never posted).

**Why:** "extend, don't rebuild" — the bridge accounts model real cheque float (in-transit) while keeping the end state identical to the prior single-entry posting; distinct sourceTypes are what prevent double-post while allowing two entries per cheque.

**How to apply:** when re-seeding an existing install, reconcile the pre-existing `cheque.*.cleared` mappings to the bridge accounts (seed has a targeted UPDATE block). Lifecycle transitions are also enforced server-side via an ALLOWED_TRANSITIONS matrix in `routes/cheques.ts` (returns 409), not only in the UI.
