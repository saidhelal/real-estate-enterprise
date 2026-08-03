---
name: API backend performance
description: Response compression + Drizzle index conventions for the ERP API server.
---

# API backend performance

## Response compression
- `compression()` is wired in `artifacts/api-server/src/app.ts` (after pino-http,
  before cors/json). Verify with `curl -H "Accept-Encoding: gzip" -D -` →
  `Content-Encoding: gzip`. Covers all JSON list/report responses.

## Pagination is already server-side
- `lib/serialize.ts` `pageParams()` parses page/pageSize and **caps pageSize at 200**
  (default 25). Don't add a second pagination scheme — reuse `pageParams`.

## Drizzle indexes
- Schema tables had ZERO indexes originally. Add them via the pgTable third-arg
  callback returning an array:
  `pgTable("t", {..cols}, (t) => [ index("t_x_idx").on(t.colA, t.colB) ])`.
- Import `index` from `drizzle-orm/pg-core`. Apply with `pnpm --filter @workspace/db
  run push` (drizzle-kit push, additive — creates new indexes, safe on dev data).
- The universal hot pattern in this app is `WHERE company_id=? AND is_deleted=false`,
  so a composite `(company_id, is_deleted)` index is the highest-value index per table.
- The lead-distribution engine aggregates lead_assignments / leads(open by status) /
  lead_conversions by user — those got `(assignee/converter, is_deleted)` + leadId
  indexes specifically to kill its per-agent stat scans.
