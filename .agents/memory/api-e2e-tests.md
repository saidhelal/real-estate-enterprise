---
name: API e2e tests
description: How the vitest API e2e suite runs and stays isolated from production data.
---

The api-server e2e suite (`artifacts/api-server/test/`) drives the **real built
server** over HTTP, and runs entirely inside the demo schema so production data
is never touched.

**How it works:**
- A vitest `globalSetup` builds the server (`node build.mjs` → `dist/index.mjs`),
  spawns it on a free port (env `PORT`, plus the ambient `DATABASE_URL` /
  `SESSION_SECRET`), waits for `/api/healthz`, and exposes the base URL via
  `E2E_BASE_URL`. Teardown SIGTERM→SIGKILL.
- Tests use a tiny cookie-jar client (`test/client.ts`) because Node `fetch`
  does not persist cookies. The flow is: login as `superadmin` → `POST
  /api/testing/enter` (sets `erp_testing`, routes every query to the demo
  schema + elevates the session to super-admin) → `POST /api/testing/reset`
  (re-seed) in `beforeAll`.

**Why:** spawning the production-built artifact avoids the ESM directory-import
pitfall that breaks importing the app under a raw node loader, and Testing Mode
gives a throwaway, structurally-mirrored sandbox so the suite never mutates
`public`.

**How to apply / gotchas:**
- `test/` is outside the api-server tsconfig `include: ["src"]`, so test files
  are not part of `pnpm typecheck` (vitest transpiles them).
- List response shapes differ: `/companies` returns a **bare array**; most
  paginated lists return `{ data, total, page, pageSize }`.
- Create-unit input validation **requires** `projectId`/`buildingId` even though
  the server re-derives them from `floorId` — include them or you get a 400.
- The seed `reset` takes several seconds; `beforeAll` and hooks have a 120s
  timeout and `fileParallelism: false`.
