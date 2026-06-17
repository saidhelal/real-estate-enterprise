---
name: Sales workflow modeling
description: How a full real-estate sale hangs together across reservation/contract/installments/deposits and what auto-posts to the GL.
---

# Real-estate sale: entity wiring & money modeling

- **Installment plans REQUIRE a contract.** `CreateInstallmentPlanBody.contractId` is mandatory — a plan attaches to a contract, never directly to a reservation. A reservation-only sale must create a `contract` first (reservation→contract→plan→schedules), which also links everything for cross-module reporting.
- **Schedule generation math:** `POST /installment-plans/:id/generate` computes `financed = totalAmount - downPayment`, splits into `numberOfInstallments` equal parts (remainder on the last), step = quarterly→3mo / semi_annual→6 / annual→12 / else 1, first due = startDate + step. So for a 3,000,000 unit with 300,000 down over 20 quarterly: set totalAmount=3,000,000 + downPayment=300,000 → 20×135,000 = 2,700,000. Refuses (409) if schedules already exist.
- **Maintenance / extra deposits have no dedicated table** (only `cheques.deposit_date`). To store one "separately, payable on delivery" without overstating cash, model it as a **draft receipt**: `POST /receipts` always forces `status:"draft"` and has **no GL effect** until `POST /receipts/:id/post`. Date it on delivery, omit cashbox/bank.
- **What auto-posts on create (best-effort, idempotent per sourceType+sourceId):** reservation payments (`reservation.payment` mapping) and contracts (`contract.created`). Receipts do NOT auto-post on create. Each auto entry is balanced and `is_automatic=true`, `status=posted`.

**Why:** these are non-obvious modeling choices — the contract requirement and the deposit-as-draft-receipt pattern aren't discoverable without reading the Zod bodies + handlers.

**How to apply:** when asked to build an end-to-end sale via the API, create project/building/floor/unit → customer → reservation (this now auto-syncs the unit to Reserved) → reservation payment(s) for the down payment → contract (auto-syncs unit to Sold + registers a Legal Affairs contract) → installment plan + generate → draft receipt for any on-delivery deposit. Profile `stats.paidAmount` counts only posted receipts/allocations, so a down payment booked as reservation payments shows paidAmount 0 while dueAmount reflects the financed amount.
