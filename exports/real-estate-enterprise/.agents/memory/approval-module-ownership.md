---
name: Approval action module ownership
description: Department-specific approval actions must live only in their owning module; CRM/Sales shows status only.
---

# Approval action module ownership

The contract/reservation approval workflow (`draft → pending_finance → finance_approved → active`; terminals `rejected`/`cancelled`) is integrated across modules, but each department's APPROVAL ACTIONS must live ONLY in that department's module:

- **CRM / Sales** (`crm-sales.tsx`, `ContractStageActions`, `PaymentChequeManager`): manages the sales pipeline and DISPLAYS approval status (via `stageLabel`/status badges). Sales-owned actions only: submit-to-finance, cancel-sale, and capturing customer cheques / payment items. **No finance/legal approval actions.**
- **Finance module**: contract finance approval (approve/return/reject/record-cheques) lives only in `finance-inbox.tsx`; receipt approval (`useApproveReceipt`) lives only in `receipts.tsx`.
- **Legal Affairs module**: contract legal approval/activation lives only in `legal-approvals.tsx`.
- **Nav**: each approval queue belongs in its OWNING module's nav group (Finance inbox under `financial_management`, Legal approvals under `legal`) — never under `sales_crm`.

**Why:** mixing another department's approval action into CRM violates module ownership and lets sales perform finance/legal sign-off. Backend permissions (`contracts.financeApprove`, `contracts.legalApprove`, etc.) already enforce authz; this is about WHERE the UI surfaces the action.

**How to apply / gotcha:** when auditing "no approval actions in CRM", follow into NESTED components — `ContractStageActions` composes `PaymentChequeManager`, which independently embedded a "Finance Approve" receipt button. A clean parent isn't enough; grep the approval hooks (`useApproveReceipt`, `useFinanceApproveContract`, `useLegalApproveContract`, …) and confirm they resolve only to the owning module's pages.
