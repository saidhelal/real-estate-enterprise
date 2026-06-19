import { describe, it, expect, beforeAll } from "vitest";
import { ApiClient } from "./client";

/**
 * End-to-end coverage for the real-estate hierarchy derivation and the
 * reserved-unit contract rule. All work happens inside the isolated "demo"
 * sandbox (Testing Mode), so production data is never touched.
 */

const baseUrl = process.env["E2E_BASE_URL"]!;
const client = new ApiClient(baseUrl);

const uniq = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

let companyId: string;
let customerId: string;

async function createProject(): Promise<string> {
  const code = `PRJ-${uniq()}`;
  const r = await client.post("/api/projects", {
    companyId,
    code,
    name: `Project ${code}`,
    nameAr: `مشروع ${code}`,
  });
  expect(r.status, JSON.stringify(r.json)).toBe(201);
  return r.json.id as string;
}

async function createPhase(projectId: string): Promise<string> {
  const code = `PH-${uniq()}`;
  const r = await client.post("/api/phases", {
    companyId,
    projectId,
    code,
    name: `Phase ${code}`,
    nameAr: `مرحلة ${code}`,
  });
  expect(r.status, JSON.stringify(r.json)).toBe(201);
  return r.json.id as string;
}

async function createBuilding(projectId: string, phaseId?: string): Promise<string> {
  const code = `BLD-${uniq()}`;
  const r = await client.post("/api/buildings", {
    companyId,
    projectId,
    ...(phaseId ? { phaseId } : {}),
    code,
    name: `Building ${code}`,
    nameAr: `مبنى ${code}`,
  });
  expect(r.status, JSON.stringify(r.json)).toBe(201);
  return r.json.id as string;
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

  // Start from a freshly-seeded sandbox so we have a company + customers to use.
  const reset = await client.post("/api/testing/reset");
  expect(reset.status, JSON.stringify(reset.json)).toBe(200);

  // /companies returns a bare array; paginated lists return { data, ... }.
  const companies = await client.get("/api/companies");
  expect(companies.status).toBe(200);
  companyId = companies.json[0].id;
  expect(companyId).toBeTruthy();

  const customers = await client.get("/api/customers?pageSize=1");
  expect(customers.status).toBe(200);
  customerId = customers.json.data[0].id;
  expect(customerId).toBeTruthy();
}, 120_000);

describe("floor create — derives project/phase from its building", () => {
  it("inherits projectId and phaseId from the parent building", async () => {
    const projectId = await createProject();
    const phaseId = await createPhase(projectId);
    const buildingId = await createBuilding(projectId, phaseId);

    const code = `FL-${uniq()}`;
    const r = await client.post("/api/floors", {
      companyId,
      buildingId,
      code,
      name: `Floor ${code}`,
      nameAr: `طابق ${code}`,
    });
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    expect(r.json.buildingId).toBe(buildingId);
    expect(r.json.projectId).toBe(projectId);
    expect(r.json.phaseId).toBe(phaseId);
  });

  it("rejects a non-existent building", async () => {
    const r = await client.post("/api/floors", {
      companyId,
      buildingId: "00000000-0000-0000-0000-000000000000",
      code: `FL-${uniq()}`,
      name: "Orphan floor",
      nameAr: "طابق يتيم",
    });
    expect(r.status).toBe(400);
  });
});

describe("unit create — derives building/project/phase from its floor", () => {
  it("overrides mismatched client-supplied projectId/buildingId/phaseId", async () => {
    // Real hierarchy the floor actually belongs to.
    const realProject = await createProject();
    const realPhase = await createPhase(realProject);
    const realBuilding = await createBuilding(realProject, realPhase);
    const floorCode = `FL-${uniq()}`;
    const floor = await client.post("/api/floors", {
      companyId,
      buildingId: realBuilding,
      code: floorCode,
      name: `Floor ${floorCode}`,
      nameAr: `طابق ${floorCode}`,
    });
    expect(floor.status, JSON.stringify(floor.json)).toBe(201);
    const floorId = floor.json.id as string;

    // A totally different hierarchy the client will (wrongly) claim for the unit.
    const wrongProject = await createProject();
    const wrongPhase = await createPhase(wrongProject);
    const wrongBuilding = await createBuilding(wrongProject, wrongPhase);

    const code = `U-${uniq()}`;
    const r = await client.post("/api/units", {
      companyId,
      floorId,
      // Deliberately inconsistent ancestors — the server must ignore these.
      projectId: wrongProject,
      phaseId: wrongPhase,
      buildingId: wrongBuilding,
      code,
      name: `Unit ${code}`,
      nameAr: `وحدة ${code}`,
    });
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    expect(r.json.floorId).toBe(floorId);
    expect(r.json.buildingId).toBe(realBuilding);
    expect(r.json.projectId).toBe(realProject);
    expect(r.json.phaseId).toBe(realPhase);
    // And definitely not the mismatched values the client sent.
    expect(r.json.buildingId).not.toBe(wrongBuilding);
    expect(r.json.projectId).not.toBe(wrongProject);
  });

  it("rejects a non-existent floor", async () => {
    const r = await client.post("/api/units", {
      companyId,
      floorId: "00000000-0000-0000-0000-000000000000",
      projectId: "00000000-0000-0000-0000-000000000000",
      buildingId: "00000000-0000-0000-0000-000000000000",
      code: `U-${uniq()}`,
      name: "Orphan unit",
      nameAr: "وحدة يتيمة",
    });
    expect(r.status).toBe(400);
  });
});

/** Build a fresh unit (with full real hierarchy) ready to reserve/contract. */
async function createFreshUnit(): Promise<string> {
  const projectId = await createProject();
  const phaseId = await createPhase(projectId);
  const buildingId = await createBuilding(projectId, phaseId);
  const floorCode = `FL-${uniq()}`;
  const floor = await client.post("/api/floors", {
    companyId,
    buildingId,
    code: floorCode,
    name: `Floor ${floorCode}`,
    nameAr: `طابق ${floorCode}`,
  });
  expect(floor.status, JSON.stringify(floor.json)).toBe(201);
  const unitCode = `U-${uniq()}`;
  const unit = await client.post("/api/units", {
    companyId,
    // projectId/buildingId are required by the input schema; the server re-derives
    // them from floorId, but they must be present to pass validation.
    projectId,
    buildingId,
    floorId: floor.json.id,
    code: unitCode,
    name: `Unit ${unitCode}`,
    nameAr: `وحدة ${unitCode}`,
  });
  expect(unit.status, JSON.stringify(unit.json)).toBe(201);
  return unit.json.id as string;
}

async function reserveUnit(unitId: string): Promise<string> {
  const code = `RSV-${uniq()}`;
  const r = await client.post("/api/reservations", {
    companyId,
    code,
    unitId,
    customerId,
    reservationDate: new Date().toISOString().slice(0, 10),
    status: "active",
    amount: "1000.00",
  });
  expect(r.status, JSON.stringify(r.json)).toBe(201);
  return r.json.id as string;
}

describe("contract create — reserved-unit rule", () => {
  it("rejects a contract for a unit that is not reserved", async () => {
    const unitId = await createFreshUnit();
    const code = `CON-${uniq()}`;
    const r = await client.post("/api/contracts", {
      companyId,
      code,
      unitId,
      customerId,
      contractDate: new Date().toISOString().slice(0, 10),
      totalPrice: "100000.00",
    });
    expect(r.status).toBe(400);
    expect(String(r.json?.error ?? "")).toMatch(/reserved/i);
  });

  it("accepts a contract once the unit has an active reservation", async () => {
    const unitId = await createFreshUnit();
    await reserveUnit(unitId);
    const code = `CON-${uniq()}`;
    const r = await client.post("/api/contracts", {
      companyId,
      code,
      unitId,
      customerId,
      contractDate: new Date().toISOString().slice(0, 10),
      totalPrice: "100000.00",
      downPayment: "10000.00",
    });
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    expect(r.json.unitId).toBe(unitId);
  });
});

describe("reservation → contract convert — exempt from the reserved-unit guard", () => {
  it("creates a contract directly from a reservation and marks it converted", async () => {
    const unitId = await createFreshUnit();
    const reservationId = await reserveUnit(unitId);

    const r = await client.post(`/api/reservations/${reservationId}/convert`, {
      contractDate: new Date().toISOString().slice(0, 10),
      totalPrice: "150000.00",
      downPayment: "15000.00",
    });
    expect(r.status, JSON.stringify(r.json)).toBe(201);
    expect(r.json.unitId).toBe(unitId);
    expect(r.json.reservationId).toBe(reservationId);

    // The source reservation is now marked converted (no longer "active"), which
    // is exactly the state a plain POST /contracts would have rejected — proving
    // the convert path runs on its own reservation rather than the live-reserved
    // guard.
    const res = await client.get(`/api/reservations/${reservationId}`);
    expect(res.status).toBe(200);
    expect(res.json.status).toBe("converted");
  });
});
