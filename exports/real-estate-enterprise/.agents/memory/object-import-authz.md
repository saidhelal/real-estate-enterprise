---
name: Object-storage import authorization (ERP)
description: How to authorize server-side .docx/object imports in the api-server; why canAccessObject does not work here.
---

# Authorizing object-storage imports (api-server)

Any route that accepts a client-supplied `fileObjectPath` and downloads/reads it
(e.g. contract-template `.docx` import, form-template import) MUST authorize the
path against the immutable owner mapping in `documentObjectOwnersTable`
(`objectPath` → `uploadedByUserId`). Look up the row by the *normalized* path and
reject (403) unless `uploadedByUserId === req.authUser.id`.

**Why:** Without it, any user holding the route's create permission can pass an
arbitrary `/objects/*` path and read unrelated private files (object-storage
IDOR). The path comes from the client and is forgeable.

**Why not `canAccessObject`:** The upload route (`POST /document-uploads`) mints
the URL and records the owner mapping but does **not** call `setObjectAclPolicy`.
So `getObjectAclPolicy` returns null and `canAccessObject` returns false for every
legitimately-uploaded object — using it would 403 the happy path. The owner
mapping is the real authorization source in this codebase, mirroring the portal
attachment-IDOR pattern.

**How to apply:** import `documentObjectOwnersTable` from `@workspace/db`, query
by `normalizeObjectEntityPath(body.fileObjectPath)` before `getObjectEntityFile`.
Note `form-templates.ts` import did NOT have this check (pre-existing gap) — copy
the legal.ts pattern if you touch it.
