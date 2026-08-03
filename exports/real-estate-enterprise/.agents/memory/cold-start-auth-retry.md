---
name: Cold/parallel-start auth retry
description: Why the SPA's initial current-user query must retry on API-not-ready but not on 401
---

# Initial auth check must survive a not-yet-ready API

**Rule:** The first request a Vite SPA makes on load is the current-user check
(`useGetCurrentUser` / `/auth/me`). It must **retry on transport failures**
(network error / 5xx — the proxy returns these while the API is still booting)
and must **not retry on a genuine 401** (authoritative "logged out" → go to
`/login`). Distinguish by the thrown `ApiError.status`: a network failure throws
a `TypeError` with no `.status`; only a real 401 has `status === 401`.

**Why:** Pressing **Run** boots every artifact workflow in parallel. Vite serves
the web app in ~1s but the API needs ~5s (esbuild bundle + DB connect). With
`retry: false` the very first `/auth/me` fails against the not-yet-listening API,
the auth provider redirects to `/login`, discards the still-valid session cookie,
and never retries — so the app looks "broken until manual restart." Starting the
API first (sequentially) hides the bug; parallel Run exposes it. This is an app
bug, not a workflow/`.replit` misconfiguration. The `.replit` `[workflows]` block
is intentionally empty here — artifact workflows are system-managed, not declared
there.

**How to apply:** In the auth provider's current-user query use a `retry`
predicate (`status === 401 → false`, cap ~6 attempts) plus exponential
`retryDelay`. While retrying, `isLoading` stays true so the redirect-to-login
effect won't fire prematurely. Any new SPA artifact (e.g. the portal) that gates
on an initial auth query needs the same treatment.
