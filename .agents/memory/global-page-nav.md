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
