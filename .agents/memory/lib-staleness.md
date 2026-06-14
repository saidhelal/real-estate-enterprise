---
name: Lib declaration staleness
description: Composite lib declarations must be rebuilt before artifact typecheck
---
`lib/*` are composite TS packages that emit declarations. After adding/changing exports (e.g. new Drizzle tables/types in `lib/db`), artifacts typecheck against STALE `.d.ts` and report TS2305 "has no exported member" for things that clearly exist in source.

**Rule:** run `pnpm run typecheck:libs` (tsc --build) before `pnpm --filter @workspace/<artifact> run typecheck`.
