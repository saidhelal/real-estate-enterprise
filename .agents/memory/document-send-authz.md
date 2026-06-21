---
name: Document send/transfer authorization
description: Why an internal "send document" feature must reuse EDMS read authz, not just its own send permission.
---

# Document send/transfer must mirror EDMS read authorization

A module-specific action permission (e.g. `documentTransfers.send`) authorizes the
*action*, not access to the *referenced resource*. A send/route/forward endpoint that
references a central document must additionally enforce the same document-read predicate
the EDMS detail/download routes use (`canSeeDocument(user, doc)` for the row check;
`documentScopeFilter(user)` for list SQL).

**Why:** Without it, anyone holding the send permission plus a document UUID can route
documents they are not allowed to see (owner/creator/scope/public-within-company rules),
bypassing document-level visibility. Caught in code review of the Send Document feature.

**How to apply:** In any handler that takes a `documentId` and acts on it, after the
company-scope check, call `canSeeDocument(req.authUser!, doc)` and 403 on failure. The
`*` and `documents.viewAll` permissions bypass it. The send route selects the full
document row, so all columns `canSeeDocument` needs (classification, ownerUserId,
createdByUserId, branchId, departmentId, projectId, companyId) are present.

Related: free-string contract fields (e.g. `priority`) should be clamped server-side to
an allowlist before persisting, since OpenAPI types them as plain `string`.
