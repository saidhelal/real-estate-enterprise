---
name: Orval query-param passthrough masks contract gaps
description: Why a query param can "work" end-to-end yet still be missing from the OpenAPI contract
---

Orval's generated `get<Op>Url` builders do `Object.entries(params || {}).forEach(...)` and append **every** key present on the params object to the URL — regardless of whether the key is declared in the generated `*Params` type.

**Consequence:** a query param that the server consumes and the client sends can work at runtime even when it is absent from `openapi.yaml`. Frontend callsites that spread the extra key (`...(cond ? { unassigned: "true" } : {})`) also bypass TS excess-property checks, so typecheck stays green. The gap is invisible until you read the spec.

**Why it matters:** this repo is contract-first (OpenAPI is the source of truth). A consumed-but-undeclared param is a real contract violation that code review will flag, even though nothing is "broken".

**How to apply:** when adding a new query filter, declare it in the OpenAPI path `parameters` and regenerate, so the `*Params` type and Zod schema are honest. Don't rely on the passthrough. To audit: grep server handlers for `qStr(q, "...")` / `req.query.X` and confirm each appears in the matching OpenAPI operation's parameters.
