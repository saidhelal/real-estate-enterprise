---
name: ERP implicit active-company scope
description: Why ERP list pages can render empty ("لا توجد سجلات") even though data exists — no company switcher, all pages use companies[0].
---

The ERP web app has **no company switcher**. Every list page derives the active company as
`const companyId = companies?.[0]?.id;` (from `useListCompanies`) and passes it to the list hook.

**Why this matters:** An empty list page is almost always one of:
1. **Session expired** — `/companies` (and everything) returns 401, so `companies` is undefined,
   `companyId` is undefined, the list query is disabled/empty, and the page shows the empty state.
2. **Company scope** — `companies[0]` resolves to a company with no rows for that entity.
   `GET /companies` only returns non-soft-deleted companies ordered by `createdAt`.

**How to apply:** Before assuming data loss or "duplicate data sources", verify the DB and hit the
API directly (login → `GET /customers?companyId=<companies[0].id>`). Records stored with Latin names
(e.g. "Youssef Saeed Helal") will NOT match an Arabic ILIKE — search both scripts.

**Sales & Customers module:** the former "CRM hub" (dashboard/available-units/sales-performance/
global-search/customer-360, backed by `routes/crm-hub.ts` + `/crm/*` aggregation paths) was deleted.
Leads CRUD lives separately in `routes/crm.ts` and was kept. The single consolidated nav group is
`nav.group.sales_crm` → "Sales & Customers" / "المبيعات والعملاء" (entity pages only).
