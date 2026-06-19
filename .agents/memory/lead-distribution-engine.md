---
name: Lead distribution engine
description: Smart lead auto-assignment engine — idempotency, caps, and the company-scope convention it follows.
---

# Smart Lead Distribution Engine

The engine runs INSIDE the caller's transaction (mirrors `lib/integrations.ts`): lead
create + assignment + log all commit or all roll back. It matches the highest-priority
active rule (nullable criteria = wildcard), resolves candidates (direct targetUserId |
active agent roster), and picks per strategy (round_robin / load_balanced / performance /
direct).

## Idempotency must be concurrency-safe, not read-then-write
- The early `if (lead.assignedToUserId) return null` guard is necessary but NOT
  sufficient — two concurrent `/distribute` calls can both pass it.
- The authoritative claim is a **conditional UPDATE**:
  `UPDATE leads SET assigned_to_user_id=? WHERE id=? AND assigned_to_user_id IS NULL`
  with `.returning()`; if it claims 0 rows, bail BEFORE inserting assignment/log rows.
  **Why:** otherwise the losing tx writes duplicate assignment + distribution-log rows.

## Hard caps must actually be hard
- `maxLeadsPerAgent` in load_balanced is a HARD cap: if every agent is at/over the
  limit, return null (leave the lead unassigned) — do NOT fall back to the saturated
  pool. **Why:** a "fall back to all agents" branch silently defeats the cap.

## Company scoping follows the app-wide convention, deliberately
- The marketing CRUD endpoints use `registerCrud` and trust body/query `companyId`
  exactly like every other module (campaigns, channels, HR, legal, ...). This ERP is a
  single-company super-admin console (no company switcher; see `erp-company-scope`).
- A code review may flag this as a tenant-scoping gap. It is a **pre-existing app-wide
  pattern**, not introduced per-module — do not add a one-off `canOperateOnCompany`
  guard to a single module, which would diverge from the rest of the codebase.
