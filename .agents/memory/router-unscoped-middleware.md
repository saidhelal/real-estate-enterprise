---
name: Router-level middleware must be path-scoped
description: Unscoped router.use(requirePermission(...)) on a prefix-less mounted router silently breaks RBAC for every router mounted after it.
---

A sub-router registered with `router.use(requireAuth)` / `router.use(requirePermission("x.view"))` (NO path argument) applies that middleware to EVERY request that reaches it — not just that module's own routes.

In `routes/index.ts` the sub-routers are mounted WITHOUT path prefixes
(`router.use(biRouter)`, not `router.use("/bi", biRouter)`). So an unscoped
permission check inside one router intercepts all routers mounted after it,
returning spurious 403s for any user lacking that one permission.

**Why:** bi.ts did this with `bi.view`. Every module mounted after biRouter
(documents, notifications, master-data, ...) demanded `bi.view`. It stayed
latent for a long time because superadmin's `"*"` permission bypasses all
checks — it only surfaced when a module was first tested with a scoped
(non-superadmin) role.

**How to apply:** When adding module-wide auth/permission middleware in a
sub-router that is mounted prefix-less, ALWAYS scope it to the module path:
`router.use("/bi", requireAuth)` and `router.use("/bi", requirePermission("bi.view"))`.
Per-route guards (`router.get("/x", requirePermission(...))`) are inherently
scoped and fine. Always smoke-test new RBAC with a non-superadmin role, since
`"*"` masks this class of bug.
