---
name: Unit status derivation & sales side effects
description: units.unitStatusId is derived from the strongest live claim; sales lifecycle handlers must recompute it, never set it ad hoc.
---

# Unit status is derived, not authored

`units.unitStatusId` must always reflect the strongest live claim on the unit, resolved by `recomputeUnitStatus(tx, unitId)` (in `artifacts/api-server/src/lib/integrations.ts`): an **active** contract → `sold` (wins); an in-progress contract (`draft`/`pending_finance`/`finance_approved`) → `pending_sale`; else an active/confirmed **reservation** → `reserved`; else `available`. It writes only on change and is best-effort (skips if the unit or the company's `unit_statuses` code row is missing). `pending_sale` is the unit "lock" while a sale is mid-workflow — it only becomes `sold` at Legal activation, and a cancellation frees it back to `available`.

**Why:** before this, reservation/contract create/cancel/transfer left unit status stale (e.g. a unit with an active contract still showing `available`). Status is a projection of contracts+reservations, so any handler that hand-sets a status code drifts from reality.

**How to apply:**
- Any handler that creates/cancels/deletes/moves a reservation or contract must wrap in a tx and call `recomputeUnitStatus` for every affected unit id (old+new on a unit change; both ends of a unit transfer).
- Never set `unitStatusId` directly to model a sale step — change the contract/reservation and recompute.
- A contract claim outranks a reservation, so reserving a unit that already has a contract correctly stays `sold` (verified).

# Sales availability is status-only (no publish flag)

There is NO `salesAvailable`/`sales_available` flag — it was removed end-to-end (DB column, OpenAPI Unit/UnitInput/UnitUpdate, POST /units auto-publish logic, and all CRM/Sales/reservation/data-entry frontends). A unit appears in CRM/Sales **iff its status code is `available`**; any other code auto-hides it. Frontend filters key on the status code string `"available"` only.

**Why:** dual-source drift — a unit could be `available` by status but unpublished by flag (or vice-versa). Status is the single source of truth.

**How to apply:** to temporarily hide an otherwise-available unit, set a business-hold status (below) — never re-introduce a publish boolean.

# Manual lifecycle overrides survive recompute

These unit statuses are explicit user actions, NOT derived: `delivered`, `blocked`, `maintenance`, `cancelled`, plus the business holds `marketing_hold`, `management_hold`, `legal_hold`, `internal_reservation` (`MANUAL_UNIT_STATUS_CODES` in integrations.ts). `recomputeUnitStatus` reads the unit's *current* status code (left-joins `unit_statuses`) and returns early if it's one of these — so a stray reservation/contract change can't silently flip a held/delivered/blocked unit back to available/reserved/sold. Pass `{ force: true }` to bypass.

The holds exist specifically to hide an available unit from sales without selling/reserving it (replacing the old publish flag). They are seeded per-company in `UNIT_STATUS_CATALOG` (seed.ts, EN/AR labels).

The lifecycle action is `POST /units/{id}/status` (operationId `setUnitStatus`, body `{ statusCode }`, gated by `units.update`): any override/hold code is set directly (looked up in `unit_statuses` by code, 400 if not configured for the company); `available` is a *release* that calls `recomputeUnitStatus(tx, id, { force: true })` to re-derive (may resolve to reserved/sold if a live claim exists). UI: `UnitStatusRowAction` dropdown on the Units page (overrides + a "Hold (hide from sales)" group + Release).

**Why:** the seed provisions 7 statuses but derivation only ever produced 3; without preservation the 4 manual states were only assignable by editing a unit and any recompute wiped them.

**How to apply:** when adding new derived call sites, the early-return already protects overrides; to add a new manual/terminal/hold status, append its code to `MANUAL_UNIT_STATUS_CODES` (integrations.ts), the `UNIT_STATUS_CATALOG` (seed.ts), the `UnitStatusChange` enum in openapi.yaml (then regenerate), and the `UnitStatusRowAction` UI list. Regenerating after an enum change: orval cleans the output folder first, so `lib/api-client-react/src/generated/api.ts` is briefly absent — Vite "Failed to load generated/api.ts" pre-transform errors mid-codegen are transient; restart the web workflows after codegen finishes to clear the stale module graph.

# Single-claim invariant must be enforced by unit, not just by reservation

A unit may carry at most one live contract. The direct `/contracts` create guards this by `unitId` against `LIVE_CONTRACT_STATUSES`, but `reservations/:id/convert` originally checked only for an existing contract by `reservationId`. Since direct-create does NOT mark the reservation `converted`, a direct-create followed by converting the still-active reservation would mint a second live draft contract on the same unit. The convert handler now also checks live-contract-by-`unitId` (inside the tx, after locking the reservation) and 409s.

**Why:** spec requires "no other salesperson may start another sale for the same unit"; the by-reservation check alone did not cover the mixed direct-create + convert path.

**How to apply:** any new path that mints a contract must enforce the single-claim guard by `unitId` (not just reservationId) inside the write transaction. (Checks are still pre-tx in create handlers, so true concurrent races would need a DB partial-unique index for full safety — not yet added.)

# Legal Affairs auto-registration

`ensureLegalContractForContract(tx, contract)` creates a `legal_contracts` registry row (idempotent per `sourceModule='sales' + sourceId=contract.id`) and back-links `contracts.legalContractId`. Called on contract create and reservation→contract convert. Never repoint the canonical contract FKs — the registry points back via source fields only (see legal-affairs-registry).

# Lifecycle-log endpoints must validate the canonical target first

`POST /contract-cancellations` and `POST /unit-transfers` mutate the contract FIRST (status flip / unit repoint via `.returning()`), and only insert the log row if a live contract was actually affected — else set a `conflict` sentinel and respond 404 after the tx. Inserting the log row before validating produced orphan records with no canonical change.
