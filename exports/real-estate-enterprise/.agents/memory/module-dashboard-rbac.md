---
name: ERP module dashboard RBAC convention
description: Why per-module /xxx/dashboard endpoints are authenticated-only (no requirePermission) in artifacts/api-server.
---

# Module dashboard endpoints are auth-only, not permission-gated

Per-module dashboard routes (`/procurement/dashboard`, `/construction/dashboard`,
`/engineering/dashboard`, `/finance/dashboard`, `/realestate/dashboard`,
`/inventory/dashboard`) are guarded by `requireAuth` at the router level but
deliberately have **no** `requirePermission(...)`. Only `/accounting/dashboard`
adds a permission guard (`accountingReports.view`).

**Why:** The established convention (5 of 7 module dashboards) is that KPI summary
endpoints are readable by any authenticated user; granular RBAC lives on the CRUD
routes. New modules are built to mirror the Procurement module exactly, which
follows this auth-only dashboard pattern.

**Two naming families, two conventions — pick by the closest sibling:**
- Nested `/<module>/dashboard` (procurement, construction, engineering, finance,
  realestate, inventory) → **auth-only** (no `requirePermission`).
- Top-level `/<module>-dashboard` (customer-service-dashboard, handover-dashboard,
  fixed-assets-dashboard, general-admin-dashboard) → **permission-gated** with a
  representative module's `*.view` (e.g. general-admin-dashboard uses
  `administrativeTasks.view`).

**How to apply:** match the naming family of the dashboard you are adding. A new
top-level `*-dashboard` should gate with `requirePermission("<repr-module>.view")`;
a new nested `/<module>/dashboard` stays auth-only. Do not blindly "mirror
Procurement" for a top-level `*-dashboard` — that would diverge from its siblings.
