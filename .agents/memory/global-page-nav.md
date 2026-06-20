---
name: ERP global page navigation
description: How the cross-app breadcrumb/back/home bar works and what to update when adding routes.
---

# Global page navigation (ERP)

A single `PageNav` component (`artifacts/erp/src/components/layout/page-nav.tsx`) is rendered once inside `AppShell`'s `<main>` above `{children}`, so every authenticated page gets a back button, breadcrumb (Home > Section > Page), a permanent Home button, and a "back to section" button — without editing individual pages. It is intentionally hidden on `/` (the executive Home is the breadcrumb root and the Home button's destination).

**Source of truth:** breadcrumbs/section are derived from `NAV_GROUPS` in `app-shell.tsx`. `NAV_GROUPS` is passed to `PageNav` as a **prop** (not imported) to avoid an app-shell↔page-nav circular import.

**How to apply when adding a route:**
- Add the route to the correct `NAV_GROUPS` group so it gets a Section + Page crumb automatically. The section landing = the group's first item href.
- If a route is authenticated but deliberately NOT in `NAV_GROUPS` (e.g. `/change-password`), add it to `FALLBACK_LABELS` in `page-nav.tsx` so it still shows a page crumb.
- New crumb/button strings live as `nav.*` keys in `language-provider.tsx` (EN + AR must stay in parity).

**Why prop over import:** an earlier version imported `NAV_GROUPS` from `app-shell` into `page-nav`, creating a circular dependency that worked but was fragile under HMR/refactor. Passing it as a prop removes the cycle.

## Two-level nesting (parent module → collapsible sub-groups)

The sidebar + `PageNav` were originally single-level (group → items). To nest a parent module with collapsible sub-groups (e.g. one "Finance & Accounting" parent containing Accounting/Tax/Budgets/... sub-groups), a `NavGroup` carries an optional `subGroups: NavSubGroup[]` and an empty top-level `items: []`. **Three surfaces must traverse `subGroups`, or pages silently vanish from nav/breadcrumbs:**
1. `openGroups` init in `AppShell` — open both the parent AND the active sub-group on load.
2. `NavLinks` renderer — render a second-level collapsible per sub-group (share one `renderItem` helper). `toggleGroup`/`openGroups` are keyed by `titleKey`, which must stay globally unique across parents + sub-groups.
3. `page-nav.tsx` `findNav` + `PageNavGroup` type — walk `subGroups[].items`; use the sub-group `titleKey` as the breadcrumb section and its first item href as `sectionHref`.

**Gotcha — forms-printing double-add:** `FORMS_MODULE_BY_GROUP` auto-appends a `/forms-printing/<module>` item to a group's `items`. For a nested parent (whose top-level `items` is `[]`), do NOT keep the parent in that map — instead hardcode the forms-printing item inside a dedicated sub-group, or it appears zero/duplicate times.

**Why:** add `subGroups` typing up front (annotate `RAW_NAV_GROUPS: NavGroup[]`) so the optional field doesn't make array-element inference a union that errors on `.subGroups` access.
