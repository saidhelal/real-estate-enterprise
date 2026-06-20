---
name: Cheque status lifecycle
description: The canonical 6-status cheque model, where status transitions live, and how replacement/returned-alerts work.
---

Cheque status is a mandatory enum of exactly six values: `received` (default on
create), `under_collection`, `collected`, `returned`, `cancelled`, `replaced`.
An earlier model had 8 (`post_dated`/`deposited`/`cleared` existed); these were
removed — `cleared` was renamed to `collected`.

**Where it lives:** server transitions in `cheques.ts` (`ALLOWED_TRANSITIONS`,
`COLLECTING_STATUSES`, `REVERSING_STATUSES`); the cheque_status valueCodes in
`lib/master-data/src/index.ts`; enum labels in the same file's ENUM_LABELS. The
ERP UI mirrors `ALLOWED_TRANSITIONS` in `NEXT_STATUSES` maps in
`pages/cheques.tsx`, `components/sales/payment-cheque-manager.tsx`,
`pages/cheque-reports.tsx`, `pages/accounting-dashboard.tsx`.

**Rules:**
- Create always forces `status: "received"` server-side (body status ignored), so
  a cheque can never be born past the start of its lifecycle.
- `replaced` is NEVER a plain `/transition` target. Replacement goes through a
  dedicated `POST /cheques/:id/replace` (permission `cheques.update`) that: reverses
  any posted legs on the original, inserts a fresh `received` cheque copying the
  original's links + `replacesChequeId`, flips the original to `replaced` +
  `replacedByChequeId`, and writes one history row on each. **Why:** keeps the
  original intact in history and bidirectionally linked to its successor (req #7).
  Replaceable only from `received`/`under_collection`/`returned`.
- A `returned` transition emits an URGENT `cheque_returned` notification
  (category `finance`) to the union of `cheques.update`, `contracts.submitFinance`,
  `contracts.create`, `executiveOversight.view|viewOwn` holders (covers Finance,
  Sales Manager, Executive, Owner — "*" holders are always included). Actor is
  excluded, matching the repo's notify convention (`audience.filter(id !== actor)`).
- Two-phase posting unchanged: collection leg on `under_collection`, clearing leg
  on `collected`; both reversed on `returned`/`cancelled`. Voucher/receipt-linked
  cheques skip their own collection leg (avoid double count).

**Schema:** `chequesTable.replacedByChequeId` + `replacesChequeId` (both nullable
uuid) added; surfaced on the OpenAPI `Cheque` response as `["string","null"]`.
