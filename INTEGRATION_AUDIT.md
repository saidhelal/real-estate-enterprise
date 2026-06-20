# Real Estate ERP — Business Integration Audit

**Scope:** End-to-end audit of whether the ERP behaves as ONE integrated enterprise system, where each department automatically hands off to the next, vs. a set of isolated modules that require manual re-entry.
**Method:** Read-only trace of actual backend behavior (handlers, transactions, integration helpers) — not a styling/UI review. Status reflects what the code *actually propagates*, not what screens exist.
**Result legend:** **Integrated** = downstream department is updated automatically in code · **Partial** = some hops automatic, others stop · **Missing** = no automatic propagation (human must re-enter).

> Note on "manual by design": a few hops are legitimately human-initiated (e.g. a customer deciding to reserve a unit). Those are marked *(by design)*. Everything else marked MANUAL-STOP is a true integration gap where data that already exists upstream is not carried forward.

---

## 1. Executive Summary — the headline findings

The ERP has a **strong financial spine** (double-entry auto-posting, reversal-aware reports, idempotent GL) and a **strong sales→legal spine** (reservation→contract→legal registry + unit-status derivation). Outside those two spines, **most departments are data-entry islands**: they store data and show dashboards, but they do not trigger the next department.

The seven most material integration breaks:

1. **CRM → Sales is broken.** Converting/qualifying a lead does **not** create a customer. The whole "lead becomes a buyer" handoff is manual re-entry.
2. **Contract → Installments is broken.** Activating a contract does **not** generate the installment plan/schedule. Collections work, but the schedule they collect against must be built by hand.
3. **The entire Construction/Procurement supply chain is a chain of islands.** Project → Engineering (BOQ) → Requisition → PO → Goods Receipt → Inventory stock → Contractor IPC → Fixed-Asset capitalization — **every hop is manual.** Notably, goods receipt posts to the GL but does **not** appear to increment physical stock balances.
4. **Payroll stops at the ledger.** Posting payroll creates the GL entry but **not** the payment voucher or treasury disbursement, so HR and Treasury are disconnected.
5. **Notifications cover only 6 of 22 modules.** No alerts for lead assignment, procurement approvals, HR/leave/payroll approvals, legal deadlines, low stock, treasury approvals, handover transitions, or asset disposals.
6. **Approval is two disconnected systems.** A central governance queue intercepts DELETE + financial PATCH, while contract/certificate/document/asset-disposal approvals run as **separate, parallel** workflows not wired to it. POST-create actions bypass approval entirely.
7. **The Customer Portal is unaudited and one-directional for money.** Portal complaints/maintenance/tickets flow into Customer Service automatically (good), but customers cannot pay, handover/legal are not exposed, and **zero portal mutations are written to the audit trail.**

Additional siloes: **Engineering, Marketing, Land Bank** data never reaches BI / AI / executive reporting. **Global search** covers only 4 entity types. **Reference data** (currencies, units of measure, tax codes) lives outside the shared master-data engine.

---

## 2. How integration works in this ERP (the shared rails)

Understanding the gaps requires knowing the rails that *do* exist:

| Rail | Mechanism | Where |
|---|---|---|
| Accounting | `postAutomaticEntry(eventKey)` resolves an `account_mappings` event → Dr/Cr; `reverseAutomaticEntriesForSource` on delete; idempotent per `(sourceType, sourceId)` | `lib/posting.ts`, `lib/integrations.ts` |
| Cross-module sales | `recomputeUnitStatus` (unit availability is derived), `ensureLegalContractForContract` (auto legal registry) | `lib/integrations.ts` |
| Notifications | `notify(exec, …)` idempotent per `(recipient, sourceModule, sourceId, eventType)`; overdue computed lazy-on-read | `lib/notify.ts`, `lib/edms.ts` |
| Approval (central) | `governanceMiddleware` parks DELETE + protected financial PATCH as `change_requests` (202), re-dispatches on approval | `middleware/governance.ts`, `routes/change-requests.ts` |
| Documents (EDMS) | Polymorphic link by `moduleKey` + `sourceId`; immutable version history; `document_links` for many-to-many | `lib/edms.ts`, `routes/documents.ts` |
| Print/Forms | Central token-binding print engine; per-entity `ENTITY_BINDINGS` | `lib/print-engine.ts`, `routes/form-templates.ts` |
| Master data | Dynamic lookup engine + static bilingual `LABELS`/`ENUM_LABELS` fallback | `routes/master-data.ts`, `lib/master-data` |
| Audit | `recordAudit` (best-effort) on mutating handlers | `lib/audit.ts` |

**The pattern of every gap below:** the upstream module exists, the downstream module exists, and the *rail* exists — but the upstream handler never calls the rail to push data forward.

---

## 3. End-to-end business-flow verification (where the workflow STOPS)

### CHAIN A — Sales lifecycle: CRM → Sales → Reservation → Contract → Installments → Treasury → Accounting → Customer Service

| Hop | Status | Finding |
|---|---|---|
| Lead → Customer | **MANUAL-STOP** | `lead-conversions` records a conversion *event* only; no `customers` row is created. Sales restarts data entry. |
| Customer → Reservation | manual *(by design)* | `POST /reservations` requires `customerId`; user-initiated. |
| Reservation → Contract | **AUTOMATIC** | `/reservations/:id/convert` creates the contract, marks reservation `converted`, calls `ensureLegalContractForContract`, recomputes unit status. |
| Contract → Installment plan + schedule | **MANUAL-STOP** | Contract activation does **not** create the plan or schedule. User must call `/installment-plans` + `/generate` separately. |
| Installment collection → GL | **AUTOMATIC** | `/installment-collections` calls `postAutomaticEntry('installment.collection')` in-tx. |
| Installment collection → cashbox/bank balance | **PARTIAL** | GL is posted; there is no separate cash/bank *balance master* update outside the ledger (balances are ledger-derived — confirm this matches business expectation). |
| Contract activation → Handover / CS onboarding | **MANUAL-STOP** | `legal-approve` activates + posts GL but creates no `handover_request` and no customer-service onboarding. |

### CHAIN B — Construction lifecycle: Projects → Engineering → Procurement → Inventory → Contractors → Finance → Fixed Assets

| Hop | Status | Finding |
|---|---|---|
| Project → Engineering (BOQ/design) | **MANUAL-STOP** | Projects and BOQs are independent CRUD; no auto-generation. |
| Requisition → Purchase Order | **MANUAL-STOP** | No "convert requisition to PO" automation. |
| PO → Goods Receipt | **MANUAL-STOP** | No PO-driven receipt creation. |
| Goods Receipt → Inventory stock | **PARTIAL / BROKEN** | GRN auto-posts GL (`inventory.goods_receipt`) **but the physical stock-balance table is not incremented in the handler** per the workflow trace. GL and physical stock can diverge — **highest-priority item to verify.** |
| Contractor IPC / payment certificate → AP | **AUTOMATIC (GL)** | IPC/advance/contractor-invoice auto-post (`engineering.payment_certificate`, `engineering.advance_payment`, `engineering.contractor_invoice`). |
| Contractor IPC → project budget decrement | **MANUAL-STOP** | No automatic check/decrement of `budget_lines`; budget control is not enforced at posting. |
| Project completion / CWIP → Fixed Asset | **MANUAL-STOP** | No "capitalize from CWIP" path; fixed assets are created from scratch. |

### CHAIN C — HR → Payroll → Treasury → Accounting

| Hop | Status | Finding |
|---|---|---|
| Employee → Payroll run | manual *(by design)* | Payroll is explicitly triggered. |
| Payroll post → GL | **AUTOMATIC** | `/payroll-runs/:id/post` posts `payroll.salaries` + `payroll.deductions`. |
| Payroll post → Payment voucher + Treasury disbursement | **MANUAL-STOP** | No `payment_voucher` or `treasury_transaction` is created — the actual money movement is disconnected from the expense recognition. |

### CHAIN D — Legal → Contracts → Finance → Customer → Documents

| Hop | Status | Finding |
|---|---|---|
| Sales contract → Legal registry | **AUTOMATIC** | `ensureLegalContractForContract` creates + back-links the legal contract. |
| Legal contract approved → generated document | **AUTOMATIC** | Promotion renders a locked, watermarked, QR-verified PDF via `contract-render`. |
| Legal action (default/claim/notice) → Finance / Customer status | **MANUAL-STOP** | Claims/notices are recorded but don't update `customer.status` or trigger penalties/AR automatically. |

### CROSS-CUTTING — Documents ↔ every module · Attachments ↔ every record · Reports/BI ↔ every department

- **Documents (EDMS):** Linkage rail exists (`moduleKey`+`sourceId`) and is broadly usable; auto-document generation only happens for **legal contracts**. Most modules can attach but don't auto-file.
- **Attachments:** Inconsistent — some tables carry an `attachmentUrl` column, portal uses `customer_uploads`, others rely on EDMS, and **Master Data / Settings / Executive Oversight / BI have none.**
- **Reports & BI:** Most financial/sales/HR/legal data reaches BI. **Engineering, Marketing, and Land Bank are completely siloed** from BI, AI context, and executive reporting. AI context also omits Accounting (GL/budgets), Legal, Customer Service, Insurance, Fixed Assets.

---

## 4. Consolidated gap register (by the categories requested)

### 4.1 Missing accounting (GL) links
- Contract **revenue recognition over time** (currently full recognition at activation only).
- **Reservation forfeiture / expiry** — deposit liability never moves to revenue.
- **Customer-service** compensation/refunds — no GL.
- **Legal** settlements/judgments — no liability/receivable recognition.
- **Land Bank** acquisitions — land cost not capitalized.
- **Marketing** spend — no expense posting.
- **Contractor standalone deductions** — no AP adjustment.
- **Handover** snag/rectification costs — not captured.
- **Asset revaluation** — no gain/loss posting.

### 4.2 Missing automatic updates (workflow stops)
- Lead → Customer · Contract → Installment plan · Contract activation → Handover.
- Project → BOQ · Requisition → PO → GRN · **GRN → stock balance** · CWIP → Fixed Asset.
- Payroll → Payment voucher/Treasury.
- Legal action → Customer/Finance status.

### 4.3 Missing notifications (only Sales, Documents, Change-Requests, Customer-Service, Cheques, Installments emit today)
CRM lead assignment · Procurement approvals · HR leave/payroll approvals · Legal contract review & hearing deadlines · Inventory low-stock/reorder · Finance/Treasury high-value approvals · Handover status transitions · Fixed-asset disposal approvals.

### 4.4 Missing / fragmented approval flow
- POST-create actions and non-financial PATCH **bypass** central governance.
- **Parallel, non-integrated** approval engines: contract-approvals, certificate-approvals (+logs), document-approvals, asset-disposals — none parked in the central `change_requests` queue, so there is no single approval inbox or audit of approvals.

### 4.5 Missing document / attachment links
- **No document/attachment integration:** Master Data, Settings, Executive Oversight, BI.
- **Document linkage but no native attachments:** CRM, HR, Construction, Procurement, Inventory (rely on EDMS; no quick-attach).
- **Auto-document generation** exists only for legal contracts; receipts/POs/certificates render on demand but aren't auto-filed to EDMS.

### 4.6 Missing reporting / BI links
- **Engineering, Marketing, Land Bank** → absent from BI, AI context, executive oversight, and (Engineering/Land Bank) Home tiles.
- **AI context** missing: Accounting (GL/budgets), Legal, Customer Service, Insurance, Fixed Assets.
- **Home dashboard tiles** missing: Accounting, Engineering, Land Bank, Documents (EDMS), Construction.

### 4.7 Duplicate / isolated reference data
- **Currencies, Units of Measure, Tax Codes** held in dedicated per-module tables instead of the shared master-data engine.
- Some workflow statuses hardcoded per module (`LIVE_CONTRACT_STATUSES`, etc.) rather than centralized.

### 4.8 Isolated modules (data-entry islands with little downstream propagation)
Engineering · Marketing · Land Bank · (largely) Procurement→Inventory→Construction chain · Fixed Assets capitalization · Handover (no inbound trigger, no outbound notify).

### 4.9 Audit / permission gaps
- **Customer Portal mutations are entirely unaudited** (login, OTP/password reset, complaints, maintenance, tickets, uploads).
- `GET /dashboard/recent-activity` exposes the **global audit trail** to any authenticated user (auth-only, no permission).
- `dashboard/summary` and `realestate/dashboard` are auth-only (low-sensitivity but unrestricted totals).

### 4.10 Search
- Global search covers only **Customers, Leads, Reservations, Contracts**, client-side over the first 200 rows — not a true cross-module index.

---

## 5. Integration Matrix

**Status:** ✅ Integrated · ◐ Partial · ✗ Missing

| Module | Should connect to | Status | Missing business flow |
|---|---|---|---|
| **Dashboard** | All modules (read) | ◐ | No tiles for Accounting, Engineering, Land Bank, Documents, Construction; recent-activity unguarded |
| **CRM** | → Customers, Sales | ✗ | Lead→Customer conversion creates no customer; lead assignment sends no notification |
| **Sales / Contracts** | → Legal, Installments, Finance, Handover, CS | ◐ | Auto: legal registry, unit status, reservation→contract. Stops: contract→installment plan, contract→handover/CS |
| **Reservations** | → Contracts, Accounting | ✅ | Convert + payment posting work; reservation expiry/forfeiture not posted |
| **Installments & Collections** | → Finance/Treasury, Accounting, Notifications | ◐ | Collection posts GL + overdue notify; but plan/schedule not auto-created from contract |
| **Customer Service** | ← Portal, → Finance, Handover | ◐ | Portal complaints flow in + escalation notify; refunds/compensation not posted to GL; no handover trigger |
| **Projects (Real Estate)** | → Engineering, Construction | ✗ | No auto-creation of BOQ/engineering packages; not in BI/AI |
| **Engineering** | → Procurement, Construction, BI | ✗ | Fully siloed; no downstream creation; absent from BI/AI/reports |
| **Procurement** | → Inventory, Finance, Notifications | ✗ | Requisition→PO→GRN all manual; approvals send no notification |
| **Inventory** | ← Procurement, → Accounting, Fixed Assets | ◐ | GL posts on receipt/issue; **physical stock balance not updated by GRN**; no low-stock notify |
| **Contractors (Construction)** | → Finance/AP, Budgets, Fixed Assets | ◐ | IPC/certificates auto-post AP; budget decrement + CWIP capitalization manual; certificate approval isolated |
| **Finance & Accounting** | ← all money events | ✅ | Strong auto-posting + reversal-aware reports. Gaps are upstream modules not calling it (CS, legal, land, marketing) |
| **Treasury & Banks** | ← HR payroll, Finance | ◐ | Standalone cash/bank movements post; payroll disbursement not auto-created; no high-value approval notify |
| **HR / Payroll** | → Treasury, Accounting, Notifications | ◐ | Payroll posts GL; no payment voucher/treasury entry; leave/payroll approvals send no notification |
| **Legal Affairs** | ← Sales, → Finance, Customer, Documents | ◐ | Auto registry + generated PDF; legal actions don't update customer/finance; no deadline notifications |
| **Fixed Assets** | ← Procurement/CWIP, → Accounting | ◐ | Acquisition/depreciation/disposal post GL; no capitalization-from-CWIP; disposal approval isolated + unnotified |
| **Land Bank** | → Accounting, BI | ✗ | Acquisitions not capitalized; absent from BI/AI/executive reporting |
| **Document Management (EDMS)** | ↔ every module | ◐ | Linkage rail strong; auto-generation only for legal; absent from Home tile/BI; many modules don't auto-file |
| **Reports & BI** | ↔ every department | ◐ | Missing Engineering, Marketing, Land Bank; AI context missing Accounting/Legal/CS/Insurance/Fixed Assets |
| **Administration** | → governance, master data, audit | ◐ | Central governance only covers DELETE + financial PATCH; reference data (currencies/UoM/tax) outside master-data engine |
| **Customer Portal** | ↔ CS, Sales, Finance, Handover, Legal | ◐ | CS in/out works; finance read-only (no payments); handover/legal not exposed; **all mutations unaudited** |
| **Marketing** | → CRM, Accounting, BI | ✗ | Campaign spend not posted; not in BI/AI; lead-source analytics siloed |

---

## 6. Suggested priority order (for the later fix phase — not implemented)

1. **Stock balance on goods receipt** (data-integrity risk: GL vs physical divergence).
2. **Lead → Customer** and **Contract → Installment plan** auto-creation (core revenue chain).
3. **Payroll → payment voucher/treasury** (money actually leaving the bank).
4. **Portal audit logging** (compliance/security).
5. **Unify approval engines** into central governance (single approval inbox + audited approvals).
6. **Notifications** for the 8 missing event classes.
7. **BI/AI inclusion** of Engineering, Marketing, Land Bank; centralize currencies/UoM/tax into master data.
8. **Missing GL links** (reservation forfeiture, CS refunds, legal settlements, land, marketing).

---

*This is an audit only. No code was changed. Awaiting your decision on what to fix.*
