---
name: Orval request-body naming collision
description: How to name OpenAPI request-body component schemas so Orval codegen doesn't emit duplicate exports.
---

Orval derives a request-body symbol from the operationId (e.g. operation `recordReportExport` → server zod schema `RecordReportExportBody`, client body type from the referenced component schema). If you also name the request-body **component schema** with that same derived name, api-zod emits a duplicate export and codegen/typecheck breaks.

**Rule:** name request-body component schemas as plain nouns (e.g. `ReportExportInput`, `AccountInput`), never `Create*Body` / `*Body` matching the operationId-derived name.

**Why:** the operationId-derived `*Body` symbol and a same-named component schema collide in the generated zod barrel.

**How to apply:** when adding a POST/PATCH with a request body, pick a noun for the `components.schemas` entry; the server-side zod validator will still be `<OperationId>Body` and the client body type will be the noun schema.

Also: `OkResponse` (and similar response component schemas) are emitted as **TS types only** in api-client-react/api-zod, not as zod values. Don't `OkResponse.parse(...)` on the server — just `res.json({ success: true })`, matching the existing route convention.
