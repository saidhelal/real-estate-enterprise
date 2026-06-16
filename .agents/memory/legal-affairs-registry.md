---
name: Legal Affairs non-destructive contract registry
description: Why Legal Affairs links to domain contracts instead of repointing FKs, and the rules that follow from it.
---

# Legal Affairs master contract registry

Legal Affairs is the master/system-of-record for contract lifecycle + governance,
but it does **not** own the domain contract rows. It links to them.

## The rule
- `legal_contracts` is a master registry that links polymorphically to existing
  domain contracts via `sourceModule` (`sales`/`construction`/`procurement`/`legal`/`other`)
  + `sourceId`. Native legal-only contracts use `sourceModule = legal`.
- Existing `contracts`, `contractor_contracts`, `purchase_contracts` keep all
  columns/FKs and only gained a **nullable** `legalContractId` back-link.
- A seed-integrated, idempotent backfill registers each existing contract and sets
  the back-link, keyed on `(sourceModule, sourceId)` so re-runs don't duplicate.

**Why:** installments, AR/AP invoices, and GL automatic postings
(`contract.created`, payment certificates, etc.) resolve off the *domain* contract
FKs. Repointing those FKs onto a new table would silently break live accounting.
The registry centralizes lifecycle/governance without touching money-movement
references — create+migrate must leave the GL balanced and untouched.

## How to apply
- Never repoint a domain contract FK to `legal_contracts`. Add governance data on
  the registry side and link back.
- Any new contract source must extend the `sourceModule` enum + the backfill, not
  migrate existing FKs.
- UI lifecycle row actions must mirror the API status gates exactly (e.g. legal
  case `Reopen` only when `status = 'closed'`; contract review/approve/activate/
  suspend/terminate/renew gated per status) or the action 409s.
