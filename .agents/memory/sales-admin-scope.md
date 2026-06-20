---
name: Sales Administration page scope
description: What the /sales-administration operational console may and may not contain.
---

The Sales Administration page (`crm-sales-administration.tsx`, route `/sales-administration`) is the operational CRM/sales command console. It is exposed as a normal item in the CRM nav group (`RAW_NAV_GROUPS` → `nav.group.sales_crm`).

It contains operational CRM + sales-ops surfaces ONLY:
- Lead Distribution + Reassign Leads, Team Monitoring, Employee Performance KPIs, Follow-up Monitoring, Lead status distribution, Reports, Sales Permissions (→ `/roles`).
- Available Units (links to `/available-units`, which owns the per-unit "Start Sale" button).
- Active-sales SLA monitoring: read-only traffic lights (`trafficLight`/`isLiveStage`/`isManagerial` from `lib/sale-workflow.ts`), a managerial red-alert banner, and per-sale operational action buttons: View Workflow + Continue Sale (navigate to `/crm-sales`), and managerial-gated Cancel Sale (`useCreateContractCancellation`) and Reassign Salesperson (`useUpdateCustomer.assignedToUserId`).
- Unit Publishing Controls: toggle `units.salesAvailable` via `useUpdateUnit` (units are NOT in governance `PROTECTED_EDIT`, so the PATCH applies immediately).

It MUST NOT contain finance approval, legal workflow, cheque processing, or accounting MANAGEMENT — those live in the Finance/Legal modules and the contract workflow board (`crm-sales.tsx` → `contract-stage-actions.tsx` / `payment-cheque-manager.tsx`).

**Why:** the user first rejected a finance/contract *dashboard*, then explicitly asked for the sales-operational action set (Start/Continue/View Workflow/Cancel Sale [authorized]/Reassign Salesperson [admin]) and SLA traffic lights ON this page. The distinction the user draws is sales-*operations* (allowed here) vs finance/legal/cheque/accounting *management* (not here). Cancel Sale and Reassign Salesperson are sales-ops, not finance/legal.

**How to apply:** the architecture is frozen — do not redesign/rewrite this page. Add only operational CRM/sales surfaces; route finance/legal/cheque actions to their own modules. Managerial gating here is UI convenience; the backend (permissions + governance middleware) stays authoritative. Keep the "Available Units" KPI/publishing filters in lockstep with `/available-units` (unit status code `available` + `salesAvailable`).
