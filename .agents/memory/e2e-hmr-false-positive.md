---
name: e2e HMR false positives
description: Blank-panel e2e failures during concurrent edits are usually Vite HMR, not real bugs
---

A failing e2e run that reports a "completely blank panel / no rows" on ONE page
while the API returns 200 is, in this repo, most often a Vite HMR reload firing
mid-test — not a real rendering bug.

**Why:** Editing a file (e.g. app-shell.tsx) while an e2e test is running
triggers `[vite] hot updated` / `server connection lost. Polling for restart`,
which can leave the page momentarily blank exactly when the test asserts.

**How to apply:** Before chasing a single-page blank-render failure, check the
browser console log for a `server connection lost` / `hot updated` entry inside
the test's time window and confirm there is NO JS/React error. If so, stop
editing, let the build settle, and re-run that page in isolation before
treating it as a bug.
