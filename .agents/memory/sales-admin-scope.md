---
name: Sales Administration page scope
description: What the /sales-administration console may and may not contain.
---

The Sales Administration page (`crm-sales-administration.tsx`, route `/sales-administration`) is a PURE operational CRM console.

It contains ONLY: Lead Distribution, Team Monitoring, Employee Performance KPIs, Follow-up Monitoring, Available Units (link to `/available-units` which owns the "Start Sale" action), Reports, Alerts, Role Permissions. Built exclusively from CRM/ops hooks (leads, lead-assignments, lead-follow-ups, users, units).

It MUST NOT show contract management, finance approval, legal workflow, cheque processing, or accounting. Those live in the Finance/Legal modules and the contract workflow board (`crm-sales.tsx` via `contract-stage-actions.tsx` / `payment-cheque-manager.tsx`, finance-gated once the contract is active).

**Why:** the user explicitly rejected a finance/contract dashboard rewrite of this page; the only sales-side action here is starting a sale on an available unit, after which the workflow auto-flows Sales→Finance→Legal.

**How to apply:** when adding to Sales Admin, only add operational CRM surfaces; route any finance/legal/cheque action through its own module. Keep the "Available Units" KPI filter in lockstep with `/available-units` (unit status code `available` AND `salesAvailable`), or the count overreports.
