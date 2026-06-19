---
name: ERP route code splitting
description: How the ERP (artifacts/erp/src/App.tsx) lazy-loads its ~300 page modules and caches lookup data.
---

# ERP route code splitting & query caching

`App.tsx` registers ~300 routes. To keep startup fast, every page is loaded via
`React.lazy(() => import("@/pages/..."))` and the inner `<Switch>` (inside
`<AppShell>`) is wrapped in a single `<Suspense fallback={<RouteFallback/>}>`.

- **Eager (startup) pages only:** `Login`, `Home`, `Dashboard`. Everything else is
  lazy and loads on first navigation. Keep this list tiny — adding eager imports
  re-bloats the initial bundle.
- **Named-export pages** (e.g. `AiChatPage`, `AiAnalysisPage`) need the `.then`
  form: `lazy(() => import("@/pages/x").then((m) => ({ default: m.AiChatPage })))`.
  Plain `lazy(() => import(...))` only works for default exports.
- **Wouter + lazy:** `<Route component={LazyComp} />` works as long as a Suspense
  boundary is an ancestor. The boundary wraps the inner Switch, not each Route.

## Lookup/query caching
- The single `queryClient` in App.tsx sets `staleTime` (5m) + `gcTime` (30m) and
  `refetchOnWindowFocus:false`, `retry:false`. This caches lookup/dropdown data so
  re-opening a page doesn't refetch, which also cuts re-render churn.
  **Why:** dropdowns (lookup-values, branches, sources, etc.) are near-static within
  a session; default staleTime 0 caused a refetch on every mount.
