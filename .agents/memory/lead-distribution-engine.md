---
name: Smart Lead Distribution engine
description: How marketing leads auto-assign to sales agents; where attribution lives and the idempotency/scoping invariants.
---

# Smart Lead Distribution (marketing → sales leads)

Leads are the existing CRM `leads` table — distribution did NOT fork a new lead entity.
Marketing attribution columns (`campaignId`, `channelId`) are additive + nullable on `leads`
(`sourceId` already existed). Three additive tables drive it: `marketing_distribution_rules`
(nullable criteria = wildcard, `priority` asc = stronger, `strategy`, `targetUserId`,
`maxLeadsPerAgent`), `marketing_distribution_agents` (roster: userId + weight), and
`marketing_distribution_logs` (immutable decision audit, read-only in UI).

**Rule:** `distributeLead(tx, lead, assignedByUserId)` runs INSIDE the lead-create transaction
and is best-effort — distribution failure must never block lead creation (intake wraps it in
try/catch). It is idempotent via a conditional claim: `UPDATE leads SET assignedTo WHERE id=? AND
assignedToUserId IS NULL RETURNING` — if zero rows return, it bails before writing an
assignment/log, so concurrent `/distribute` calls and retries can't double-assign.

**Why:** mirrors the `lib/integrations.ts` cross-module side-effect convention (all-or-nothing in
the originating tx, idempotent per claim) so a marketing intake can never half-commit a lead.

**How to apply:** intake is `POST /marketing-leads` (reuses `leads.create` perm); manual re-run is
`POST /marketing-leads/:id/distribute` (`leads.update`). Strategies: direct / round_robin /
load_balanced (honours `maxLeadsPerAgent` as a HARD cap — leaves unassigned if all saturated) /
performance (conversions/assignments). New strategy → extend `pickAgent` in
`lib/lead-distribution.ts`. All queries are company-scoped; rules matched highest-priority-first.
