---
name: Approval-workflow status integrity
description: Guardrails for multi-step approval state machines (Sales->Finance->Legal contracts) so clients can't skip gates and units can't be double-claimed.
---

# Approval-workflow status integrity

For a record whose lifecycle status is the authorization boundary (e.g. a sales
contract: draft -> pending_finance -> finance_approved -> active), the status
must be owned exclusively by the server-side transition handlers — never set by
the client at create/update.

**Rules:**

- On create, hard-override `status` to the initial state (`{ ...parsed.data, status: "draft" }`).
  Stripping it from the schema is not enough if the insert spreads the parsed body;
  force it at the insert. Verified by smoke test: POST with `status:"active"` still
  yields `draft`.
- Any "live claim" guard (which records hold a unit/resource) must include **every
  pre-terminal status**, not just the first and last. Centralize the list
  (`LIVE_CONTRACT_STATUSES = ["draft","pending_finance","finance_approved","active"]`)
  and reuse it in all guards (reservation-create AND contract-create). Otherwise a
  unit can be double-claimed while a contract sits in an intermediate status.
- Side-effect rows created at draft time (e.g. the Legal Affairs `legal_contracts`
  registry row) must be born non-active (`status:"draft"`) and only promoted when the
  final approval handler runs — creating them `active` marks the deal binding before
  the workflow completes.
- SLA/escalation notifications should union the *acting* audience and the *originating*
  audience (financeApprove + create), de-duplicated; owners with `"*"` are already
  covered by either permission.

**Why:** a prior architect review FAILED these exact four points (status injection,
incomplete live-claim set, premature legal activation, narrow escalation audience).
All transitions stay permission-gated with row-lock + in-tx recheck.

**Gotcha:** the workflow action route paths use hyphens, matching the OpenAPI
kebab-case keys: `/contracts/:id/finance-approve`, `/legal-approve`,
`/submit-to-finance` — NOT slash-segmented (`/finance/approve`). Calling the wrong
shape 404s. (See route-path-casing.)
