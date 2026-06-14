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
