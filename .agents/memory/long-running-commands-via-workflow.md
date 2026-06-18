---
name: Long-running commands via temporary workflow
description: How to run codegen/typecheck/seed commands that exceed the bash 120s limit and get reaped when backgrounded.
---

Some repo commands exceed the agent bash tool's 120s ceiling AND cannot be reliably backgrounded: `nohup setsid` / detached children get SIGKILL'd (no exit line, partial output) even though they are actively using CPU and memory is plentiful. Observed worst offender: orval `api-client-react` (react-query, split mode, prettier) target — the `zod` target finishes under ~115s but the react-query target needs longer and dies every time from bash. Cold `tsc -p ... --noEmit` for a large leaf artifact can also exceed 120s.

**Rule:** run such commands inside a *temporary workflow*, not via bash.
**Why:** workflows are Replit-managed long-running processes that survive past the bash-call lifecycle and are not reaped mid-run; bash-spawned background processes are.
**How to apply:**
1. `configureWorkflow({ name: "tmp-xyz", command: "<cmd> && echo DONE_SENTINEL", outputType: "console", autoStart: true })` (no waitForPort for one-shot commands).
2. Poll `getWorkflowStatus({ name })` every ~15s until `state === "finished"`/`"failed"` or the sentinel appears in `output`.
3. `removeWorkflow({ name })` when done.
This is how the full `pnpm --filter @workspace/api-spec run codegen` (both orval targets + typecheck:libs) and a cold api-server typecheck were completed after every bash attempt was killed.

Note: the `read` tool can serve a *stale cached* view of a file mid-session (reported an old, shorter length after the file had grown). Trust `wc -l` / `grep` / `sed` over a suspicious `read` result, then re-read.
