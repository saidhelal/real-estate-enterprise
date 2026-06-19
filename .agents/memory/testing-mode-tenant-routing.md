---
name: Testing Mode tenant routing
description: How per-session demo-schema isolation works and the requireAuth/ALS pin it depends on.
---

Testing Mode gives super admins a persistent, isolated "demo" Postgres schema in the
same instance as production (`public`). Reads/writes route to demo while a session
cookie is set; production is never touched.

## Mechanism
- `lib/db` exposes a `db` Proxy that resolves the active drizzle instance from
  AsyncLocalStorage (`runWithTenant(tenant, fn)`). Default/unknown context => production.
- Two pools, each pinned by connection `search_path`: production=`public`,
  demo=`demo,public`.
- The auth middleware sets the demo tenant for the request continuation only when the
  testing cookie is "1" AND the user holds `"*"`.

## The non-obvious gotcha (cost a debugging cycle)
Every ERP sub-router applies its OWN router-level `requireAuth` and they are all mounted
without a path prefix (`router.use(xxxRouter)`). So a request to any path passes THROUGH
many sub-routers' `requireAuth` before reaching the one that matches. The FIRST
`requireAuth` to run wraps the rest of the chain in `runWithTenant("demo", next)`, so a
later sibling router's `requireAuth` executes its `loadAuthUser` inside the demo tenant —
querying `demo.users` for a production user id and 401-ing with "User no longer exists".

**Rule:** identity always lives in production. Any auth/identity lookup in middleware must
be pinned explicitly: `runWithTenant("production", () => loadAuthUser(userId))`. Do not
rely on the ambient ALS context being production in middleware that can run after another
router's `requireAuth`.

**Why:** the multi-router `requireAuth` fan-out means ambient tenant context in middleware
is not guaranteed to be production even on the very first identity check of a request.

## Other notes
- Demo schema is provisioned with `CREATE SCHEMA demo` + `LIKE public.* INCLUDING ALL`,
  which omits FKs (acceptable; the seed inserts in dependency order). Structural drift is
  only re-synced on Reset (drop+recreate+seed).
- The seed exports `seedAll()`; CLI auto-run is gated behind `SEED_CLI=1` so the server can
  import and run it in-process under `runWithTenant("demo", seedAll)`.
- Testing routes are plain JSON (not in the OpenAPI contract): `/testing/status|enter|exit|reset`.
