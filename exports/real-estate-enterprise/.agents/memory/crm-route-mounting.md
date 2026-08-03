---
name: CRM/module route mounting & lead conversion side effects
description: Non-obvious feature-router mounting (no path prefix) and what lead conversion must do atomically
---

- Feature routers mount with **no path prefix** (`mountModule` just calls `router.use(mod)`; its `name` arg is for status/readiness tracking only). So a router's real URLs are the paths it declares internally under the main `/api` router — CRM is at `/api/leads`, `/api/lead-conversions`, etc., **not** `/api/crm/...`. **Why:** curling the intuitive `/api/<module>/...` 404s and looks like the module is unmounted when it isn't. **How to apply:** confirm a route's real URL from the OpenAPI `paths:` keys, never from the mountModule name.

- Lead→customer conversion must apply all side effects in ONE transaction, after validating (with row locks) that both lead and customer exist and belong to the request's company — fail 404 and roll back otherwise. The side effects: set the lead to a terminal/converted status so it leaves open-lead/distribution queries, and re-point the lead's dual-scoped history rows (`lead_activities` + `lead_follow_ups`, nullable leadId/customerId) onto the new customer. **Why:** without company-bound predicates this is a cross-tenant/IDOR mutation; without the history re-point the customer profile loses all prior interactions. **How to apply:** any lead-retirement path (lost/merge/etc.) should follow the same validate-then-atomic-side-effects shape.

- The dev API server does not reliably hot-reload route edits — restart the api-server workflow before curl-verifying backend changes, or you test stale code (endpoint returns success but new side effects are absent).
