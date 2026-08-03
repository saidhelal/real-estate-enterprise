import { describe, it, expect, beforeAll } from "vitest";
import { ApiClient } from "./client";

/**
 * End-to-end coverage for the cross-department integration spine:
 *
 *   Lead (CRM) -> Reservation -> Reservation payment (GL) -> Contract (convert)
 *   -> Submit to Finance -> Finance approve -> Legal activate (GL + Legal registry)
 *   -> Handover request -> Handover complete (Customer Service visibility)
 *
 * Every handoff is asserted as a *real* propagation: a record leaves one
 * department's work queue and appears in the next, side-effects (unit status,
 * ledger entries, legal registry, delivered-unit counts) are written, and the
 * dashboards read the live data back. All work runs inside the isolated "demo"
 * sandbox (Testing Mode), so production data is never touched.
 */

const baseUrl = process.env["E2E_BASE_URL"]!;
const client = new ApiClient(baseUrl);

const uniq = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const today = () => new Date().toISOString().slice(0, 10);

let companyId: string;
let customerId: string;
/** Map of unit-status id -> code, so we can assert the derived projection. */
const unitStatusCode = new Map<string, string>();

async function unitStatusOf(unitId: string): Promise<string | undefined> {
  const u = await client.get(`/api/units/${unitId}`);
  expect(u.status, JSON.stringify(u.json)).toBe(200);
  const id = u.json.unitStatusId as string | null;
  return id ? unitStatusCode.get(id) : undefined;
}

async function createFreshUnit(): Promise<string> {
  const proj = await client.post("/api/projects", {
    companyId, code: `PRJ-${uniq()}`, name: "P", nameAr: "م",
  });
  expect(proj.status, JSON.stringify(proj.json)).toBe(201);
  const phase = await client.post("/api/phases", {
    companyId, projectId: proj.json.id, code: `PH-${uniq()}`, name: "Ph", nameAr: "مر",
  });
  expect(phase.status, JSON.stringify(phase.json)).toBe(201);
  const bld = await client.post("/api/buildings", {
    companyId, projectId: proj.json.id, phaseId: phase.json.id, code: `BLD-${uniq()}`, name: "B", nameAr: "مب",
  });
  expect(bld.status, JSON.stringify(bld.json)).toBe(201);
  const floor = await client.post("/api/floors", {
    companyId, buildingId: bld.json.id, code: `FL-${uniq()}`, name: "F", nameAr: "ط",
  });
  expect(floor.status, JSON.stringify(floor.json)).toBe(201);
  const unit = await client.post("/api/units", {
    companyId, projectId: proj.json.id, buildingId: bld.json.id, floorId: floor.json.id,
    code: `U-${uniq()}`, name: "U", nameAr: "و",
  });
  expect(unit.status, JSON.stringify(unit.json)).toBe(201);
  return unit.json.id as string;
}

/** Count journal entries for a given source type (optionally a code search). */
async function journalCount(sourceType: string, search?: string): Promise<number> {
  const qs = new URLSearchParams({ companyId, sourceType, pageSize: "200" });
  if (search) qs.set("search", search);
  const r = await client.get(`/api/journal-entries?${qs.toString()}`);
  expect(r.status, JSON.stringify(r.json)).toBe(200);
  return r.json.total as number;
}

async function contractIdsWithStatus(status: string): Promise<string[]> {
  const r = await client.get(`/api/contracts?status=${status}&companyId=${companyId}&pageSize=200`);
  expect(r.status, JSON.stringify(r.json)).toBe(200);
  return (r.json.data as Array<{ id: string }>).map((c) => c.id);
}

async function deliveredUnits(): Promise<number> {
  const r = await client.get(`/api/customer-service-dashboard?companyId=${companyId}`);
  expect(r.status, JSON.stringify(r.json)).toBe(200);
  return r.json.deliveredUnits as number;
}

async function totalSales(): Promise<number> {
  const r = await client.get(`/api/finance/dashboard?companyId=${companyId}`);
  expect(r.status, JSON.stringify(r.json)).toBe(200);
  return Number(r.json.totalSales);
}

beforeAll(async () => {
  const login = await client.post("/api/auth/login", {
    username: "superadmin",
    password: "Admin@123456",
  });
  expect(login.status, JSON.stringify(login.json)).toBe(200);

  const enter = await client.post("/api/testing/enter");
  expect(enter.status, JSON.stringify(enter.json)).toBe(200);
  expect(client.hasCookie("erp_testing")).toBe(true);

  const reset = await client.post("/api/testing/reset");
  expect(reset.status, JSON.stringify(reset.json)).toBe(200);

  const companies = await client.get("/api/companies");
  expect(companies.status).toBe(200);
  companyId = companies.json[0].id;
  expect(companyId).toBeTruthy();

  const customers = await client.get("/api/customers?pageSize=1");
  expect(customers.status).toBe(200);
  customerId = customers.json.data[0].id;
  expect(customerId).toBeTruthy();

  const statuses = await client.get("/api/unit-statuses?pageSize=200");
  expect(statuses.status, JSON.stringify(statuses.json)).toBe(200);
  for (const s of statuses.json.data as Array<{ id: string; code: string }>) {
    unitStatusCode.set(s.id, s.code);
  }
  expect(unitStatusCode.size).toBeGreaterThan(0);
}, 120_000);

describe("full Lead -> Sale -> Finance -> Legal -> Handover -> Customer Service chain", () => {
  it("propagates a record across every department without duplicate entry", async () => {
    const tag = uniq();

    // ----- 1. CRM: a lead enters the funnel ------------------------------
    const leadCode = `LEAD-${tag}`;
    const lead = await client.post("/api/leads", {
      companyId,
      code: leadCode,
      fullName: `Prospect ${tag}`,
      phone: "+96650000000",
      status: "new",
    });
    expect(lead.status, JSON.stringify(lead.json)).toBe(201);
    const foundLead = await client.get(`/api/leads?search=${leadCode}&companyId=${companyId}`);
    expect(foundLead.status).toBe(200);
    expect((foundLead.json.data as Array<{ id: string }>).some((l) => l.id === lead.json.id)).toBe(true);

    const salesBefore = await totalSales();

    // ----- 2. Sales: reserve a unit -> unit becomes "reserved" -----------
    // A freshly-created unit carries no explicit status row yet (implicitly
    // available); recomputeUnitStatus stamps a concrete status on first claim.
    const unitId = await createFreshUnit();
    expect([undefined, "available"]).toContain(await unitStatusOf(unitId));

    const reservation = await client.post("/api/reservations", {
      companyId,
      code: `RSV-${tag}`,
      unitId,
      customerId,
      reservationDate: today(),
      status: "active",
      amount: "20000.00",
    });
    expect(reservation.status, JSON.stringify(reservation.json)).toBe(201);
    const reservationId = reservation.json.id as string;
    expect(await unitStatusOf(unitId)).toBe("reserved");

    // ----- 3. Reservation payment posts to the ledger immediately --------
    const glReservationBefore = await journalCount("reservationPayment");
    const payment = await client.post("/api/reservation-payments", {
      companyId,
      reservationId,
      amount: "20000.00",
      paymentDate: today(),
      method: "bank_transfer",
      reference: `RPAY-${tag}`,
    });
    expect(payment.status, JSON.stringify(payment.json)).toBe(201);
    expect(await journalCount("reservationPayment")).toBe(glReservationBefore + 1);

    // ----- 4. Convert reservation -> draft contract (CRM/Sales queue) ----
    const convert = await client.post(`/api/reservations/${reservationId}/convert`, {
      code: `CON-${tag}`,
      contractDate: today(),
      totalPrice: "500000.00",
      downPayment: "50000.00",
      paymentMethod: "cheque",
    });
    expect(convert.status, JSON.stringify(convert.json)).toBe(201);
    const contractId = convert.json.id as string;
    expect(convert.json.status).toBe("draft");
    // Legal registry row is auto-created (back-linked) but still a draft.
    const legalContractId = convert.json.legalContractId as string;
    expect(legalContractId).toBeTruthy();
    // The source reservation is consumed, not duplicated.
    const resAfter = await client.get(`/api/reservations/${reservationId}`);
    expect(resAfter.json.status).toBe("converted");
    // A draft contract claims the unit (Pending Sale, not yet Sold).
    expect(await unitStatusOf(unitId)).not.toBe("available");

    // Legal must NOT yet see this as an actionable contract.
    const legalRowDraft = await client.get(`/api/legal-contracts/${legalContractId}`);
    expect(legalRowDraft.status).toBe(200);
    expect(legalRowDraft.json.status).toBe("draft");
    expect(await contractIdsWithStatus("finance_approved")).not.toContain(contractId);

    // ----- 5. Sales -> Finance: submit moves it into the Finance queue ---
    const submit = await client.post(`/api/contracts/${contractId}/submit-to-finance`, {
      paymentMethod: "cheque",
      notes: "Cheques attached",
    });
    expect(submit.status, JSON.stringify(submit.json)).toBe(200);
    expect(submit.json.status).toBe("pending_finance");
    // It left the CRM draft queue and entered the Finance inbox.
    expect(await contractIdsWithStatus("draft")).not.toContain(contractId);
    expect(await contractIdsWithStatus("pending_finance")).toContain(contractId);

    // ----- 6. Finance approve: moves it into the Legal queue -------------
    const approve = await client.post(`/api/contracts/${contractId}/finance-approve`, {
      notes: "Verified",
    });
    expect(approve.status, JSON.stringify(approve.json)).toBe(200);
    expect(approve.json.status).toBe("finance_approved");
    expect(await contractIdsWithStatus("pending_finance")).not.toContain(contractId);
    expect(await contractIdsWithStatus("finance_approved")).toContain(contractId);
    // Finance approval alone must NOT yet recognize the sale on the ledger.
    expect(await journalCount("contract", `CON-${tag}`)).toBe(0);

    // ----- 7. Legal activate: GL recognition + registry promotion -------
    const legal = await client.post(`/api/contracts/${contractId}/legal-approve`, {
      notes: "Approved by Legal",
    });
    expect(legal.status, JSON.stringify(legal.json)).toBe(200);
    expect(legal.json.status).toBe("active");
    // The sale is now recognized on the ledger (idempotent, exactly one entry).
    expect(await journalCount("contract", `CON-${tag}`)).toBe(1);
    // The Legal Affairs registry row is promoted to active.
    const legalRowActive = await client.get(`/api/legal-contracts/${legalContractId}`);
    expect(legalRowActive.json.status).toBe("active");
    // The unit is now Sold.
    expect(await unitStatusOf(unitId)).toBe("sold");
    // Finance dashboard reads the new sale back from live data.
    expect(await totalSales()).toBeGreaterThanOrEqual(salesBefore + 500000);

    // ----- 8. Handover -> Customer Service visibility -------------------
    const csBefore = await deliveredUnits();
    const handover = await client.post("/api/handover-requests", {
      companyId,
      code: `HO-${tag}`,
      unitId,
      customerId,
      contractId,
      handoverType: "final",
      status: "pending",
    });
    expect(handover.status, JSON.stringify(handover.json)).toBe(201);
    // A pending handover is NOT yet a delivered customer.
    expect(await deliveredUnits()).toBe(csBefore);

    const complete = await client.patch(`/api/handover-requests/${handover.json.id}`, {
      status: "completed",
    });
    expect(complete.status, JSON.stringify(complete.json)).toBe(200);
    expect(complete.json.status).toBe("completed");
    // Customer Service now sees exactly one more delivered unit.
    expect(await deliveredUnits()).toBe(csBefore + 1);
  });

  it("idempotent legal activation cannot double-post the sale to the ledger", async () => {
    const tag = uniq();
    const unitId = await createFreshUnit();
    const reservation = await client.post("/api/reservations", {
      companyId, code: `RSV-${tag}`, unitId, customerId, reservationDate: today(), status: "active", amount: "10000.00",
    });
    expect(reservation.status, JSON.stringify(reservation.json)).toBe(201);
    const convert = await client.post(`/api/reservations/${reservation.json.id}/convert`, {
      code: `CON-${tag}`, contractDate: today(), totalPrice: "300000.00", downPayment: "30000.00",
    });
    expect(convert.status, JSON.stringify(convert.json)).toBe(201);
    const contractId = convert.json.id as string;

    await client.post(`/api/contracts/${contractId}/submit-to-finance`, {});
    await client.post(`/api/contracts/${contractId}/finance-approve`, {});
    const first = await client.post(`/api/contracts/${contractId}/legal-approve`, {});
    expect(first.status).toBe(200);
    expect(await journalCount("contract", `CON-${tag}`)).toBe(1);

    // A second activation is a no-op conflict — never a second ledger entry.
    const second = await client.post(`/api/contracts/${contractId}/legal-approve`, {});
    expect(second.status).toBe(409);
    expect(await journalCount("contract", `CON-${tag}`)).toBe(1);
  });

  it("a finance-rejected contract frees the unit and never posts to the ledger", async () => {
    const tag = uniq();
    const unitId = await createFreshUnit();
    const reservation = await client.post("/api/reservations", {
      companyId, code: `RSV-${tag}`, unitId, customerId, reservationDate: today(), status: "active", amount: "10000.00",
    });
    expect(reservation.status, JSON.stringify(reservation.json)).toBe(201);
    const convert = await client.post(`/api/reservations/${reservation.json.id}/convert`, {
      code: `CON-${tag}`, contractDate: today(), totalPrice: "250000.00",
    });
    expect(convert.status, JSON.stringify(convert.json)).toBe(201);
    const contractId = convert.json.id as string;

    await client.post(`/api/contracts/${contractId}/submit-to-finance`, {});
    const reject = await client.post(`/api/contracts/${contractId}/finance-reject`, { notes: "Bad terms" });
    expect(reject.status, JSON.stringify(reject.json)).toBe(200);
    expect(reject.json.status).toBe("rejected");
    // Rejection frees the unit (no live reservation remains -> available).
    expect(await unitStatusOf(unitId)).toBe("available");
    expect(await journalCount("contract", `CON-${tag}`)).toBe(0);
    // Legal must never see a rejected contract.
    expect(await contractIdsWithStatus("finance_approved")).not.toContain(contractId);
  });
});
