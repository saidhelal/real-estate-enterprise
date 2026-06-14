---
name: Auth model
description: How auth and date serialization work across server and web
---
Auth is cookie-based JWT: `erp_access` (15m) and `erp_refresh` (7d, rotated, sha256-hashed in `sessions`). The generated web `customFetch` sends same-origin cookies automatically — never add an Authorization header on web; a 401 means logged out and the auth provider redirects to /login.

Generated Zod (Orval) emits `z.string()` for date fields, so server presenters MUST convert DB `Date` objects to ISO strings before `.parse()`. `date`-mode columns (calendar days) stay as `YYYY-MM-DD` strings.

Lockout: 5 failed logins → status `locked` + 15-min `lockedUntil`.
