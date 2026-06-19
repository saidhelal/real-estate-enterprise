import { and, eq, inArray } from "drizzle-orm";
import {
  unitsTable,
  unitStatusesTable,
  contractsTable,
  reservationsTable,
  legalContractsTable,
  customersTable,
} from "@workspace/db";
import type { ContractRow } from "@workspace/db";
import type { Tx } from "./posting";
import { nextDocumentNumber } from "./doc-number";

// ---------------------------------------------------------------------------
// Cross-module integration side effects. These keep the canonical shared
// records (units, legal registry) in sync when sales lifecycle events happen,
// without duplicating data. All helpers are best-effort and idempotent so they
// can run inside the originating business transaction without ever leaving the
// system in a half-applied state on retry.
// ---------------------------------------------------------------------------

/**
 * Lifecycle statuses that are set explicitly by a user (via setUnitStatus) and
 * must never be clobbered by the automatic derivation below. Once a unit is
 * marked delivered/blocked/maintenance/cancelled, recomputing from live
 * reservations/contracts is a no-op until the override is released (the
 * setUnitStatus "available" action calls this with { force: true }).
 */
export const MANUAL_UNIT_STATUS_CODES = [
  "delivered",
  "blocked",
  "maintenance",
  "cancelled",
] as const;

/**
 * Derive a unit's status from its strongest live claim and sync
 * `units.unitStatusId`:
 *   - an active (legally activated) contract on the unit    -> "sold"
 *   - else a contract still in the approval workflow
 *     (draft/pending_finance/finance_approved)             -> "pending_sale"
 *   - else an active reservation (status active/confirmed)  -> "reserved"
 *   - else                                                  -> "available"
 *
 * Idempotent and best-effort: silently skips when the unit or the matching
 * `unit_statuses` reference row is missing, and only writes when the resolved
 * status actually changes. Call this after any event that creates, cancels,
 * deletes, or moves a reservation or contract for the affected unit id(s).
 *
 * Manual lifecycle overrides (delivered/blocked/maintenance/cancelled) are
 * preserved: if a unit currently sits in one of those states the derivation is
 * skipped, so a stray reservation/contract change can't silently flip a
 * delivered or blocked unit back to available/reserved/sold. Pass
 * `{ force: true }` to bypass this (used when a user explicitly releases the
 * unit back to the auto-derived state).
 */
export async function recomputeUnitStatus(
  tx: Tx,
  unitId: string | null | undefined,
  opts?: { force?: boolean },
): Promise<void> {
  if (!unitId) return;
  const [unit] = await tx
    .select({
      id: unitsTable.id,
      companyId: unitsTable.companyId,
      unitStatusId: unitsTable.unitStatusId,
      currentCode: unitStatusesTable.code,
    })
    .from(unitsTable)
    .leftJoin(unitStatusesTable, eq(unitStatusesTable.id, unitsTable.unitStatusId))
    .where(and(eq(unitsTable.id, unitId), eq(unitsTable.isDeleted, false)));
  if (!unit) return;

  if (
    !opts?.force &&
    unit.currentCode &&
    (MANUAL_UNIT_STATUS_CODES as readonly string[]).includes(unit.currentCode)
  ) {
    return;
  }

  // An *active* (legally activated) contract claims the unit as Sold. A contract
  // still moving through the Sales -> Finance -> Legal approval workflow
  // (draft / pending_finance / finance_approved) claims it as Pending Sale, so
  // the unit is locked from a second sale but is NOT marked Sold until Legal
  // activates the contract.
  const [soldContract] = await tx
    .select({ id: contractsTable.id })
    .from(contractsTable)
    .where(
      and(
        eq(contractsTable.unitId, unitId),
        eq(contractsTable.isDeleted, false),
        eq(contractsTable.status, "active"),
      ),
    )
    .limit(1);

  const [pendingContract] = soldContract
    ? [undefined]
    : await tx
        .select({ id: contractsTable.id })
        .from(contractsTable)
        .where(
          and(
            eq(contractsTable.unitId, unitId),
            eq(contractsTable.isDeleted, false),
            inArray(contractsTable.status, [
              "draft",
              "pending_finance",
              "finance_approved",
            ]),
          ),
        )
        .limit(1);

  let code: string;
  if (soldContract) {
    code = "sold";
  } else if (pendingContract) {
    code = "pending_sale";
  } else {
    const [resv] = await tx
      .select({ id: reservationsTable.id })
      .from(reservationsTable)
      .where(
        and(
          eq(reservationsTable.unitId, unitId),
          eq(reservationsTable.isDeleted, false),
          inArray(reservationsTable.status, ["active", "confirmed"]),
        ),
      )
      .limit(1);
    code = resv ? "reserved" : "available";
  }

  const [status] = await tx
    .select({ id: unitStatusesTable.id })
    .from(unitStatusesTable)
    .where(
      and(
        eq(unitStatusesTable.companyId, unit.companyId),
        eq(unitStatusesTable.code, code),
        eq(unitStatusesTable.isDeleted, false),
      ),
    )
    .limit(1);
  if (!status) return;
  if (unit.unitStatusId !== status.id) {
    await tx
      .update(unitsTable)
      .set({ unitStatusId: status.id })
      .where(eq(unitsTable.id, unitId));
  }
}

/**
 * Ensure a Legal Affairs registry entry exists for a sales contract and
 * back-link it via `contracts.legalContractId`. The registry row points back at
 * the sales contract through `sourceModule`/`sourceId` — the canonical FKs are
 * never repointed. Idempotent per (sourceModule, sourceId) and best-effort.
 * Returns the legal contract id (existing, reused, or newly created).
 */
export async function ensureLegalContractForContract(
  tx: Tx,
  contract: Pick<
    ContractRow,
    | "id"
    | "companyId"
    | "branchId"
    | "code"
    | "customerId"
    | "totalPrice"
    | "contractDate"
    | "legalContractId"
  >,
): Promise<string | null> {
  if (contract.legalContractId) return contract.legalContractId;

  const [existing] = await tx
    .select({ id: legalContractsTable.id })
    .from(legalContractsTable)
    .where(
      and(
        eq(legalContractsTable.sourceModule, "sales"),
        eq(legalContractsTable.sourceId, contract.id),
        eq(legalContractsTable.isDeleted, false),
      ),
    )
    .limit(1);

  let legalId = existing?.id ?? null;
  if (!legalId) {
    const [customer] = await tx
      .select({ fullName: customersTable.fullName })
      .from(customersTable)
      .where(eq(customersTable.id, contract.customerId))
      .limit(1);
    const code =
      (await nextDocumentNumber("LegalContract")) || `LC-${contract.code}`;
    const [created] = await tx
      .insert(legalContractsTable)
      .values({
        companyId: contract.companyId,
        branchId: contract.branchId,
        code,
        title: `Sales Contract ${contract.code}`,
        contractType: "sales",
        sourceModule: "sales",
        sourceId: contract.id,
        counterpartyType: "customer",
        counterpartyId: contract.customerId,
        counterpartyName: customer?.fullName ?? null,
        // The legal registry row is born as a draft and is only promoted to
        // "active" when Legal approves+activates the sales contract (see the
        // legal-approve handler). Creating it active here would mark a sale as
        // legally binding before the Sales->Finance->Legal workflow completes.
        status: "draft",
        contractDate: contract.contractDate,
        value: contract.totalPrice ?? "0",
      })
      .returning({ id: legalContractsTable.id });
    legalId = created?.id ?? null;
  }

  if (legalId) {
    await tx
      .update(contractsTable)
      .set({ legalContractId: legalId })
      .where(eq(contractsTable.id, contract.id));
  }
  return legalId;
}
