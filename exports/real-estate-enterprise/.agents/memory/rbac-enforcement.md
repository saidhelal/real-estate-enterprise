---
name: RBAC enforcement
description: Authorization is per-route, not global; authentication alone is not authorization.
---

`requireAuth` only proves *who* the caller is. Authorization must be applied
per-handler with `requirePermission("<module>.<action>")` (mounted after
`requireAuth`). A permission set containing `"*"` bypasses the check.

**Why:** A router that mounts `router.use(requireAuth)` and nothing else lets
*any* authenticated user perform every CRUD action on that resource — broken
access control. This was shipped on one router (companies) while every sibling
router had checks, and only a per-route 403 smoke test caught it.

**How to apply:**
- When adding a route, add `requirePermission(...)` to the handler, and when
  adding a whole router, audit every method (GET/POST/PATCH/DELETE) — it is easy
  to cover most handlers and miss one.
- Verify with a smoke test using a role-less user (no permissions): privileged
  routes must return 403, while authentication-only routes (dashboard, /auth/me)
  return 200. Do not rely on the super-admin path alone — `"*"` masks missing
  checks.
- Account state (inactive/locked/deleted) must be re-checked on every
  authenticated request and on token refresh, not only at login, or a disabled
  user keeps working until their access token expires.

**Granular actions beyond CRUD:** high-risk lifecycle endpoints must get their
own permission codes, not be folded under generic `update`. Posting/approving/
reversing journal entries and closing/reopening fiscal periods use dedicated
codes (`journalEntries.post|approve|reverse`, `fiscalPeriods.close|reopen`). The
seed's permission generator carries an optional `extraActions` per module so
these codes are registered alongside the standard view/create/update/delete set.
**Why:** gating a financially irreversible action behind a broad `update` lets
any role that can merely edit a draft also post or reverse it. The super-admin
`"*"` path masks this — only a non-`*` role test exposes it.

**Registering a dedicated code is not enough — the handler must reference it.**
A common mistake: seed `extraActions: ["submit","approve","reject"]` registers the
codes, but the route still guards with a broader sibling (e.g. submit checked
`leaveRequests.update`, reject checked `leaveRequests.approve`). The dedicated
permission is then dead — silently bypassed for anyone holding the broader one.
When adding a lifecycle route, confirm its `requirePermission(...)` string equals
the `${module}.${action}` you registered, not a near neighbor.

**Lifecycle status must be unsettable through generic create/update paths.**
Registering `extraActions` and dedicated action routes is still bypassable if the
generic POST/PATCH mass-assigns `status` from the request body (`...parsed.data`)
and the input schema exposes `status` as writable. Two leaks to close together:
- PATCH: reject (403) any body that sets a privileged status (e.g. approved/
  rejected/resolved/posted/reversed) — force callers to the action endpoint.
- POST (create): overwrite `status` server-side to the initial state (pending/
  open/draft) regardless of payload, and null out lifecycle timestamps
  (approvalDate/resolvedAt). Otherwise a user with only `*.create` can create a
  record already in a privileged state.
**Why:** mass-assignment escalates state without the extraAction permission. The
PATCH guard alone is insufficient — the create path is the quieter hole.
**How to apply:** also strip privileged options from the UI status `select` so the
form cannot submit a value the server will 403; lifecycle transitions belong on
dedicated action buttons/endpoints, not the edit form.
