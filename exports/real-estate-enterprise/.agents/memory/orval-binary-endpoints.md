---
name: Orval binary endpoints
description: Orval does not emit a hook for binary octet-stream GET operations
---

Orval skips generating a React Query hook for an OpenAPI GET whose only
success response is `application/octet-stream` (binary stream). The path is
still documented in the contract, but no `useXxx` hook appears in the
generated client.

**Why:** A contract-first file-serve endpoint (e.g. `GET /documents/{id}/file`,
`getDocumentFile`) was added to satisfy a contract-first review finding;
codegen ran clean (typecheck:libs passed) but no hook was generated.

**How to apply:** Model binary file endpoints in OpenAPI for documentation/
contract completeness, but consume them via a same-origin URL helper
(`documentFileUrl(...)` building `/api/documents/:id/file?...`) used in
`<a href>` / `<img src>`, not via a generated hook. Don't chase a missing
binary hook — it won't be emitted.
