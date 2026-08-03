---
name: Notification emitter
description: Durable rules for raising Notification Center rows from business events
---
# Notification emitter

A shared emitter (`notify(exec, input)`) drops Notification Center rows as a
side-effect of business events. Durable rules learned here:

- **exec is `db` or an open `Tx`.** Pass `tx` to commit the notification
  atomically with the event; pass `db` (try/caught, best-effort) for emits that
  must never break the primary action or run outside a transaction.
- **Idempotency is per `(recipientUserId, sourceModule, sourceId, eventType)`** —
  so every emit MUST set a stable `sourceModule` + `sourceId`. This makes
  read-with-side-effect safe.
- **Company scoping must not exclude global admins.** Recipient resolution by
  permission, when scoped to a company, must match users whose `companyId`
  equals the target company **OR is NULL**. Null-company users are
  unscoped/global (e.g. the seeded super admin) and must still be notified;
  filtering on `companyId = X` alone silently drops them, so a strictly-scoped
  emit can notify nobody. **Why:** a fix that scoped overdue-installment
  recipients to the row's company alone would have leaked nothing but also
  reached no one, because the only privileged user (super admin) has a null
  companyId. **How to apply:** any per-company audience that should still reach
  super/global admins needs the `OR companyId IS NULL` branch.

- **No scheduler exists in this environment.** Time-based events (overdue
  installments) are emitted lazily from the canonical read endpoint that detects
  them; idempotency keeps repeated scans from duplicating.
- Notification title is a single stored string (no per-locale columns) — use a
  concise bilingual `"عربي / English"` title; put codes/amounts in `body`.
