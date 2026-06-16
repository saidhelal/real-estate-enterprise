---
name: ERP web layer conventions
description: How the React/Vite ERP UI handles RBAC, CRUD pages, and non-CRUD lifecycle endpoints.
---

The ERP web UI does **not** gate CRUD controls by user permission. Every CRUD
page (cost-centers, journal-entries, cheques, profit-centers, etc.) renders
create/edit/delete via the shared `ResourceManager` and relies entirely on the
backend returning 403. Authorization is enforced server-side only.

**Why:** consistency — introducing permission-driven UI hiding on only a couple
of pages would diverge from every other page and create a false sense that the
UI is the access-control boundary. The backend is authoritative (see
rbac-enforcement.md). Bespoke privileged-action pages (e.g. year-end
close/reopen) may additionally hide buttons via `user.permissions` as
defense-in-depth, but this is optional, not the app-wide pattern.

**How to apply:** for a new CRUD page, follow cost-centers.tsx and pass the
generated `useList/useCreate/useUpdate/useDelete` hooks to `ResourceManager`; do
not add `useAuth` permission checks unless the page has bespoke high-risk
lifecycle buttons.

**Non-CRUD lifecycle endpoints have no generated hooks.** `customFetch` is not
exported from `@workspace/api-client-react`. Call action endpoints (cheque
status transition, fiscal-year year-end-close/reopen) with plain
`fetch(url, { method, credentials: "include", headers, body })` using relative
`/api/...` paths — cookies are sent automatically, no Authorization header.

**TanStack Query options need an explicit `queryKey`.** When passing a second
options arg to a generated `useList*` hook (e.g. to set `enabled`), you must also
pass `queryKey: getList<Entity>QueryKey(params)` or typecheck fails (the option
type requires it).
