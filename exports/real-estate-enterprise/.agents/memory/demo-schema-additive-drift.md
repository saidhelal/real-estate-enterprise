---
name: Demo schema additive-column drift
description: Why a new column from db push is missing in Testing Mode, and how to backfill it without wiping demo data
---

Adding a column (db push to `public`) does NOT propagate to the Testing-Mode `demo` schema for tables that already exist.

**Why:** demo provisioning mirrors tables with `CREATE TABLE IF NOT EXISTS demo.<t> (LIKE public.<t> INCLUDING ALL)` (see `artifacts/api-server/src/lib/demo.ts`). The `IF NOT EXISTS` means an already-created demo table is never re-shaped, so new columns are skipped. Result: requests in Testing Mode 500 with `column "<x>" does not exist` while production (`public`) works fine.

**How to apply:** to add an additive column to an existing demo table while preserving demo data, run `ALTER TABLE demo.<table> ADD COLUMN IF NOT EXISTS <col> <type>;` directly (via executeSql). The destructive alternative `resetDemo()` drops+recreates the demo schema (re-syncs all drift) but wipes demo data. Always verify a schema change against BOTH schemas when QA runs in Testing Mode.
