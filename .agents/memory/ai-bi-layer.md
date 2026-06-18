---
name: Enterprise AI & BI layer
description: How the AI layer is grounded, scoped, and wired into the ERP web + API without new business tables.
---

# Enterprise AI & BI

The BI module was extended (not replaced) into "Enterprise AI & BI". Only the BI group display label changed (`nav.group.business_intelligence` EN/AR); all BI routes/pages/APIs/DB stayed intact. **Why:** the task required keeping BI fully functional; the nav group `titleKey` must stay `nav.group.business_intelligence` because `FORMS_MODULE_BY_GROUP` keys off it.

## Grounding & scope
- AI answers are grounded in a permission+company-scoped ERP snapshot built server-side (`lib/ai-context.ts`), gated by `DOMAIN_PERMISSIONS` (`"*"` or per-domain `*.view`). No new business-data tables — only `conversations`/`messages` for chat history.
- Every `/ai/*` route is guarded `requireAuth` then `requirePermission("ai.view")`. The frontend does NOT hide AI nav by permission (matches existing app convention — backend 403 is authoritative).

## Frontend wiring (durable gotchas)
- **SSE chat is manual fetch, not codegen.** `fetch("/api/ai/conversations/:id/messages", {credentials:"include"})`, read `res.body.getReader()`, split on `\n\n`, parse `data:` lines → `{delta}` / `{error}` / `{done:true}`. The root-absolute `/api` path is correct (proxy routes `/api` regardless of the erp base path; generated `getSendAiMessageUrl` returns the same).
- **Generated react-query list hooks need an explicit `query.queryKey`** (e.g. `getListAiMessagesQueryKey(id)`) or typecheck fails — same as the rest of the erp app.
- A shared `AiAnalysisPage` serves all 8 generative features via a `useMutationHook` prop. Type that prop **structurally** (`{mutate, data?, isPending, isError}`), not as `UseMutationResult<…>`, to avoid error-type (`ApiError` vs `unknown`) variance failures across the different generated hooks.
