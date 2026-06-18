---
name: Executive Oversight module
description: Read-only cross-department KPI console pattern (no new tables, GET only)
---

# Executive Oversight

A read-only ERP module that surfaces real-time KPIs for every department by aggregating
existing module tables. It introduced NO new DB tables and NO write endpoints.

**Rule:** when a request asks for a cross-department "oversight/monitoring/KPI" view, build it
as ONE `GET /executive-oversight/dashboard` returning a generic shape
`{ generatedAt, departments[] -> { key, kpis[] -> { key, value, kind, tone } } }`.
Reuse the EXACT aggregate query patterns from each per-module dashboard handler (money via
`coalesce(sum(col),0)::text`, counts via `count(*)::int`, soft-delete `isDeleted=false`,
optional `companyId` scoping). Do not invent new status literals — mirror the source module's.

**Why:** keeping it a single read endpoint with no schema change satisfies the hard
no-duplication / read-only constraint and avoids drift from the canonical per-module dashboards.

**How to apply:** gate with `requireAuth` + `requirePermission("executiveOversight.view")`;
add the module to the seed MODULES list (view-only, no extraActions) and grant `.view` to
General Manager; frontend renders departments/kpis generically with i18n keys `eo.dept.*` /
`eo.kpi.*` and tone→color mapping. KPI keys are shared across departments (e.g. contractValue),
so a flat `eo.kpi.<key>` namespace is fine.
