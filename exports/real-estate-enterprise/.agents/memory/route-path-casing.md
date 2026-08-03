---
name: Route paths must match OpenAPI/client casing
description: camelCase Express route paths typecheck but 404 because the generated client calls kebab-case.
---

Express route paths are plain strings, so `router.get("/installmentPlans", ...)` compiles
and `pnpm run typecheck` passes — but the Orval-generated client calls the path declared in
`openapi.yaml` (kebab-case, e.g. `/installment-plans`). Mismatched casing → every CRUD page
for that entity 404s at runtime even though types are green.

**Why:** the OpenAPI spec is the source of truth for both the client paths AND the server's
expected paths, but nothing enforces the server router strings against the spec. Permission
codes (`installmentPlans.view`) stay camelCase; only the URL path must be kebab-case.

**How to apply:** when adding/renaming routes, make the router path string exactly match the
OpenAPI `paths:` key. Smoke-test new endpoint families with curl through `localhost:80/api/...`
(not just the special endpoints) — typecheck will not catch a path-casing mismatch.
