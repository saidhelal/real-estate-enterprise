# Phase 15 — Legal Affairs Module: Migration & Validation Report

Date: 2026-06-16

## 1. Objective & approach

Legal Affairs was added as the master / system-of-record for contract lifecycle
and governance, plus litigation (cases, hearings, claims, notices, advisors, law
firms). The hard constraint was **no data loss and no broken integrations**
(accounting, installments, AR/AP).

To satisfy this, contracts are **not** repointed. Instead a non-destructive master
registry `legal_contracts` links polymorphically to the existing domain contracts
via `sourceModule` (`sales` | `construction` | `procurement` | `legal` | `other`)
+ `sourceId`. Existing tables (`contracts`, `contractor_contracts`,
`purchase_contracts`) keep all their columns and foreign keys unchanged and gain a
single **nullable** `legalContractId` back-link. A one-time, idempotent backfill
registers every existing contract and sets the back-links.

## 2. Schema changes (non-destructive)

- Added 14 new tables: `legal_contracts`, `contract_templates`,
  `contract_versions`, `legal_contract_amendments`, `contract_addendums`,
  `legal_contract_attachments`, `contract_events`; `law_firms`, `legal_advisors`,
  `legal_cases`, `legal_hearings`, `legal_claims`, `legal_notices`,
  `legal_case_links`.
- Added nullable `legal_contract_id` back-link to `contracts`,
  `contractor_contracts`, `purchase_contracts`. No existing column or FK altered or
  removed.

## 3. Backfill validation (idempotent)

| Source module  | Existing contracts | Registered in `legal_contracts` | Back-linked |
|----------------|--------------------|--------------------------------|-------------|
| sales          | 2                  | 2                              | 2           |
| construction   | 0                  | 0                              | 0           |
| procurement    | 0                  | 0                              | 0           |
| **Total**      | **2**              | **2**                          | **2**       |

- `legal_contracts` total rows: **2** (all `source_module = sales`).
- Re-running the seed is idempotent: registry rows are keyed on
  `sourceModule`/`sourceId`, so counts do not grow on repeated runs.
- Back-link healing: the backfill resolves the existing registry id for an
  already-registered contract and fills a **null** `legalContractId` back-link on
  rerun (it never overwrites an existing reference). This was verified by nulling a
  back-link and re-running the seed — the link was repaired with no duplicate
  registry row (legal_contracts stayed at 2). This makes partial/interrupted runs
  safely recoverable. A post-backfill check logs a warning if any non-deleted
  source row is left unlinked.

## 4. Accounting / integrations integrity

- Journal entries: **46** total; ledger lines balanced — total debit **92,800.00**
  = total credit **92,800.00**.
- Existing automatic postings (`contract.created`, payment certificates, etc.),
  installment plans, and AR/AP invoices are untouched: no source FK was repointed,
  so they continue to resolve and post as before.
- Accounting dashboard endpoint returns 200 with intact aggregates after the
  migration.

## 5. Functional validation (e2e)

All checks performed against the running stack via the shared proxy, authenticated
as the seeded super admin:

- `GET /api/legal/dashboard` → 200; counts: contracts 2, active 1, cases 1,
  total claim amount 250,000.
- `GET /api/legal-contracts` → 200; both sales contracts present with
  `sourceModule = sales` and resolved `sourceId`.
- `GET /api/legal-cases` → 200; demo case present (commercial, plaintiff) with
  bilingual title.
- Contract lifecycle: `POST /api/legal-contracts/:id/review` → 200 (draft →
  under_review). Lifecycle actions (review/approve/activate/suspend/terminate/
  renew) are status-gated in both API and UI.
- Litigation demo: 1 legal case and 1 legal claim seeded and queryable.

## 6. Web layer

- New "Legal Affairs" nav group with Legal Dashboard, contracts (with lifecycle
  row actions), templates, versions, amendments, addendums, attachments, events,
  law firms, advisors, cases (close/reopen), hearings, claims, notices (send),
  case links, and reports.
- Bilingual EN/AR (RTL/LTR), no emojis. All UI strings resolve through the i18n
  provider (EN + AR parity verified); enum values render via the central enum
  label map.
- Case `Reopen` action is shown only for `closed` cases, matching the API gate
  (only a closed case can be reopened); `Close` is hidden for terminal statuses.
- Contract report surfaces by-status, by-type, and by-source breakdowns.

## 7. Build / runtime status

- `pnpm run typecheck` — green across all packages (libs + artifacts).
- API server and ERP web workflows running; legal endpoints return 200.

## 8. Out of scope (unchanged, by design)

- No deletion, merge, or repointing of existing contract tables or their FKs.
- No rewrite of sales/construction/procurement contract creation or their GL
  postings — Legal Affairs links to them.
- Legal-fee expense posting for law-firm invoices remains optional and gated behind
  the `legal.fees` account mapping (best-effort, like existing automatic postings).
