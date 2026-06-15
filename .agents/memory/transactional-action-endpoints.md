---
name: Idempotent action endpoints (convert/generate)
description: Pattern for "action" POST endpoints (reservation->contract convert, plan->schedules generate) to be race-safe and return correct HTTP codes.
---

Action endpoints that mutate based on a pre-condition (convert reservation if not already converted; generate schedules if none exist) must do the read-checks INSIDE the same `db.transaction`, with a row lock on the target, not before it.

**Rule:**
- `SELECT ... .for("update")` the target row (reservation / installment plan) inside the transaction so concurrent calls serialize.
- Re-check the guard (status === "converted", existing schedules count) inside the tx; if it fails, set a `let conflict: string | null` and `return null/[]` out of the tx callback.
- After the transaction resolves, branch on `conflict` to send `404`/`409`; only send `201` + audit on success. You cannot reliably send the HTTP response from inside the tx callback.

**Why:** the original code checked the guard with a plain select before the transaction, so two concurrent requests could both pass and create duplicate contracts/schedules. Flagged in architect review.

**How to apply:** reuse this conflict-variable + row-lock shape for any new "do X once" endpoint. This codebase is a single-company super-admin console, so cross-company tenant scoping is intentionally NOT enforced per-endpoint — don't retrofit it onto isolated endpoints.
