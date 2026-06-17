---
name: Unit status derivation & sales side effects
description: units.unitStatusId is derived from the strongest live claim; sales lifecycle handlers must recompute it, never set it ad hoc.
---

# Unit status is derived, not authored

`units.unitStatusId` must always reflect the strongest live claim on the unit, resolved by `recomputeUnitStatus(tx, unitId)` (in `artifacts/api-server/src/lib/integrations.ts`): an active/draft **contract** → `sold` (wins), else an active/confirmed **reservation** → `reserved`, else `available`. It writes only on change and is best-effort (skips if the unit or the company's `unit_statuses` code row is missing).

**Why:** before this, reservation/contract create/cancel/transfer left unit status stale (e.g. a unit with an active contract still showing `available`). Status is a projection of contracts+reservations, so any handler that hand-sets a status code drifts from reality.

**How to apply:**
- Any handler that creates/cancels/deletes/moves a reservation or contract must wrap in a tx and call `recomputeUnitStatus` for every affected unit id (old+new on a unit change; both ends of a unit transfer).
- Never set `unitStatusId` directly to model a sale step — change the contract/reservation and recompute.
- A contract claim outranks a reservation, so reserving a unit that already has a contract correctly stays `sold` (verified).

# Legal Affairs auto-registration

`ensureLegalContractForContract(tx, contract)` creates a `legal_contracts` registry row (idempotent per `sourceModule='sales' + sourceId=contract.id`) and back-links `contracts.legalContractId`. Called on contract create and reservation→contract convert. Never repoint the canonical contract FKs — the registry points back via source fields only (see legal-affairs-registry).

# Lifecycle-log endpoints must validate the canonical target first

`POST /contract-cancellations` and `POST /unit-transfers` mutate the contract FIRST (status flip / unit repoint via `.returning()`), and only insert the log row if a live contract was actually affected — else set a `conflict` sentinel and respond 404 after the tx. Inserting the log row before validating produced orphan records with no canonical change.
