import { and, eq } from "drizzle-orm";
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
  reservationsTable,
  reservationNotesTable,
  reservationDocumentsTable,
  contractsTable,
  contractNotesTable,
  contractDocumentsTable,
  installmentPlansTable,
  installmentSchedulesTable,
  penaltyRulesTable,
  cashboxesTable,
  bankAccountsTable,
  treasuryTransactionsTable,
  bankTransactionsTable,
  receiptsTable,
  accountsTable,
  costCentersTable,
  fiscalPeriodsTable,
  accountMappingsTable,
} from "@workspace/db";
import { hashPassword } from "./lib/auth";

const MODULES: Array<{ module: string; label: string; extraActions?: string[] }> = [
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
  { module: "reservationNotes", label: "Reservation Notes" },
  { module: "reservationDocuments", label: "Reservation Documents" },
  { module: "contracts", label: "Contracts" },
  { module: "contractAmendments", label: "Contract Amendments" },
  { module: "contractCancellations", label: "Contract Cancellations" },
  { module: "contractNotes", label: "Contract Notes" },
  { module: "contractDocuments", label: "Contract Documents" },
  { module: "unitTransfers", label: "Unit Transfers" },
  { module: "installmentPlans", label: "Installment Plans" },
  { module: "installmentSchedules", label: "Installment Schedules" },
  { module: "installmentCollections", label: "Installment Collections" },
  { module: "penaltyRules", label: "Penalty Rules" },
  { module: "cashboxes", label: "Cashboxes" },
  { module: "treasuryTransactions", label: "Treasury Transactions" },
  { module: "bankAccounts", label: "Bank Accounts" },
  { module: "bankTransactions", label: "Bank Transactions" },
  { module: "receipts", label: "Receipts" },
  { module: "penalties", label: "Penalties" },
  { module: "accounts", label: "Chart of Accounts" },
  { module: "costCenters", label: "Cost Centers" },
  { module: "fiscalPeriods", label: "Fiscal Periods", extraActions: ["close", "reopen"] },
  { module: "journalEntries", label: "Journal Entries", extraActions: ["post", "approve", "reverse"] },
  { module: "accountMappings", label: "Account Mappings" },
  { module: "budgets", label: "Budgets" },
  { module: "accountingReports", label: "Accounting Reports", extraActions: ["export"] },
  // Engineering — Master Data
  { module: "engineeringDisciplines", label: "Engineering Disciplines" },
  { module: "consultants", label: "Consultants" },
  { module: "designPackages", label: "Design Packages" },
  { module: "drawingCategories", label: "Drawing Categories" },
  { module: "technicalSpecifications", label: "Technical Specifications" },
  // Engineering — Drawings
  { module: "drawings", label: "Drawings", extraActions: ["approve"] },
  { module: "drawingRevisions", label: "Drawing Revisions" },
  // Engineering — BOQ
  { module: "boqs", label: "Bills of Quantities" },
  { module: "boqItems", label: "BOQ Items" },
  { module: "boqQuantityRevisions", label: "BOQ Quantity Revisions" },
  { module: "costEstimates", label: "Cost Estimates", extraActions: ["approve"] },
  // Engineering — Site Inspection
  { module: "inspectionRequests", label: "Inspection Requests" },
  { module: "inspectionReports", label: "Inspection Reports" },
  { module: "defects", label: "Defects" },
  { module: "correctiveActions", label: "Corrective Actions", extraActions: ["close"] },
  // Engineering — Technical Requests
  { module: "rfis", label: "RFIs", extraActions: ["respond", "close"] },
  { module: "technicalSubmittals", label: "Technical Submittals", extraActions: ["approve"] },
  { module: "materialSubmittals", label: "Material Submittals", extraActions: ["approve"] },
  { module: "consultantResponses", label: "Consultant Responses" },
  // Engineering — Project Integration
  { module: "engineeringProgress", label: "Engineering Progress" },
  // Construction Execution — Contractors & Contracts
  { module: "contractors", label: "Contractors" },
  { module: "contractorContracts", label: "Contractor Contracts" },
  { module: "contractBoqItems", label: "Contract BOQ Items" },
  // Construction Execution — Work Progress
  { module: "workProgressUpdates", label: "Work Progress Updates" },
  // Construction Execution — Payment Certificates (IPC)
  { module: "paymentCertificates", label: "Payment Certificates", extraActions: ["approve", "verify"] },
  { module: "certificateItems", label: "Certificate Items" },
  // Construction Execution — Variations
  { module: "variationOrders", label: "Variation Orders", extraActions: ["approve"] },
  // Construction Execution — Deductions & Additions
  { module: "contractorDeductions", label: "Contractor Deductions" },
  { module: "contractorAdditions", label: "Contractor Additions" },
  // Construction Execution — Retention & Advance
  { module: "retentions", label: "Retentions", extraActions: ["release"] },
  { module: "advancePayments", label: "Advance Payments" },
  { module: "advanceRecoveries", label: "Advance Recoveries", extraActions: ["recover"] },
  // Construction Execution — Invoices
  { module: "contractorInvoices", label: "Contractor Invoices", extraActions: ["verify"] },
  // Construction Execution — Approval Workflow
  { module: "contractApprovals", label: "Contract Approvals", extraActions: ["approve"] },
  // Procurement — Supplier Management
  { module: "supplierCategories", label: "Supplier Categories" },
  { module: "suppliers", label: "Suppliers", extraActions: ["blacklist"] },
  { module: "supplierContacts", label: "Supplier Contacts" },
  { module: "supplierEvaluations", label: "Supplier Evaluations", extraActions: ["approve"] },
  // Procurement — Purchase Requests
  { module: "purchaseRequests", label: "Purchase Requests", extraActions: ["approve"] },
  { module: "purchaseRequestItems", label: "Purchase Request Items" },
  // Procurement — RFQ
  { module: "rfqs", label: "Requests for Quotation", extraActions: ["issue", "close"] },
  { module: "rfqItems", label: "RFQ Items" },
  { module: "rfqSuppliers", label: "RFQ Suppliers" },
  // Procurement — Supplier Quotations
  { module: "supplierQuotations", label: "Supplier Quotations", extraActions: ["award"] },
  { module: "quotationItems", label: "Quotation Items" },
  // Procurement — Purchase Orders
  { module: "purchaseOrders", label: "Purchase Orders", extraActions: ["approve", "issue"] },
  { module: "purchaseOrderItems", label: "Purchase Order Items" },
  // Procurement — Purchase Contracts
  { module: "purchaseContracts", label: "Purchase Contracts", extraActions: ["approve"] },
  { module: "purchaseContractAmendments", label: "Purchase Contract Amendments", extraActions: ["approve"] },
  // Procurement — Goods Receipt
  { module: "goodsReceiptNotes", label: "Goods Receipt Notes", extraActions: ["inspect"] },
  { module: "grnItems", label: "GRN Items" },
  // Procurement — Purchase Returns
  { module: "purchaseReturns", label: "Purchase Returns", extraActions: ["approve"] },
  { module: "purchaseReturnItems", label: "Purchase Return Items" },
  // Procurement — Approval Workflow
  { module: "procurementApprovals", label: "Procurement Approvals", extraActions: ["approve"] },
  // Inventory — Master Data
  { module: "warehouses", label: "Warehouses" },
  { module: "warehouseLocations", label: "Warehouse Locations" },
  { module: "itemCategories", label: "Item Categories" },
  { module: "itemGroups", label: "Item Groups" },
  { module: "unitsOfMeasure", label: "Units of Measure" },
  { module: "inventoryItems", label: "Inventory Items" },
  { module: "reorderLevels", label: "Reorder Levels" },
  // Inventory — Transactions
  { module: "stockOpeningBalances", label: "Stock Opening Balances" },
  { module: "goodsReceipts", label: "Goods Receipts", extraActions: ["complete"] },
  { module: "goodsReceiptItems", label: "Goods Receipt Items" },
  { module: "goodsIssues", label: "Goods Issues", extraActions: ["complete"] },
  { module: "goodsIssueItems", label: "Goods Issue Items" },
  { module: "inventoryTransfers", label: "Inventory Transfers", extraActions: ["complete"] },
  { module: "inventoryTransferItems", label: "Inventory Transfer Items" },
  { module: "stockAdjustments", label: "Stock Adjustments", extraActions: ["approve"] },
  { module: "stockAdjustmentItems", label: "Stock Adjustment Items" },
  { module: "stockCounts", label: "Stock Counts", extraActions: ["complete"] },
  { module: "stockCountItems", label: "Stock Count Items" },
  // Inventory — Ledger
  { module: "inventoryLedger", label: "Inventory Ledger" },
];
const ACTIONS = ["view", "create", "update", "delete"] as const;

async function seedPermissions(): Promise<void> {
  const values = MODULES.flatMap(({ module, label, extraActions }) =>
    [...ACTIONS, ...(extraActions ?? [])].map((action) => ({
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

const SUPER_ADMIN_PASSWORD = "Admin@123456";

async function seedSuperAdminUser(roleId: string): Promise<void> {
  const passwordHash = await hashPassword(SUPER_ADMIN_PASSWORD);
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, "superadmin"));
  if (existing) {
    await db
      .update(usersTable)
      .set({
        passwordHash,
        status: "active",
        isActive: true,
        lockedUntil: null,
        failedAttempts: 0,
      })
      .where(eq(usersTable.id, existing.id));
    const [hasRole] = await db
      .select()
      .from(userRolesTable)
      .where(
        and(
          eq(userRolesTable.userId, existing.id),
          eq(userRolesTable.roleId, roleId)
        )
      );
    if (!hasRole) {
      await db.insert(userRolesTable).values({ userId: existing.id, roleId });
    }
    console.log(
      `Super admin user reset (username: superadmin, password: ${SUPER_ADMIN_PASSWORD})`
    );
    return;
  }
  const [user] = await db
    .insert(usersTable)
    .values({
      username: "superadmin",
      fullName: "Super Administrator",
      email: "superadmin@erp.local",
      passwordHash,
      status: "active",
      isActive: true,
    })
    .returning();
  await db.insert(userRolesTable).values({ userId: user.id, roleId });
  console.log(
    `Seeded superadmin user (username: superadmin, password: ${SUPER_ADMIN_PASSWORD})`
  );
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

  // 5 customers (mix of individuals and corporate)
  const seededCustomers = await db.insert(customersTable).values(
    Array.from({ length: 5 }, (_, i) => {
      const isCompany = i >= 3;
      return {
        companyId,
        branchId,
        code: `CUST-${String(i + 1).padStart(3, "0")}`,
        fullName: isCompany ? `Acme Holdings ${i - 2}` : `Customer ${i + 1}`,
        nameAr: isCompany ? `شركة آكمي ${i - 2}` : `عميل ${i + 1}`,
        type: isCompany ? "company" : "individual",
        nationalId: isCompany ? null : `1${String(100000000 + i)}`,
        passport: isCompany ? null : `A${String(1234567 + i)}`,
        companyName: isCompany ? `Acme Holdings ${i - 2} LLC` : null,
        taxNumber: isCompany ? `30012345600${i}` : null,
        commercialRegistration: isCompany ? `CR-10203${i}` : null,
        phone: `+96655000${String(2000 + i)}`,
        email: `customer${i + 1}@example.local`,
      };
    }),
  ).returning();

  void seededCustomers;
  console.log(
    "Seeded real estate demo data: 1 project, 2 buildings, 5 floors, 20 units, 5 leads, 5 customers",
  );
}

async function seedReservations(): Promise<void> {
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.code, "HQ001"));
  if (!company) {
    console.log("No sample company found, skipping reservation demo data");
    return;
  }
  const companyId = company.id;
  const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.companyId, companyId));
  const branchId = branch?.id ?? null;

  const [existing] = await db.select().from(reservationsTable).where(eq(reservationsTable.code, "RSV-001"));
  if (existing) {
    console.log("Reservation demo data already exists, skipping");
    return;
  }

  // Backfill corporate fields on the last two demo customers (idempotent)
  await db.update(customersTable).set({
    type: "company", companyName: "Acme Holdings 1 LLC", taxNumber: "300123456001", commercialRegistration: "CR-102031",
  }).where(and(eq(customersTable.companyId, companyId), eq(customersTable.code, "CUST-004")));
  await db.update(customersTable).set({
    type: "company", companyName: "Acme Holdings 2 LLC", taxNumber: "300123456002", commercialRegistration: "CR-102032",
  }).where(and(eq(customersTable.companyId, companyId), eq(customersTable.code, "CUST-005")));

  const customers = await db.select().from(customersTable).where(eq(customersTable.companyId, companyId)).limit(5);
  const units = await db.select().from(unitsTable).where(eq(unitsTable.companyId, companyId)).limit(3);
  if (customers.length < 4 || units.length < 3) {
    console.log("Skipping reservation seed: missing customers/units");
    return;
  }

  const reservations = await db.insert(reservationsTable).values([
    { companyId, branchId, code: "RSV-001", unitId: units[0].id, customerId: customers[0].id, reservationDate: "2026-05-01", expiryDate: "2026-06-01", amount: "50000.00", status: "active", notes: "Initial hold" },
    { companyId, branchId, code: "RSV-002", unitId: units[1].id, customerId: customers[1].id, reservationDate: "2026-05-10", expiryDate: "2026-06-10", amount: "75000.00", status: "active" },
    { companyId, branchId, code: "RSV-003", unitId: units[2].id, customerId: customers[3].id, reservationDate: "2026-05-15", expiryDate: "2026-06-15", amount: "120000.00", status: "expired" },
  ]).returning();

  await db.insert(reservationNotesTable).values([
    { companyId, reservationId: reservations[0].id, note: "Customer requested a sea-view unit." },
    { companyId, reservationId: reservations[1].id, note: "Awaiting down payment confirmation." },
  ]);
  await db.insert(reservationDocumentsTable).values([
    { companyId, reservationId: reservations[0].id, docType: "national_id", docNumber: "1100000000", fileName: "id-copy.pdf", issueDate: "2020-01-01", expiryDate: "2030-01-01" },
    { companyId, reservationId: reservations[2].id, docType: "commercial_registration", docNumber: "CR-102030", fileName: "cr.pdf" },
  ]);

  const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.code, "CON-FIN-001"));
  if (contract) {
    await db.insert(contractNotesTable).values([
      { companyId, contractId: contract.id, note: "Contract signed at the head office." },
      { companyId, contractId: contract.id, note: "Down payment received in full." },
    ]);
    await db.insert(contractDocumentsTable).values([
      { companyId, contractId: contract.id, docType: "signed_contract", docNumber: "DOC-CON-001", fileName: "contract-signed.pdf", issueDate: "2025-12-01" },
      { companyId, contractId: contract.id, docType: "id_copy", docNumber: "DOC-ID-001", fileName: "buyer-id.pdf" },
    ]);
  }

  console.log("Seeded reservation demo data: 3 reservations, 2 notes, 2 documents, 2 corporate customers");
}

async function seedFinance(): Promise<void> {
  const [company] = await db.select().from(companiesTable).limit(1);
  if (!company) {
    console.log("Skipping finance seed: no company found");
    return;
  }
  const companyId = company.id;
  const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.companyId, companyId)).limit(1);
  const branchId = branch?.id ?? null;

  const existing = await db.select().from(cashboxesTable).where(eq(cashboxesTable.code, "CB-001")).limit(1);
  if (existing.length) {
    console.log("Finance demo data already seeded, skipping");
    return;
  }

  const customers = await db.select().from(customersTable).where(eq(customersTable.companyId, companyId)).limit(3);
  const units = await db.select().from(unitsTable).where(eq(unitsTable.companyId, companyId)).limit(1);
  if (!customers.length || !units.length) {
    console.log("Skipping finance seed: missing customers/units");
    return;
  }

  // 2 cashboxes, 2 bank accounts
  const [mainCashbox, branchCashbox] = await db.insert(cashboxesTable).values([
    { companyId, branchId, code: "CB-001", name: "Main Cashbox", nameAr: "الخزينة الرئيسية", openingBalance: "50000.00", currentBalance: "50000.00" },
    { companyId, branchId, code: "CB-002", name: "Branch Cashbox", nameAr: "خزينة الفرع", openingBalance: "10000.00", currentBalance: "10000.00" },
  ]).returning();

  const [mainBank] = await db.insert(bankAccountsTable).values([
    { companyId, branchId, code: "BA-001", bankName: "Al Rajhi Bank", bankNameAr: "مصرف الراجحي", accountNumber: "SA-1000-2000-3000", iban: "SA0380000000608010167519", openingBalance: "200000.00", currentBalance: "200000.00" },
    { companyId, branchId, code: "BA-002", bankName: "Saudi National Bank", bankNameAr: "البنك الأهلي السعودي", accountNumber: "SA-4000-5000-6000", iban: "SA4420000001234567891234", openingBalance: "150000.00", currentBalance: "150000.00" },
  ]).returning();

  // penalty rules (fixed + percent)
  await db.insert(penaltyRulesTable).values([
    { companyId, code: "PR-FIX", name: "Late fee (fixed)", nameAr: "غرامة تأخير (ثابتة)", daysAfterDue: 7, penaltyType: "fixed", penaltyValue: "500.00" },
    { companyId, code: "PR-PCT", name: "Late fee (2%)", nameAr: "غرامة تأخير (2%)", daysAfterDue: 30, penaltyType: "percent", penaltyValue: "2.00" },
  ]);

  // 1 contract + installment plan with an overdue schedule
  const [contract] = await db.insert(contractsTable).values({
    companyId, branchId, code: "CON-FIN-001", unitId: units[0].id, customerId: customers[0].id,
    contractDate: "2025-12-01", totalPrice: "600000.00", status: "active",
  }).returning();

  const [plan] = await db.insert(installmentPlansTable).values({
    companyId, code: "PLAN-FIN-001", contractId: contract.id, totalAmount: "500000.00",
    numberOfInstallments: 4, frequency: "quarterly", startDate: "2026-01-15", status: "active",
  }).returning();

  const schedules = await db.insert(installmentSchedulesTable).values([
    { companyId, planId: plan.id, installmentNumber: 1, dueDate: "2026-01-15", amount: "125000.00", paidAmount: "125000.00", status: "paid" },
    { companyId, planId: plan.id, installmentNumber: 2, dueDate: "2026-03-15", amount: "125000.00", paidAmount: "0.00", status: "pending" },
    { companyId, planId: plan.id, installmentNumber: 3, dueDate: "2026-09-15", amount: "125000.00", paidAmount: "0.00", status: "pending" },
    { companyId, planId: plan.id, installmentNumber: 4, dueDate: "2026-12-15", amount: "125000.00", paidAmount: "0.00", status: "pending" },
  ]).returning();

  // 3 receipts: cash, bank transfer, cheque
  const [cashReceipt, bankReceipt] = await db.insert(receiptsTable).values([
    { companyId, branchId, code: "RCP-001", customerId: customers[0].id, contractId: contract.id, scheduleId: schedules[0].id, amount: "125000.00", receiptDate: "2026-01-15", paymentMethod: "cash", cashboxId: mainCashbox.id, reference: "Installment #1", status: "confirmed" },
    { companyId, branchId, code: "RCP-002", customerId: customers[1].id, amount: "30000.00", receiptDate: "2026-02-10", paymentMethod: "bank_transfer", bankAccountId: mainBank.id, reference: "Down payment", status: "confirmed" },
    { companyId, branchId, code: "RCP-003", customerId: customers[2].id, amount: "20000.00", receiptDate: "2026-02-20", paymentMethod: "cheque", chequeNumber: "CHQ-778812", chequeDate: "2026-03-01", bankName: "Riyad Bank", status: "confirmed" },
  ]).returning();

  // matching treasury + bank transactions, and reflect balances
  await db.insert(treasuryTransactionsTable).values({
    companyId, cashboxId: mainCashbox.id, type: "in", amount: "125000.00", transactionDate: "2026-01-15",
    reference: cashReceipt.code, description: "Receipt collection (cash)", receiptId: cashReceipt.id,
  });
  await db.update(cashboxesTable).set({ currentBalance: "175000.00" }).where(eq(cashboxesTable.id, mainCashbox.id));

  await db.insert(bankTransactionsTable).values({
    companyId, bankAccountId: mainBank.id, type: "in", amount: "30000.00", transactionDate: "2026-02-10",
    reference: bankReceipt.code, description: "Receipt collection (bank transfer)", receiptId: bankReceipt.id,
  });
  await db.update(bankAccountsTable).set({ currentBalance: "230000.00" }).where(eq(bankAccountsTable.id, mainBank.id));

  void branchCashbox;
  console.log(
    "Seeded finance demo data: 2 cashboxes, 2 bank accounts, 2 penalty rules, 1 contract, 1 plan, 4 schedules, 3 receipts",
  );
}

// Default chart of accounts: [code, name, nameAr, type, normalSide, parentCode|null, isPostable]
const DEFAULT_ACCOUNTS: Array<[string, string, string, string, string, string | null, boolean]> = [
  ["1", "Assets", "الأصول", "asset", "debit", null, false],
  ["11", "Current Assets", "الأصول المتداولة", "asset", "debit", "1", false],
  ["1010", "Cash on Hand", "النقد بالصندوق", "asset", "debit", "11", true],
  ["1020", "Bank Accounts", "الحسابات البنكية", "asset", "debit", "11", true],
  ["1030", "Accounts Receivable", "الذمم المدينة", "asset", "debit", "11", true],
  ["1040", "Inventory", "المخزون", "asset", "debit", "11", true],
  ["12", "Non-Current Assets", "الأصول غير المتداولة", "asset", "debit", "1", false],
  ["1210", "Property & Equipment", "الممتلكات والمعدات", "asset", "debit", "12", true],
  ["2", "Liabilities", "الخصوم", "liability", "credit", null, false],
  ["21", "Current Liabilities", "الخصوم المتداولة", "liability", "credit", "2", false],
  ["2010", "Accounts Payable", "الذمم الدائنة", "liability", "credit", "21", true],
  ["2020", "Customer Advances", "دفعات العملاء المقدمة", "liability", "credit", "21", true],
  ["22", "Non-Current Liabilities", "الخصوم غير المتداولة", "liability", "credit", "2", false],
  ["2210", "Loans Payable", "القروض المستحقة", "liability", "credit", "22", true],
  ["3", "Equity", "حقوق الملكية", "equity", "credit", null, false],
  ["3010", "Share Capital", "رأس المال", "equity", "credit", "3", true],
  ["3020", "Retained Earnings", "الأرباح المحتجزة", "equity", "credit", "3", true],
  ["4", "Revenue", "الإيرادات", "revenue", "credit", null, false],
  ["4010", "Property Sales Revenue", "إيرادات مبيعات العقارات", "revenue", "credit", "4", true],
  ["4020", "Rental Income", "إيرادات الإيجار", "revenue", "credit", "4", true],
  ["4030", "Penalty Income", "إيرادات الغرامات", "revenue", "credit", "4", true],
  ["5", "Expenses", "المصروفات", "expense", "debit", null, false],
  ["5010", "Cost of Sales", "تكلفة المبيعات", "expense", "debit", "5", true],
  ["5020", "Salaries & Wages", "الرواتب والأجور", "expense", "debit", "5", true],
  ["5030", "General & Administrative", "مصروفات عمومية وإدارية", "expense", "debit", "5", true],
  ["5040", "Sales Commissions", "عمولات المبيعات", "expense", "debit", "5", true],
];

// Account mappings for automatic posting: [eventKey, debitCode, creditCode, description]
const DEFAULT_MAPPINGS: Array<[string, string, string, string]> = [
  ["receipt.cash", "1010", "1030", "Cash receipt from customer"],
  ["receipt.bank", "1020", "1030", "Bank receipt from customer"],
  ["receipt.cheque", "1020", "1030", "Cheque receipt from customer"],
  ["reservation.payment", "1010", "2020", "Reservation deposit"],
  ["installment.collection", "1010", "1030", "Installment collection"],
  ["treasury.in", "1010", "2020", "Cash inflow"],
  ["treasury.out", "5030", "1010", "Cash outflow"],
  ["bank.in", "1020", "2020", "Bank inflow"],
  ["bank.out", "5030", "1020", "Bank outflow"],
  ["contract.created", "1030", "4010", "Property sale recognized"],
  ["penalty.assessed", "1030", "4030", "Late-payment penalty assessed"],
  ["inventory.goods_receipt", "1040", "2010", "Goods received into inventory"],
  ["inventory.goods_issue", "5010", "1040", "Goods issued from inventory"],
  ["inventory.stock_adjustment", "5030", "1040", "Stock adjustment"],
];

const MONTH_NAMES_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_NAMES_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

async function seedAccounting(): Promise<void> {
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.code, "HQ001"));
  if (!company) {
    console.log("No sample company found, skipping accounting seed");
    return;
  }
  const companyId = company.id;

  // Chart of accounts (idempotent by company + code).
  const codeToId = new Map<string, string>();
  const existingAccounts = await db.select().from(accountsTable).where(eq(accountsTable.companyId, companyId));
  for (const a of existingAccounts) codeToId.set(a.code, a.id);
  let createdAccounts = 0;
  for (const [code, name, nameAr, type, normalSide, parentCode, isPostable] of DEFAULT_ACCOUNTS) {
    if (codeToId.has(code)) continue;
    const parentId = parentCode ? codeToId.get(parentCode) ?? null : null;
    const level = code.length <= 1 ? 1 : code.length === 2 ? 2 : 3;
    const [row] = await db
      .insert(accountsTable)
      .values({ companyId, code, name, nameAr, type, normalSide, parentId, level, isPostable, status: "active" })
      .returning();
    codeToId.set(code, row.id);
    createdAccounts += 1;
  }

  // Cost centers (idempotent by company + code).
  const existingCc = await db.select().from(costCentersTable).where(eq(costCentersTable.companyId, companyId));
  if (!existingCc.length) {
    await db.insert(costCentersTable).values([
      { companyId, code: "HO", name: "Head Office", nameAr: "المركز الرئيسي", kind: "department", status: "active" },
      { companyId, code: "SALES", name: "Sales Department", nameAr: "قسم المبيعات", kind: "department", status: "active" },
    ]);
  }

  // Account mappings (idempotent by company + eventKey).
  const existingMappings = await db.select().from(accountMappingsTable).where(eq(accountMappingsTable.companyId, companyId));
  const mappedKeys = new Set(existingMappings.map((m) => m.eventKey));
  let createdMappings = 0;
  for (const [eventKey, debitCode, creditCode, description] of DEFAULT_MAPPINGS) {
    if (mappedKeys.has(eventKey)) continue;
    const debitAccountId = codeToId.get(debitCode) ?? null;
    const creditAccountId = codeToId.get(creditCode) ?? null;
    await db.insert(accountMappingsTable).values({ companyId, eventKey, debitAccountId, creditAccountId, description });
    createdMappings += 1;
  }

  // Monthly fiscal periods from each fiscal year (idempotent by company + year + periodNumber).
  const fiscalYears = await db.select().from(fiscalYearsTable).where(eq(fiscalYearsTable.companyId, companyId));
  let createdPeriods = 0;
  for (const fy of fiscalYears) {
    const existing = await db
      .select()
      .from(fiscalPeriodsTable)
      .where(and(eq(fiscalPeriodsTable.companyId, companyId), eq(fiscalPeriodsTable.fiscalYearId, fy.id)));
    if (existing.length) continue;
    const year = Number(fy.startDate.slice(0, 4));
    for (let m = 0; m < 12; m += 1) {
      const start = new Date(Date.UTC(year, m, 1));
      const end = new Date(Date.UTC(year, m + 1, 0));
      await db.insert(fiscalPeriodsTable).values({
        companyId,
        fiscalYearId: fy.id,
        name: `${MONTH_NAMES_EN[m]} ${year}`,
        nameAr: `${MONTH_NAMES_AR[m]} ${year}`,
        periodNumber: m + 1,
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        status: "open",
      });
      createdPeriods += 1;
    }
  }

  console.log(
    `Seeded accounting: ${createdAccounts} accounts, ${createdMappings} mappings, ${createdPeriods} fiscal periods`,
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
  await seedFinance();
  await seedReservations();
  await seedAccounting();
  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
