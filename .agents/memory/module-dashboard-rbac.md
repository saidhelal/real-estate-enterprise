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

**How to apply:** When adding a new module dashboard, mirror Procurement —
`router.get("/<module>/dashboard", async ...)` with router-level `requireAuth`,
no `requirePermission`. A code reviewer may flag this as broken access control;
it is an intentional, consistent codebase convention, not a defect. If a module's
KPIs are genuinely sensitive, gate it like accounting did (dedicated `*.view`
permission + seed entry) rather than leaving it inconsistent.
