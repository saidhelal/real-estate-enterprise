---
name: Session refresh-on-401 (web)
description: Cookie-JWT web clients must refresh the access token transparently on 401 in the shared mutator, or short access tokens silently force logout.
---

# Transparent session refresh on 401

The cookie-JWT auth issues a short-lived access token + a long-lived rotating
refresh token. The web client must renew the access token on its own; otherwise
every request 401s once the access token expires and the user is bounced to
`/login` even though they never logged out.

**The rule:** the shared orval mutator (`customFetch`) owns refresh-on-401, not
each page. On a 401 from a non-auth endpoint it runs a registered refresher once,
then replays the original request once. Apps register the refresher
(`setTokenRefresher`) pointing at their own refresh endpoint (ERP → `/api/auth/refresh`,
portal → `/api/portal/refresh`).

**Why:** auth-provider's `useGetCurrentUser` has `retry:false` and redirects to
`/login` on any error. With no client-side refresh, the 15-minute access token
expiry == effective logout. Diagnosis signature: the workflow log shows EVERY
endpoint returning 401 (not just one feature) over a long window — that is a
logged-out/expired session, not a per-feature bug. (This is also why a working
AI assistant "fails": `POST /api/ai/conversations` 401s before reaching the
provider; the OpenAI integration env vars were present and fine.)

**How to apply / invariants:**
- Dedupe concurrent refreshes with a single shared in-flight promise — the
  refresh token ROTATES, so overlapping refresh calls race and revoke each other.
- Prevent loops: gate the retry on an `allowRefresh` flag (off on replay) and
  skip auth lifecycle URLs (`/(auth|portal)/(refresh|login|logout)`).
- The governance `x-change-reason` header is consumed before the first attempt;
  capture it and re-apply it on the replay or a governed DELETE/PATCH that 401s
  mid-action loses its reason and can 400.
- Replay rebuilds the request from the original input+options (orval passes the
  body as a string, so this is replay-safe); a consumed `Request` stream body
  would not be.

**Recovering the super admin:** the documented default credentials (see
`replit.md`) can drift; re-run `pnpm --filter @workspace/api-server run seed`
(idempotent) to reset the super-admin password to that documented default and
clear lockout. A login returning "Invalid username or password" (not "locked")
means the account is unlocked but the password differs — do not brute force
(5 attempts → 15-min lockout).
