# Enterprise Stability Framework

Operational stability controls for the Real Estate ERP API server, modeled on
enterprise ERP reliability practices (SAP/Oracle style health, isolation, and
observability). All controls are additive and change no business logic.

## 1. Startup diagnostics

- `src/lib/startup.ts` → `runStartupDiagnostics()` runs before the HTTP server
  accepts traffic.
- Validates required configuration (`DATABASE_URL`, `SESSION_SECRET`, `PORT`).
- Verifies database connectivity with a real `SELECT 1`.
- Logs a per-check pass/fail report; aborts startup (exit 1) only on a hard,
  non-recoverable failure.

## 2. Health monitoring

Operational probes (mounted under `/api`):

- `GET /api/healthz` — basic health (stable OpenAPI contract, unchanged).
- `GET /api/livez` — liveness; process up + uptime. No external deps.
- `GET /api/readyz` — readiness; checks DB connectivity + module mount status.
  Returns `503` when any dependency is unhealthy so an orchestrator can hold
  traffic until the server is truly ready.

## 3. Performance monitoring

- `src/lib/metrics.ts` aggregates throughput, error rate, and latency
  (avg/max, status-class breakdown) plus a **bounded** ring of slow requests
  (>1000ms, capped at 50 samples — fixed memory).
- `GET /api/metrics` exposes a live snapshot including process memory (RSS,
  heap used/total).

## 4. Automatic recovery (recoverable startup failures)

- The startup DB check retries with exponential backoff (5 attempts, 0.5s →
  8s cap) so a database that is briefly unavailable at boot recovers
  automatically instead of permanently failing startup.

## 5 & 6. Module isolation + isolated module loading

- `src/lib/module-registry.ts` → `mountModule()` mounts each feature router in a
  try/catch. A failure mounting one module is logged and recorded but does not
  prevent the remaining modules from mounting.
- The centralized Express error handler (`src/app.ts`) contains per-request
  failures — a thrown or rejected handler in one module returns a clean `500`
  without crashing the process or affecting other modules.
- Process-level safety nets (`uncaughtException` / `unhandledRejection`) log and
  keep the server alive for errors outside the request lifecycle.

## 7. Module independence validation

- `getModuleSummary()` reports `total` / `mounted` / `failed`.
- `GET /api/readyz` surfaces module status at runtime; readiness is only `200`
  when `failed === 0`.
- Each module is a self-contained router mounted independently — none import
  another route module.

## 8. Performance benchmarks

- `scripts/src/benchmark.ts` (`pnpm --filter @workspace/scripts run benchmark`)
  logs in as the seeded admin and benchmarks representative endpoints, printing
  avg/p50/p95/max latency and pass/fail against per-endpoint budgets.

## 9. Enterprise stability checklist

- [x] Startup diagnostics validate config + dependencies before serving.
- [x] Liveness and readiness probes for orchestration.
- [x] Live performance + memory metrics endpoint.
- [x] Automatic DB-connection recovery with backoff.
- [x] Per-module mount isolation (one failure cannot take down the API).
- [x] Centralized request error handler (no process crash on handler error).
- [x] Process-level uncaught-error safety nets.
- [x] Graceful shutdown (drain connections, close DB pool on SIGTERM/SIGINT).
- [x] Bounded in-memory structures (no metrics-driven memory growth).
- [x] Response compression enabled.
- [x] Performance benchmark script with latency budgets.

## 10. Production readiness verification

1. `pnpm --filter @workspace/api-server run typecheck` — GREEN.
2. Restart the API workflow; confirm startup diagnostics pass in logs.
3. `curl localhost:80/api/livez` and `curl localhost:80/api/readyz` → healthy.
4. `curl localhost:80/api/metrics` → live snapshot.
5. `pnpm --filter @workspace/scripts run benchmark` → Overall PASS.
