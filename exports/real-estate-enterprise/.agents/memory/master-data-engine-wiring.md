---
name: Master Data engine wiring for ERP option sources
description: How module form/filter option sources and badge labels are wired to the Master Data lookup engine, and the rules for when a field may be wired.
---

# Wiring ERP option sources & labels to the Master Data engine

Two independent mechanisms make the ERP UI engine-aware:

- **Labels (badges/columns) — centralized, zero per-page edits.** A single
  `LookupLabelProvider` (mounted in `App.tsx` inside AuthProvider) paginates ALL active
  engine values and merges them into a runtime `ENGINE_LABELS` registry in
  `lib/enums.ts` (via `setEngineLabels`). `enumLabel`/`enumOptions` consult the registry
  engine-first, with the static `LABELS` as fallback. So every existing `enumLabel` call
  renders admin-renamed labels with no page change.
- **Option sources (form/filter selects) — per-page edits.** Convert a hardcoded
  `const X = enumOptions([...codes])` into
  `const { options: X } = useLookupOptions("type_code", [...codes])` (hook, inside the
  component). The fallback array is only used when the category is unseeded.

## `useLookupOptions` is engine-AUTHORITATIVE, not a union
When the category has live engine rows, the select shows EXACTLY the active
(non-archived) engine values — fallback codes are ignored. This is deliberate: it makes
admin **archival** take effect (an archived code disappears). An earlier union variant
(append fallback codes the engine lacks) was rejected because it silently
**re-added admin-archived values**, defeating admin control.

**Why:** archived values are absent from the `active=true,archived=false` fetch; if you
append fallback codes that aren't in the active set, you resurrect exactly the codes the
admin removed.

## Rule: only wire a field whose static codes are a SUBSET of the matching category
**How to apply:** before wiring `useLookupOptions("type_code", [...])`, confirm every
code in the array exists in that category's `valueCodes` (see
`lib/master-data/src/index.ts`). If the page has codes the seed lacks (e.g. reservations
`active`, employees `suspended`, legal `other` catch-alls, handover `done`), pure-replace
would DROP those options once seeded — a data regression — so **leave the field
hardcoded**. Likewise leave it hardcoded when there is no true matching category, or only
a cross-domain code overlap (e.g. `discount_type` codes `fixed/percentage` reused for a
salary "calculation type" or a "penalty type" — same codes, different concept). Audit
quickly by comparing each `useLookupOptions(type,[codes])` array against the seed
`valueCodes` map.

## Always stays hardcoded (documented)
Fixed status-machine enums: `journal_entry_status`, `account_normal_side`,
`fiscal_period_status`, `inventory_movement_type`. These are driven by code logic, not
admin-managed lists.
