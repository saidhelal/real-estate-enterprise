---
name: ERP standalone module scaffold
description: The end-to-end wiring points for adding a whole new top-level module to the Real Estate ERP, modeled on the General Administration (GA) module.
---

# Adding a standalone ERP module

A new top-level module (e.g. Insurance Management) is wired across these surfaces, in order. The **General Administration (GA)** module is the canonical template to copy — find its analogues by grepping `general_admin` / `correspondence`.

1. DB: new `lib/db/src/schema/<module>.ts` (UUID PK, `isActive`/`isDeleted`/timestamps, employees referenced by plain `employeeId` uuid — **no FK**), export from barrel, `push`, `typecheck:libs`.
2. OpenAPI: List/Create/Get/Update + paths per entity + a `<Module>Dashboard` schema; run codegen.
3. master-data: add labels for any **new** enum option codes in `lib/master-data/src/index.ts` (then `typecheck:libs`). Fallback shows the raw code, so missing labels only hurt the non-English side.
4. RBAC seed: add the module(s) to the seed `MODULES`; run the `seed` script. Per-module `/<module>-dashboard` endpoints are **auth-only by convention** (no `requirePermission`).
5. Server route `routes/<module>.ts`: `registerCrud` per entity + custom create/delete for finance-posting entities (`postAutomaticEntry` / `reverseAutomaticEntriesForSource`, idempotent per `(sourceType,sourceId)`, best-effort); mount in `routes/index.ts`.
6. Pages: one `ResourceManager` page per entity (fields + columns, `enumOptions`/`enumLabel`, `companyId = companies?.[0]?.id`); read-only **report** pages reuse the entity's hooks with `canCreate/canEdit/canDelete={false}`. `ResourceField` has no `placeholder`; `FieldType` = text|textarea|number|money|date|select|boolean.
7. App.tsx: import + `<Route>` per page.
8. app-shell.tsx: add a `NAV_GROUPS` entry `{ titleKey: "nav.group.<module>", items: [...] }` using already-imported lucide icons.
9. home.tsx: add a tile to `MODULES`. **A new `countKey` must be added to BOTH the `CountKey` union AND the `counts` Record literal in the same edit** or the artifact typecheck fails. Wire its `useGet<Module>Dashboard` hook like the others.
10. i18n: add EN and AR keys in `language-provider.tsx` for every `nav.*`, `nav.group.*`, `home.mod.*`, and dashboard `t()` key — both language objects must stay at parity.

**Why:** these ten surfaces are independent files; missing any one yields a silently broken module (404 route, blank nav, untranslated key, or a typecheck failure from the CountKey/counts pair).

**Governance gotcha for personal/soft-delete modules:** the global `governanceMiddleware` parks EVERY `DELETE /<resource>/:id` as a pending change_request (400 "A reason is required..." without a reason header). For a personal inbox / per-user soft-delete module (e.g. notifications, where delete = move to own trash, restorable), add its `/<resource>` prefix to `EXEMPT_PREFIXES` in `artifacts/api-server/src/middleware/governance.ts` so delete/restore work directly without approval. Only do this for resources that are genuinely per-user and recoverable — not shared business data.
