# Real Estate ERP

An enterprise back-office ERP for a real-estate holding company: authentication, RBAC, organizational structure (companies/branches/fiscal years/currencies), document numbering, audit trail, and system settings. Bilingual Arabic/English (RTL/LTR) with dark/light themes.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (uses workflow-provided PORT)
- `pnpm --filter @workspace/api-server run seed` — bundle + run the DB seed (idempotent)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run typecheck:libs` — rebuild composite lib declarations (run after editing `lib/*`)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks + Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `SESSION_SECRET`

Seeded super admin: username `superadmin`, password `Admin@123456`. Re-running the seed resets this account's password to the default (and clears any lockout), so it is always recoverable.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (cookie-based JWT auth)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec) → React Query hooks + Zod
- Web: React + Vite, shadcn/ui, wouter, TanStack Query

## Where things live

- API contract (source of truth): `lib/api-spec/openapi.yaml`
- DB schema: `lib/db/src/schema/*.ts` (barrel `index.ts`) — all tables UUID PK, `isDeleted` soft-delete, `isActive`, timestamps
- Generated hooks: `@workspace/api-client-react`; generated Zod: `@workspace/api-zod`
- Server: `artifacts/api-server/src/` — `lib/auth.ts` (JWT/cookies/password), `lib/access.ts` (user+roles loader), `lib/audit.ts`, `lib/presenters.ts` (row→API mappers), `middleware/auth.ts`, `routes/*`
- Web: `artifacts/erp/src/` — `lib/auth-provider.tsx`, `lib/language-provider.tsx` (EN/AR + RTL), `components/theme-provider.tsx`, `pages/*`

## Architecture decisions

- Auth is cookie-based JWT: `erp_access` (15m) + `erp_refresh` (7d, rotated, hashed in `sessions`). The web `customFetch` sends same-origin cookies automatically — no Authorization header. A 401 means logged out.
- Generated Zod date fields are `z.string()`, so presenters convert DB `Date` → ISO string before responding. `date` columns (calendar days) stay `YYYY-MM-DD` strings.
- Account lockout: 5 failed attempts → status `locked` + 15-minute `lockedUntil`. Login/refresh/logout tracked in `sessions` + `login_history`.
- RBAC: roles hold a `permissions` string array; `"*"` grants all. Every privileged route is guarded by `requireAuth` then `requirePermission("<module>.<action>")` (e.g. `companies.create`); `"*"` bypasses the check. Permission codes are `${module}.${action}` for actions view/create/update/delete. High-risk lifecycle actions get dedicated codes beyond CRUD via the seed's per-module `extraActions`: `journalEntries.post|approve|reverse` and `fiscalPeriods.close|reopen` — so posting/reversing an entry or closing a period cannot be performed by a role with only generic `update`. The dashboard and `/auth/me` only require authentication. The Super Administrator role is seeded with `["*"]` and `isSystem` (cannot be deleted).
- Account state is enforced on every authenticated request, not just at login: `loadAuthUser` (used by `requireAuth`) and `/auth/refresh` reject deleted/inactive/locked users, and refresh revokes the session — so disabling or locking a user takes effect immediately even with an unexpired access token.
- Audit trail: every mutating route calls `recordAudit` (best-effort, never blocks the request).
- Accounting (double-entry): `lib/posting.ts` builds/validates balanced entries (debit=credit, integer-cent math via `toCents`/`fromCents` — no float), numbers them, guards closed fiscal periods, and posts/reverses transactionally. Reversal posts a mirror entry (swapped sides, `sourceType: "reversal"`) and flips the original to status `reversed` — the original's lines are kept, not deleted.
- Reversal-aware reports: all ledger aggregations go through `accountBalances` (and the cash-flow queries) which filter `status IN ('posted','reversed')`. Counting only `posted` would exclude a reversed original while still counting its mirror, leaving a phantom balance; create+reverse must net back to baseline. Entry-status *count* metrics on the dashboard stay `status = 'posted'`.
- Automatic posting: business events (receipts, treasury/bank transactions, installment collections, reservation payments, contracts) call `postAutomaticEntry` on create (resolves an `account_mappings` event key → debit/credit account) and `reverseAutomaticEntriesForSource` on delete, inside the originating transaction. Both are best-effort (skip cleanly if accounting is unconfigured) and idempotent per `(sourceType, sourceId)` so retries/double calls cannot overstate balances.

## Product

Super-admin console: dashboard, user/role/permission management (RBAC), companies/branches/fiscal-years/currencies + exchange rates, document number sequences, audit logs, login history, and system settings. Bilingual (AR/EN, RTL/LTR) and themable (dark/light). No emojis in the UI.

## User preferences

- No emojis anywhere in the UI.
- The user originally asked for Next.js/Prisma; this workspace is a pnpm monorepo (Express + Drizzle + React/Vite), so the stack was adapted (agreed with the user).

## Gotchas

- After editing any `lib/*` package, run `pnpm run typecheck:libs` before typechecking artifacts — stale composite declarations cause "no exported member" errors.
- The seed cannot run via raw `node` (the schema barrel uses directory imports Node's ESM resolver rejects). Use the `seed` script, which bundles with esbuild (`--format=cjs`) first.
- Do not change the OpenAPI `info.title` — it controls generated filenames.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
