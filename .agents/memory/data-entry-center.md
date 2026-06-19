---
name: Data Entry Center wizard
description: Scope + design constraints of the ERP guided bulk master-data wizard
---

# Data Entry Center (ERP)

A guided wizard page (`/data-entry-center`) that ONLY simplifies bulk entry into the
EXISTING master-data tables (projects → phases → buildings → floors → units) via the
EXISTING generated create hooks. Lives entirely client-side in
`artifacts/erp/src/pages/data-entry-center.tsx` + pure helpers in `lib/data-entry.ts`.

**Hard scope boundary (user-mandated):** master-data setup ONLY. It must NOT create
Reservations, Contracts, or Installments and must NOT touch the Sales workflow.
Marking a unit "sold" = just writing the chosen `unitStatusId` (existing unit_statuses
row). No new tables/columns/APIs/business logic — reuse everything.
**Why:** the user explicitly narrowed scope twice; sales lifecycle stays owned by the
Sales module. Do not re-add reservation/contract/installment calls here.

**Commit must be resumable.** Sequential create (project→phase→building→floor→unit)
records each created server id back onto the draft node (`serverId`, `committedProjectId`)
and persists partial progress to state/localStorage on failure, so a retry skips
already-created rows instead of replaying (which would duplicate phases/buildings).
**How to apply:** any future bulk-create wizard over parent→child chains needs the same
serverId-skip pattern; replay-from-top without it duplicates parents.

**Gotchas:** coerce optional int fields with `Number.parseInt` + `Number.isFinite`
guard (raw `Number("")`/`Number("x")` sends NaN and fails API validation late).
Pass the active `language` into every shared picker — hardcoding `"en"` breaks AR labels.
