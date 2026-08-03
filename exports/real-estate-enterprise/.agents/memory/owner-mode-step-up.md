---
name: Owner Mode (Elevated Access) step-up auth
description: How the ERP's owner-mode re-auth works; why it mirrors Testing Mode and is not in OpenAPI.
---

# Owner Mode / Elevated Access

A step-up (re-authentication) layer on top of the normal cookie-JWT session. Separate cookie
`erp_owner` (JWT `{owner:true}`, 15-min TTL). Endpoints under `/auth/owner-mode*`:
GET status `{active}`, POST `verify` (re-auths the SAME current user; requires the user's
permissions include `"*"`; sets the cookie; audits `owner-mode.enter`), POST `exit`
(clears cookie; audits `owner-mode.exit`). Logout also clears it.

**Why:** owner-only destructive/impersonation actions (View-As-User, etc.) need a short-lived
elevated proof distinct from the long-lived session — disabling it is instant (cookie clear) and
re-entry requires the password again.

**How to apply:** like Testing Mode, this is NOT in the OpenAPI spec — consume via plain
`fetch(..., {credentials:"include"})`, not generated hooks. Frontend: `owner-mode-provider.tsx`
(mirrors `testing-provider.tsx`, 15-min inactivity auto-exit on user-activity timer) + the
`OwnerModeControls` button/dialog in the app-shell header. Gate owner-only features on
`useOwnerMode().active` client-side AND re-verify the cookie server-side.
