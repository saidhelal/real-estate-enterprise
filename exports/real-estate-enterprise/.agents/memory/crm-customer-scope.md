---
name: CRM customer-scoped activities & operational hub
description: How CRM activities/follow-ups attach to customers (not just leads) and how the customer profile hub aggregates sub-resources under one permission.
---

# CRM customer-scope & operational hub

The CRM was made operational by REUSING existing entities — no new tables, no
duplicate customer/record entities.

## lead_activities & lead_follow_ups are dual-scoped
- Both tables carry a nullable `leadId` AND a nullable `customerId`. A row attaches
  to either a lead or a customer. Create endpoints reject (400) when BOTH are absent.
- The list endpoints accept a `customerId` query filter (mirroring the existing
  `leadId` filter).
- **Why:** the product needs activity/call/visit/follow-up logging directly on a
  customer, but leads already used these tables — adding `customerId` reuses them
  instead of creating parallel `customer_activities` tables.

## Actor attribution is server-authoritative
- Create handlers set `userId = req.authUser?.id ?? parsed.data.userId` (auth wins).
  A client-supplied body `userId` is effectively ignored under `requireAuth`.
- **Why:** prevents actor spoofing on who logged an activity/follow-up.

## Profile hub aggregates sub-resources under a single `crm.view`
- `/crm/customers/:id/profile` returns customer + stats + reservations + contracts +
  notes + documents + contacts + activities + followUps, all gated only by
  `requirePermission("crm.view")` — NOT each sub-resource's own `*.view`.
- This is the intentional hub convention (same as the CRM dashboard/search endpoints).
  Do not "fix" it to require `leadActivities.view` etc.; that would be inconsistent
  with the 5 sibling arrays already returned the same way.

## Web: derive companyId from the entity, not companies[0], when available
- The customer profile page sets `companyId = data.customer.companyId` for all create
  payloads (authoritative) rather than `useListCompanies()[0]`. Other list pages still
  use the companies[0] convention because they have no per-row company context.
