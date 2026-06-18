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

## Provider robustness
- The OpenAI integration lib **throws at module import** when its env vars are unset. Import it **lazily** (dynamic `import()` inside the call), never top-level, or the whole API server crashes on boot when AI is unconfigured. Callers gate on `aiConfigured()` → 503 first, so the lazy import only runs when provisioned.

## Frontend wiring (durable gotchas)
- **SSE chat is manual fetch, not codegen.** `fetch("/api/ai/conversations/:id/messages", {credentials:"include"})`, read `res.body.getReader()`, split on `\n\n`, parse `data:` lines → `{delta}` / `{error}` / `{done:true}`. The root-absolute `/api` path is correct (proxy routes `/api` regardless of the erp base path; generated `getSendAiMessageUrl` returns the same).
- **Generated react-query list hooks need an explicit `query.queryKey`** (e.g. `getListAiMessagesQueryKey(id)`) or typecheck fails — same as the rest of the erp app.
- A shared `AiAnalysisPage` serves all 8 generative features via a `useMutationHook` prop. Type that prop **structurally** (`{mutate, data?, isPending, isError}`), not as `UseMutationResult<…>`, to avoid error-type (`ApiError` vs `unknown`) variance failures across the different generated hooks.
