---
name: API stability framework
description: Operational stability controls on the ERP API server and the isolation tradeoff in a bundled deploy.
---

# API stability framework

Operational (non-business) reliability controls on the Express API server:

- **Startup diagnostics** (`lib/startup.ts`) run before `app.listen`: validate
  required env + a real DB `SELECT 1`, with exponential-backoff retry so a DB
  that is briefly unavailable at boot recovers automatically.
- **Probes** (`routes/health.ts`): `/api/healthz` (stable OpenAPI contract,
  unchanged), `/api/livez` (process up), `/api/readyz` (DB + module-mount check,
  503 when unhealthy), `/api/metrics` (perf snapshot).
- **Metrics** (`lib/metrics.ts`): bounded in-memory counters + capped slow-request
  ring (no growth). Wired as the first middleware in `app.ts`.
- **Module isolation** (`lib/module-registry.ts` `mountModule`): each router is
  mounted in try/catch; status feeds `/readyz`.
- **Centralized 404 + error handler** in `app.ts` (after the router): Express 5
  forwards rejected async handlers here, so one handler's failure returns a clean
  500 instead of crashing the process.
- **Process safety nets** (`index.ts`): `uncaughtException`/`unhandledRejection`
  log then trigger **graceful shutdown** (close server + `pool.end()`, exit 1) so
  the supervisor restarts a clean process — do NOT keep serving from a possibly
  corrupt process.

## Isolation tradeoff (important)
**The server is bundled by esbuild into a single `dist/index.mjs`** and the route
**test files import `app` synchronously** (supertest). So module loading stays as
static top-level imports + guarded mounting — a full async dynamic-import refactor
would break the supertest bootstrap and gives no real isolation in a single-file
bundle. Guarded mounting isolates **mount-time and per-request runtime** faults;
**import-time** faults surface as build/startup failures and cannot be isolated.
Don't "fix" this by making the router async — it's a deliberate constraint.

**Why:** architect review flagged static imports as incomplete isolation, but the
bundled-deploy + synchronous-test-import realities make guarded mounting the
correct ceiling.

## Benchmark
`scripts/src/benchmark.ts` (`pnpm --filter @workspace/scripts run benchmark`):
logs in as seeded admin, measures p50/p95 vs per-endpoint budgets. NB: target
the dashboard at `/dashboard/summary` (no root `/dashboard` route exists).
