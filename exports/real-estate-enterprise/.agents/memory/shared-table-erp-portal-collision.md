---
name: Shared-table ERP/portal OpenAPI collision
description: How to add ERP staff-side CRUD over a DB table the customer portal already exposes in the OpenAPI spec without clobbering portal-generated names.
---

When the ERP needs its own CRUD surface over a table the portal already owns in
`lib/api-spec/openapi.yaml` (e.g. `complaints`, `maintenance_requests`,
`support_tickets`), the portal already defined schemas + operationIds for that
entity. Adding a second unprefixed copy collides (Orval derives filenames/hook
names from operationId; duplicate schema keys overwrite).

**Rule:** prefix ONLY the ERP copies — schemas `Cs<Entity>` and operationIds
`listCs<Entity>` / `createCs<Entity>` / etc. Leave the portal's originals
unprefixed. Truly new entities with no portal owner stay unprefixed
(callLogs, workOrders, customerSatisfactionSurveys).

**Why:** keeps portal's generated client (`listComplaints`, …) intact while the
ERP gets its own (`listCsComplaints`, …); both coexist in `@workspace/api-client-react`.

**How to apply:** range-sed the prefix onto the ERP block of the spec only;
never touch `info.title` (controls generated filenames). After codegen, the ERP
type/hook names are `CsComplaint`/`useListCsComplaints`; new-table names are bare.

**registerCrud factory:** the api-server customer-service router uses one generic
`registerCrud({ base, module, entity, table, searchCols, filterCols, listResp,
createBody, getResp, updateBody })` helper to mount list/create/get/update/delete
for every entity. `table` is typed `any` (eslint-disabled); Drizzle's return type
under `any` is a non-iterable union, so cast each awaited query result to
`Record<string, unknown>[]` before indexing — destructuring `const [row] = …`
fails to typecheck otherwise (TS2488). Each route still gets its own
`requirePermission(`${module}.<action>`)`; numeric columns serialize as strings
via the shared `serializeRow` (matches generated `z.string()` fields).
