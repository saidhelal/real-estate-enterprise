---
name: Auto document numbering
description: How ERP auto-generates entity codes (COM001, BR001, CON…) and how far it is wired.
---

# Auto document numbering

`artifacts/api-server/src/lib/doc-number.ts` exports `nextDocumentNumber(documentType)`: it reads the active row in `number_sequences` for that type, formats `prefix + zero-padded nextNumber`, increments the sequence, and returns the code (or `null` if no sequence configured — caller falls back).

- The `number_sequences` table is richly seeded (442 rows) and exposed via a full CRUD route (`routes/number-sequences.ts`) for admin override.
- As of this audit, `nextDocumentNumber` is only wired into **2** create paths: `sales.ts` (Contract) and `lib/integrations.ts` (LegalContract). Pattern: `parsed.data.code || (await nextDocumentNumber("X")) || fallback`.

**Why not rolled out everywhere yet:** most create routes' Zod/OpenAPI request bodies make `code` **required**, so auto-generation can't kick in without first making `code` optional in `lib/api-spec/openapi.yaml` and regenerating (`pnpm --filter @workspace/api-spec run codegen`). That's a contract change across ~36 routes — deferred to a focused task.

**How to apply:** to auto-number a new entity, (1) make `code` optional in the OpenAPI request schema + regenerate, (2) ensure a `number_sequences` row exists (seed it), (3) in the create handler use `parsed.data.code || (await nextDocumentNumber("<Type>")) || fallback` inside the originating transaction.
