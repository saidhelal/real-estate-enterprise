---
name: Read-aggregation partition consistency
description: Rules for paid/due/overdue (and similar) money aggregations in read-only report endpoints across modules.
---

# Read-aggregation partition consistency

Read-only reporting/aggregation endpoints (dashboards, customer 360 profiles, etc.) that split money
into buckets must keep the buckets a true partition and stay consistent with every other endpoint
that exposes the same buckets.

**Rules:**
- paid / due / overdue must be mutually exclusive: `paid` = status paid; `overdue` = unpaid AND `dueDate < today`; `due` = unpaid AND `dueDate >= today`. Do NOT let `due` mean "all unpaid" — it double-counts overdue and disagrees with sibling endpoints.
- Sum money DB-side with `coalesce(sum(col), 0)::text` (numeric), never `rows.reduce((s,c)=>s+Number(c.x),0).toFixed(2)` — JS float drifts and violates the project's exact-money rule.
- When two endpoints (e.g. a module dashboard and a per-record profile) report the same buckets, copy the exact same SQL predicate into both so they can't diverge.

**Why:** an architect review caught a CRM customer-profile whose `due` summed all unpaid installments (so overdue was counted in both `due` and `overdue`) and whose contract total used JS float, while the CRM dashboard already partitioned correctly.

**How to apply:** when adding any read aggregation that buckets money, mirror the predicate of the existing canonical endpoint and verify `paid + due + overdue` reconciles against a known fixture.
