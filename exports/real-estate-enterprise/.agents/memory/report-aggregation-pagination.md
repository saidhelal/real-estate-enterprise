---
name: Report aggregation pagination
description: Client-side report/total pages must page through all rows because the server caps pageSize.
---

The list endpoints' `pageParams` helper hard-caps `pageSize` (currently 200) and silently ignores larger values. A report page that requests a big `pageSize` (e.g. 500) to "get everything in one call" will silently aggregate only the first capped page, producing financial totals that are wrong at scale with no error.

**Why:** the cap is server-side and invisible to the client; the request still returns 200 with a truncated `data` array, so the bug is silent.

**How to apply:** for any page that sums/aggregates across a whole dataset (reports, dashboards computed client-side), loop pages using the generated raw `listX` functions inside a `useQuery` queryFn until `accumulated.length >= res.total`, instead of relying on one large-pageSize request. Prefer a server-side aggregation endpoint when the dataset is large.
