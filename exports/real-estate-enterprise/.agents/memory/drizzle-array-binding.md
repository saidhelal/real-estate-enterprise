---
name: Drizzle array binding in raw sql
description: Why raw sql`col = any(${array})` fails and what to use instead
---

Raw `sql\`${table.col} = any(${arr})\`` mis-binds a JS array in drizzle-orm (node-postgres): it emits `= any(($1))` and passes the array's first element as a scalar, so the query throws "Failed query" at runtime — but typechecks fine.

**Why:** drizzle interpolates a JS array into a single placeholder rather than expanding it for the `any()` array form, producing an invalid bind.

**How to apply:** for "id IN (list)" lookups use the helper `inArray(table.col, arr)` (import from `drizzle-orm`), guarded by a non-empty check (`arr.length ? ... : []`). This bit the AR/AP aging customer/supplier name enrichment — only triggered once a party had a posted balance, so empty-result smoke tests passed and hid it. Always exercise the non-empty path.
