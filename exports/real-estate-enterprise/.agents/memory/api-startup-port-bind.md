---
name: API startup port-bind resilience
description: Why the API died on workspace reopen until manual restart, and the EADDRINUSE retry fix.
---

# API "dead until manual restart" on workspace reopen

**Symptom:** After reopening the Replit workspace, the ERP often was not usable
until a manual workflow restart. The frontend (Vite) came up fast but API calls
failed; the API process had exited and nothing brought it back.

**Root cause:** `artifacts/api-server/src/index.ts` called
`app.listen(port, (err) => …)`. Node's `listen` callback is the `listening`
event and receives **no** error argument — that `err` branch is dead code. Bind
failures (notably `EADDRINUSE`) are emitted as an `error` event on the server.
With no `server.on('error')` handler, the error escalated to the registered
`uncaughtException` handler → `shutdown()` → `process.exit(1)`. The dev script
(`build && start`) does not auto-restart, so the API stayed down permanently.

**Why a port conflict happens at reopen:** the previous session's
`node dist/index.mjs` can still hold port 8080 while it drains — graceful
shutdown allows up to 10s. The new process tried to bind during that window,
hit EADDRINUSE, and gave up instead of waiting.

**Fix:** `startServerWithRetry(attempt)` — attach `server.once('error')`; on
`EADDRINUSE` retry `app.listen` (6 attempts, 2s apart) so the old process has
time to release the port; only `process.exit(1)` on a non-recoverable error or
after exhausting retries. `registerProcessHandlers` runs in the `listening`
handler so it only binds to the server that actually came up.

**Why:** controlled-recovery startup is good, but "exit on failure" only helps
if something restarts the process. In dev nothing does, so transient bind races
must be retried in-process rather than exiting.

**Not the cause (already handled):** DB-not-ready — `lib/startup.ts`
`runStartupDiagnostics` already retries the DB ping 5× with exponential backoff
before giving up. The API `dev` script rebuilds with esbuild (~2s) then runs the
bundle; that adds cold-start latency but is not the permanent-failure cause.
