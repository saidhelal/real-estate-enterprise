---
name: Enterprise AI & BI layer
description: How the AI layer is grounded, scoped, and wired into the ERP web + API without new business tables.
---

# Enterprise AI & BI

The BI module was extended (not replaced) into "Enterprise AI & BI". Only the BI group display label changed (`nav.group.business_intelligence` EN/AR); all BI routes/pages/APIs/DB stayed intact. **Why:** the task required keeping BI fully functional; the nav group `titleKey` must stay `nav.group.business_intelligence` because `FORMS_MODULE_BY_GROUP` keys off it.

## Grounding & scope (authorization is the hard part)
- The AI grounds only on a server-built, permission-scoped aggregate snapshot — never row-level PII — so it can never surface data the user couldn't already read. No new business-data tables (only `conversations`/`messages` for chat).
- **Gate authorization at the metric level, not the domain level.** A "domain" (e.g. sales) bundles metrics that each map to a *distinct* module permission (contracts/reservations/leads; finance bundles cash/bank/AR/AP; HR bundles employees/departments/**payroll**). Granting a whole domain off any one permission leaks sibling metrics (a code-review REJECT: `employees.view` should NOT expose payroll). **How to apply:** check each metric against its own `*.view`; treat `"*"` and `"bi.view"` (the cross-module BI dashboard grant) as broad grants.
- **Company scope comes from `req.authUser.companyId`, never the request body.** Company-bound users are pinned to their own company; only an unassigned user (companyId null, e.g. super admin) may filter / see all. **Why:** the legacy BI list routes trust client `companyId`; the AI must not, or it becomes a cross-company exfiltration path.

## Module coverage (every department, not a subset)
- For the assistant to "summarize every authorized department," `buildErpContext` must have a domain block for EVERY ERP module — a missing block silently drops that module from the snapshot AND from the `domains` list sent to the model, so it looks like the user "lacks permission." Each new module/table needs its own block gated per-metric. **How to apply:** when a new module is added, add a matching grounding block; verify a `"*"` user's snapshot enumerates it.
- **Scope only columns that exist.** Some tables have no `companyId` (roles, companies=tenant-root) or neither `companyId` nor `isDeleted` (`audit_logs`, append-only). Push `eq(isDeleted,false)`/`eq(companyId,…)` filters only when the column is real, or you get runtime/type errors.
- **Date filters on `timestamptz` must use day bounds, not the bare `YYYY-MM-DD` string.** `createdAt <= '2026-06-21'` means midnight-start and drops same-day rows; use `>= from::date` and `< (to::date + interval '1 day')`.

## Provider + model selection (admin-swappable)
- Provider AND model are admin-selectable via `ai.provider` / `ai.model` system settings (`settings` table, category `ai`). `resolveAiProvider()` / `resolveAiModel()` in `ai-provider.ts` read them per-call with safe fallbacks (env `AI_PROVIDER`/`AI_MODEL` → `openai`/`gpt-5`) on empty/missing/unknown/DB-error, so a bad row can never take the assistant offline. `aiConfigured()` is **async** (resolves the selected provider, then checks its env) — call sites must `await` it.
- All providers go through the Replit AI integrations proxy, which is **OpenAI-compatible**. A provider in the `AI_PROVIDERS` allowlist is just an env prefix (`AI_INTEGRATIONS_<PROVIDER>_BASE_URL`/`_API_KEY`); the client is `new OpenAI({baseURL, apiKey})`, built lazily + cached. Adding a provider = one allowlist entry + provisioning its integration; no route change.
- **Boot safety:** import the raw `openai` SDK at top level (it does NOT throw on import) and build clients lazily — do NOT import the `@workspace/integrations-openai-*` wrapper package, which throws at import when its env vars are unset and would crash the server on boot.
- **Backfill:** GET `/settings` idempotently upserts the required AI rows (`REQUIRED_SETTINGS`, `onConflictDoNothing`) so the controls appear on deployments provisioned before the rows existed (seed only runs on demand). Never overwrites an admin-set value.
- The settings page renders a provider dropdown and a model dropdown whose options are conditioned on the selected provider (OpenRouter = free-form text input; the current/seeded value is always preserved as an option).

## Frontend wiring (durable gotchas)
- **SSE chat is manual fetch, not codegen.** `fetch("/api/ai/conversations/:id/messages", {credentials:"include"})`, read `res.body.getReader()`, split on `\n\n`, parse `data:` lines → `{delta}` / `{error}` / `{done:true}`. The root-absolute `/api` path is correct (proxy routes `/api` regardless of the erp base path; generated `getSendAiMessageUrl` returns the same).
- **Generated react-query list hooks need an explicit `query.queryKey`** (e.g. `getListAiMessagesQueryKey(id)`) or typecheck fails — same as the rest of the erp app.
- A shared `AiAnalysisPage` serves all 8 generative features via a `useMutationHook` prop. Type that prop **structurally** (`{mutate, data?, isPending, isError}`), not as `UseMutationResult<…>`, to avoid error-type (`ApiError` vs `unknown`) variance failures across the different generated hooks.
