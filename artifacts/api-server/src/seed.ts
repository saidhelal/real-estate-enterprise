import { eq } from "drizzle-orm";
import {
  db,
  pool,
  permissionsTable,
  rolesTable,
  usersTable,
  userRolesTable,
  companiesTable,
  branchesTable,
  currenciesTable,
  fiscalYearsTable,
  numberSequencesTable,
  settingsTable,
  unitTypesTable,
  unitStatusesTable,
  leadSourcesTable,
  projectsTable,
  buildingsTable,
  floorsTable,
  unitsTable,
  leadsTable,
  customersTable,
} from "@workspace/db";
import { hashPassword } from "./lib/auth";

const MODULES: Array<{ module: string; label: string }> = [
  { module: "users", label: "Users" },
  { module: "roles", label: "Roles & Permissions" },
  { module: "companies", label: "Companies" },
  { module: "branches", label: "Branches" },
  { module: "fiscalYears", label: "Fiscal Years" },
  { module: "currencies", label: "Currencies" },
  { module: "numberSequences", label: "Document Numbering" },
  { module: "settings", label: "System Settings" },
  { module: "audit", label: "Audit Trail" },
  { module: "projects", label: "Projects" },
  { module: "phases", label: "Phases" },
  { module: "buildings", label: "Buildings" },
  { module: "floors", label: "Floors" },
  { module: "units", label: "Units" },
  { module: "unitTypes", label: "Unit Types" },
  { module: "unitStatuses", label: "Unit Statuses" },
  { module: "unitPriceLists", label: "Unit Price Lists" },
  { module: "unitPricing", label: "Unit Pricing" },
  { module: "unitDiscounts", label: "Unit Discounts" },
  { module: "leads", label: "Leads" },
  { module: "leadSources", label: "Lead Sources" },
  { module: "leadActivities", label: "Lead Activities" },
  { module: "leadFollowUps", label: "Lead Follow-ups" },
  { module: "leadAssignments", label: "Lead Assignments" },
  { module: "leadConversions", label: "Lead Conversions" },
  { module: "customers", label: "Customers" },
  { module: "customerContacts", label: "Customer Contacts" },
  { module: "customerDocuments", label: "Customer Documents" },
  { module: "customerNotes", label: "Customer Notes" },
  { module: "reservations", label: "Reservations" },
  { module: "reservationPayments", label: "Reservation Payments" },
  { module: "contracts", label: "Contracts" },
  { module: "contractAmendments", label: "Contract Amendments" },
  { module: "contractCancellations", label: "Contract Cancellations" },
  { module: "unitTransfers", label: "Unit Transfers" },
  { module: "installmentPlans", label: "Installment Plans" },
  { module: "installmentSchedules", label: "Installment Schedules" },
  { module: "installmentCollections", label: "Installment Collections" },
  { module: "penaltyRules", label: "Penalty Rules" },
];
const ACTIONS = ["view", "create", "update", "delete"] as const;

async function seedPermissions(): Promise<void> {
  const values = MODULES.flatMap(({ module, label }) =>
    ACTIONS.map((action) => ({
      code: `${module}.${action}`,
      module,
      description: `${action[0].toUpperCase()}${action.slice(1)} ${label}`,
    })),
  );
  await db.insert(permissionsTable).values(values).onConflictDoNothing();
  console.log(`Seeded ${values.length} permissions`);
}

async function seedSuperAdminRole(): Promise<string> {
  const [existing] = await db
    .select()
    .from(rolesTable)
    .where(eq(rolesTable.name, "Super Administrator"));
  if (existing) {
    await db.update(rolesTable).set({ permissions: ["*"] }).where(eq(rolesTable.id, existing.id));
    return existing.id;
  }
  const [role] = await db
    .insert(rolesTable)
    .values({
      name: "Super Administrator",
      description: "Full unrestricted access to every module.",
      permissions: ["*"],
      isSystem: true,
    })
    .returning();
  console.log("Seeded Super Administrator role");
  return role.id;
}

async function seedSuperAdminUser(roleId: string): Promise<void> {
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, "superadmin"));
  if (existing) {
    console.log("Super admin user already exists, skipping");
    return;
  }
  const [user] = await db
    .insert(usersTable)
    .values({
      username: "superadmin",
      fullName: "Super Administrator",
      email: "superadmin@erp.local",
      passwordHash: await hashPassword("Admin@12345"),
      status: "active",
      isActive: true,
    })
    .returning();
  await db.insert(userRolesTable).values({ userId: user.id, roleId });
  console.log("Seeded superadmin user (password: Admin@12345)");
}

async function seedCurrencies(): Promise<void> {
  await db
    .insert(currenciesTable)
    .values([
      { code: "SAR", name: "Saudi Riyal", symbol: "ر.س", isBase: true },
      { code: "USD", name: "US Dollar", symbol: "$", isBase: false },
      { code: "EUR", name: "Euro", symbol: "€", isBase: false },
    ])
    .onConflictDoNothing();
  console.log("Seeded base currencies");
}

async function seedCompany(): Promise<void> {
  const [existing] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.code, "HQ001"));
  if (existing) {
    console.log("Sample company already exists, skipping");
    return;
  }
  const [company] = await db
    .insert(companiesTable)
    .values({
      code: "HQ001",
      name: "Prime Real Estate Holding",
      nameAr: "شركة برايم العقارية القابضة",
      taxNumber: "300000000000003",
      email: "info@primeestate.local",
      phone: "+966500000000",
      address: "King Fahd Road, Riyadh",
      baseCurrency: "SAR",
    })
    .returning();
  await db.insert(branchesTable).values({
    companyId: company.id,
    code: "BR001",
    name: "Riyadh Main Branch",
    nameAr: "فرع الرياض الرئيسي",
    manager: "Operations Manager",
    phone: "+966500000001",
    address: "Olaya District, Riyadh",
  });

  const year = new Date().getFullYear();
  await db.insert(fiscalYearsTable).values({
    companyId: company.id,
    name: `FY ${year}`,
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    status: "open",
  });
  console.log("Seeded sample company, branch, and fiscal year");
}

async function seedNumberSequences(): Promise<void> {
  await db
    .insert(numberSequencesTable)
    .values([
      { documentType: "Invoice", prefix: "INV", padding: 5, resetYearly: true },
      { documentType: "Receipt", prefix: "RCV", padding: 5, resetYearly: true },
      { documentType: "Contract", prefix: "CON", padding: 4, resetYearly: false },
      { documentType: "Journal Entry", prefix: "JE", padding: 6, resetYearly: true },
    ])
    .onConflictDoNothing();
  console.log("Seeded document number sequences");
}

async function seedSettings(): Promise<void> {
  await db
    .insert(settingsTable)
    .values([
      { key: "app.name", value: "Prime Real Estate ERP", category: "general", label: "Application Name" },
      { key: "app.defaultLanguage", value: "en", category: "general", label: "Default Language" },
      { key: "app.defaultTheme", value: "light", category: "general", label: "Default Theme" },
      { key: "security.passwordMinLength", value: "8", category: "security", label: "Minimum Password Length" },
      { key: "security.maxLoginAttempts", value: "5", category: "security", label: "Max Login Attempts" },
      { key: "security.lockoutMinutes", value: "15", category: "security", label: "Lockout Duration (minutes)" },
      { key: "finance.baseCurrency", value: "SAR", category: "finance", label: "Base Currency" },
    ])
    .onConflictDoNothing();
  console.log("Seeded system settings");
}

async function seedRealEstate(): Promise<void> {
  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.code, "HQ001"));
  if (!company) {
    console.log("No sample company found, skipping real estate demo data");
    return;
  }
  const [branch] = await db
    .select()
    .from(branchesTable)
    .where(eq(branchesTable.companyId, company.id));
  const companyId = company.id;
  const branchId = branch?.id ?? null;

  const [existingProject] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.code, "PRJ001"));
  if (existingProject) {
    console.log("Real estate demo data already exists, skipping");
    return;
  }

  // Lookups
  const [aptType, villaType, officeType] = await db
    .insert(unitTypesTable)
    .values([
      { companyId, code: "APT", name: "Apartment", nameAr: "شقة" },
      { companyId, code: "VIL", name: "Villa", nameAr: "فيلا" },
      { companyId, code: "OFF", name: "Office", nameAr: "مكتب" },
    ])
    .returning();

  const [availableStatus, reservedStatus, soldStatus] = await db
    .insert(unitStatusesTable)
    .values([
      { companyId, code: "available", name: "Available", nameAr: "متاحة" },
      { companyId, code: "reserved", name: "Reserved", nameAr: "محجوزة" },
      { companyId, code: "sold", name: "Sold", nameAr: "مباعة" },
    ])
    .returning();

  await db.insert(leadSourcesTable).values([
    { companyId, code: "WEB", name: "Website", nameAr: "الموقع الإلكتروني" },
    { companyId, code: "REF", name: "Referral", nameAr: "إحالة" },
    { companyId, code: "WALK", name: "Walk-in", nameAr: "زيارة مباشرة" },
  ]);

  // Project
  const [project] = await db
    .insert(projectsTable)
    .values({
      companyId,
      branchId,
      code: "PRJ001",
      name: "Prime Towers",
      nameAr: "أبراج برايم",
      status: "active",
    })
    .returning();

  // 2 buildings
  const buildings = await db
    .insert(buildingsTable)
    .values([
      { companyId, projectId: project.id, code: "BLD-A", name: "Tower A", nameAr: "برج أ" },
      { companyId, projectId: project.id, code: "BLD-B", name: "Tower B", nameAr: "برج ب" },
    ])
    .returning();

  // 5 floors (3 in Tower A, 2 in Tower B)
  const floorSpecs = [
    { building: buildings[0], n: 1 },
    { building: buildings[0], n: 2 },
    { building: buildings[0], n: 3 },
    { building: buildings[1], n: 1 },
    { building: buildings[1], n: 2 },
  ];
  const floors = await db
    .insert(floorsTable)
    .values(
      floorSpecs.map((f) => ({
        companyId,
        buildingId: f.building.id,
        code: `${f.building.code}-F${f.n}`,
        name: `Floor ${f.n}`,
        nameAr: `الطابق ${f.n}`,
      })),
    )
    .returning();

  // 20 units (4 per floor)
  const types = [aptType, villaType, officeType];
  const statuses = [availableStatus, availableStatus, reservedStatus, soldStatus];
  const unitValues = [];
  let unitCounter = 1;
  for (let fi = 0; fi < floors.length; fi++) {
    const floor = floors[fi];
    const spec = floorSpecs[fi];
    for (let u = 0; u < 4; u++) {
      const type = types[unitCounter % types.length];
      const status = statuses[unitCounter % statuses.length];
      const num = String(unitCounter).padStart(3, "0");
      unitValues.push({
        companyId,
        branchId,
        projectId: project.id,
        buildingId: spec.building.id,
        floorId: floor.id,
        unitTypeId: type.id,
        unitStatusId: status.id,
        code: `UNIT-${num}`,
        name: `Unit ${num}`,
        nameAr: `وحدة ${num}`,
        area: String(80 + unitCounter * 5),
        bedrooms: 1 + (unitCounter % 4),
        bathrooms: 1 + (unitCounter % 3),
        basePrice: String(500000 + unitCounter * 25000),
      });
      unitCounter++;
    }
  }
  await db.insert(unitsTable).values(unitValues);

  // 5 leads
  await db.insert(leadsTable).values(
    Array.from({ length: 5 }, (_, i) => ({
      companyId,
      branchId,
      code: `LEAD-${String(i + 1).padStart(3, "0")}`,
      fullName: `Prospect ${i + 1}`,
      phone: `+96650000${String(1000 + i)}`,
      email: `prospect${i + 1}@example.local`,
      status: "new",
    })),
  );

  // 5 customers
  await db.insert(customersTable).values(
    Array.from({ length: 5 }, (_, i) => ({
      companyId,
      branchId,
      code: `CUST-${String(i + 1).padStart(3, "0")}`,
      fullName: `Customer ${i + 1}`,
      nameAr: `عميل ${i + 1}`,
      type: "individual",
      phone: `+96655000${String(2000 + i)}`,
      email: `customer${i + 1}@example.local`,
    })),
  );

  console.log(
    "Seeded real estate demo data: 1 project, 2 buildings, 5 floors, 20 units, 5 leads, 5 customers",
  );
}

async function main(): Promise<void> {
  await seedPermissions();
  const roleId = await seedSuperAdminRole();
  await seedSuperAdminUser(roleId);
  await seedCurrencies();
  await seedCompany();
  await seedNumberSequences();
  await seedSettings();
  await seedRealEstate();
  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
