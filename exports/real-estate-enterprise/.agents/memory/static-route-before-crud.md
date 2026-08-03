---
name: Static route before CRUD :id
description: Static sub-paths sharing a CRUD resource prefix must be registered before the generated /:id route or they get shadowed and 500.
---

A static collection route (e.g. `GET /contract-templates/token-catalog`) registered
AFTER the generic `registerCrud` loop is shadowed by the generated `GET /<resource>/:id`
route — Express matches `:id = "token-catalog"`, the handler does a uuid row lookup,
and Postgres throws `invalid input syntax for type uuid` → 500 (not 404).

**Why:** Express matches routes in registration order; the param route `/:id` is greedy
for any single segment. The `registerCrud` factory registers all `:id` routes in one
loop, so anything added textually below it loses.

**How to apply:** Register static same-prefix routes BEFORE the `registerCrud` loop (or
before the specific CRUD registration). Routes with an extra trailing segment
(`/<resource>/:id/timeline`, `/preview`, `/print`) are safe — `/:id` can't match two
segments — which is why those worked while the bare `/token-catalog` 500'd.
