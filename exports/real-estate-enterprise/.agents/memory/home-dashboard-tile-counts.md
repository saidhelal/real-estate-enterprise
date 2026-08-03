---
name: Home dashboard tile counts
description: How the Home page module tiles get live counts and how to pick the representative field
---

# Home dashboard tile counts

The Home page (`artifacts/erp/src/pages/home.tsx`) module tiles show a live count per
module by reusing the **per-module dashboard endpoints** the sidebar dashboard pages
already use — via the generated `useGet*Dashboard` hooks plus the matching
`getGet*DashboardQueryKey(params)`.

**Why:** reusing the same endpoint + query key means Home and the sidebar pages share
the same React Query cache entry, so they always display the *same data* from the *same*
source (no duplicate aggregation endpoint). Scope every dashboard hook by
`companies?.[0]?.id` with `enabled: !!companyId` — there is no company switcher, so all
pages use companies[0]; not scoping would make Home diverge from the module dashboards.

**How to apply:**
- Show a loading skeleton until company scope + data resolve. Never fall back to a
  hardcoded 0 — a genuine 0 (empty module) is fine, but a placeholder 0 while data is
  still loading violates the "don't show zero when records exist" rule.
- When choosing the single representative count field for a tile, pick one that is
  non-zero whenever the module has *any* records. Customer Service uses `complaints`,
  not `totalEscalations`, because escalations can be 0 while complaints/other CS records
  exist (which would wrongly render 0 for a populated module).
