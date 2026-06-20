---
name: Sales Administration nav visibility
description: Why the Sales Administration CRM nav item appeared "missing" and how it is made visible + role-gated.
---

The `/sales-administration` item lives in the CRM nav group (`RAW_NAV_GROUPS` → `nav.group.sales_crm`) in `app-shell.tsx`.

**Why it looked missing even though it was wired:** ERP sidebar groups are collapsible and default to COLLAPSED (only the group containing the active route auto-expands). The CRM group has ~12 items; the item was originally LAST, so on a short viewport it sat below the fold even after expanding. Also the Arabic label read "إدارة المبيعات" while the user expected "إدارة السيلز", so they did not recognize it.

**Fixes applied:** moved the item to the FIRST position in the CRM group; Arabic label is "إدارة السيلز" (EN "Sales Administration"); added role-gated visibility.

**Role gating:** nav visibility filters by role text — show if wildcard `*` OR roles match `/sales|admin|manager|owner|executive|director|مبيعات|سيلز|مدير|مالك|تنفيذي/`. Super admin (wildcard) always sees it. This is a deliberate exception to the usual "UI doesn't gate by permission" convention because the user explicitly asked for Sales-Admin-only visibility; backend remains authoritative for the route/actions.

**How to apply / verify:** "I don't see the menu item" complaints on this ERP are usually (a) the group is collapsed, (b) the item is buried in a long group below the fold, or (c) a label-name mismatch — not a missing route. Verify from the running UI by logging in as `superadmin`/`Admin@123456` and expanding the group; restart the `artifacts/erp: web` workflow first so the canvas iframe serves the fresh build (a stale iframe is a common false "missing" report).
