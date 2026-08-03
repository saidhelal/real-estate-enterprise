---
name: Executive Oversight module
description: Read-only cross-department operations-room console pattern (no new tables, GET only, permission-tiered scope)
---

# Executive Oversight

A read-only ERP "operations room" that surfaces real-time KPIs for top management by
aggregating EXISTING module tables across ~11 sections (executive summary, time-windows
today/week/month, departments, projects, financial, sales, execution, HR, customer
service, insurance, critical alerts, executive event log). It introduced NO new DB
tables and NO write endpoints.

**Rule:** when a request asks for a cross-department "oversight/monitoring/operations-room"
view, build it as ONE `GET /executive-oversight/dashboard` returning a typed multi-section
shape `{ generatedAt, scope, summary, today, week, month, departments[], projects, financial,
sales, execution, hr, customerService, insurance, criticalAlerts[], eventLog[] }`. KPI items
are the generic `{ key, value, kind, tone }` (kind ∈ money/count/percent/hours; `tone` is
optional/nullable). Reuse the EXACT aggregate query patterns from each per-module dashboard
handler (money via `coalesce(sum(col),0)::text`, counts via `count(*)::int`, soft-delete
`isDeleted=false`, optional `companyId` scoping). Critical alerts / event log return KEYS +
counts (not full sentences) so the frontend localizes. The event log reads the audit trail.

**Why:** one read endpoint with no schema change satisfies the hard no-duplication / read-only
constraint and avoids drift from the canonical per-module dashboards.

**Money math:** never sum money with JS floats. Derived money (e.g. liquidity =
cashOnHand + bankBalance) must go through integer-cent helpers `toCents`/`fromCents` from
`../lib/money` (bigint). Raw single-column sums stay as their `::text` DB output.

**Permission tiers (two actions):** seed the module with `extraActions: ["viewOwn"]`. Gate the
route with `requirePermission("executiveOversight.view", "executiveOversight.viewOwn")` (any-of).
Owner/SuperAdmin (`"*"`) and General Manager (`.view`) → `scope.level="full"`; Department Manager
(`.viewOwn`) → `scope.level="department"`. Grant `.view` to General Manager and `.viewOwn` to
Department Manager in the seed.

**Known limitation (documented, intentional):** `viewOwn` currently changes `scope.level` only —
it is a labeling contract, NOT record-level dataset filtering. There is no org-department ↔
module-key mapping table, and the no-new-tables constraint forbids creating one. The frontend
surfaces a UI note (`eo.scope.department_note`) telling the department manager the view is
dept-scoped. True per-department filtering is a future task that requires a scope-mapping model.

**How to apply (frontend):** tabbed operations room, one tab per section; KPI grids; dept cards
with status badge + completion%/completed/overdue; projects atRisk table; alerts list; event-log
table. i18n keys live under `eo.*` (chrome via `t()`, EN/AR parity required); tone→color mapping.
No emojis (project-wide rule).
