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
  taxCodesTable,
  departmentsTable,
  sectionsTable,
  jobTitlesTable,
  employeesTable,
  shiftsTable,
  leaveTypesTable,
  leaveBalancesTable,
  salaryComponentsTable,
  payrollPeriodsTable,
  contractorContractsTable,
  purchaseContractsTable,
  legalContractsTable,
  contractTemplatesTable,
  lawFirmsTable,
  legalAdvisorsTable,
  legalCasesTable,
  legalHearingsTable,
  legalClaimsTable,
  legalNoticesTable,
  customerUsersTable,
  maintenanceRequestsTable,
  complaintsTable,
  customerNotificationsTable,
  supportTicketsTable,
  supportTicketMessagesTable,
  lookupTypesTable,
  lookupValuesTable,
} from "@workspace/db";
import { LABELS, LOOKUP_CATEGORIES } from "@workspace/master-data";
import { hashPassword } from "./lib/auth";

const MODULES: Array<{ module: string; label: string; extraActions?: string[] }> = [
  { module: "users", label: "Users" },
  { module: "roles", label: "Roles & Permissions" },
  { module: "companies", label: "Companies" },
  { module: "branches", label: "Branches" },
  { module: "fiscalYears", label: "Fiscal Years", extraActions: ["close", "reopen"] },
  { module: "currencies", label: "Currencies" },
  { module: "numberSequences", label: "Document Numbering" },
  { module: "settings", label: "System Settings" },
  { module: "masterData", label: "Master Data", extraActions: ["archive", "reorder"] },
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
  { module: "receipts", label: "Receipt Vouchers", extraActions: ["approve", "post", "reverse", "cancel"] },
  { module: "paymentVouchers", label: "Payment Vouchers", extraActions: ["approve", "post", "reverse", "cancel"] },
  { module: "customerInvoices", label: "Customer Invoices", extraActions: ["post", "reverse", "cancel"] },
  { module: "supplierInvoices", label: "Supplier Invoices", extraActions: ["post", "reverse", "cancel"] },
  { module: "taxCodes", label: "Tax Codes" },
  { module: "cheques", label: "Cheques" },
  { module: "penalties", label: "Penalties" },
  { module: "accounts", label: "Chart of Accounts" },
  { module: "costCenters", label: "Cost Centers" },
  { module: "profitCenters", label: "Profit Centers" },
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
  { module: "paymentCertificates", label: "Payment Certificates", extraActions: ["approve", "verify", "submit", "review", "post", "pay", "close"] },
  { module: "certificateItems", label: "Certificate Items" },
  { module: "certificateStatuses", label: "Certificate Statuses" },
  { module: "certificateApprovals", label: "Certificate Approvals", extraActions: ["approve", "reject"] },
  { module: "certificateApprovalLogs", label: "Certificate Approval Logs" },
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
  // Human Resources — Organization
  { module: "departments", label: "Departments" },
  { module: "sections", label: "Sections" },
  { module: "jobTitles", label: "Job Titles" },
  // Human Resources — Employees
  { module: "employees", label: "Employees" },
  { module: "employeeDocuments", label: "Employee Documents" },
  { module: "employeeEmergencyContacts", label: "Employee Emergency Contacts" },
  // Human Resources — Attendance
  { module: "shifts", label: "Shifts" },
  { module: "attendanceRecords", label: "Attendance Records" },
  // Human Resources — Leave
  { module: "leaveTypes", label: "Leave Types" },
  { module: "leaveBalances", label: "Leave Balances" },
  { module: "leaveRequests", label: "Leave Requests", extraActions: ["submit", "approve", "reject"] },
  // Human Resources — Payroll
  { module: "salaryComponents", label: "Salary Components" },
  { module: "payrollPeriods", label: "Payroll Periods" },
  { module: "payrollRuns", label: "Payroll Runs", extraActions: ["approve", "post", "reverse"] },
  { module: "payslips", label: "Payslips" },
  { module: "payslipLines", label: "Payslip Lines" },
  // Human Resources — Loans & Advances
  { module: "employeeLoans", label: "Employee Loans", extraActions: ["approve", "disburse"] },
  { module: "loanInstallments", label: "Loan Installments" },
  { module: "employeeAdvances", label: "Employee Advances", extraActions: ["approve", "pay"] },
  // Human Resources — Performance
  { module: "kpiTemplates", label: "KPI Templates" },
  { module: "employeeEvaluations", label: "Employee Evaluations" },
  { module: "employeeEvaluationLines", label: "Employee Evaluation Lines" },
  // Legal Affairs — Contract Governance
  { module: "legalContracts", label: "Legal Contracts", extraActions: ["review", "approve", "activate", "suspend", "terminate", "renew"] },
  { module: "contractTemplates", label: "Contract Templates" },
  { module: "contractVersions", label: "Contract Versions" },
  { module: "legalContractAmendments", label: "Legal Contract Amendments" },
  { module: "contractAddendums", label: "Contract Addendums" },
  { module: "legalContractAttachments", label: "Contract Attachments" },
  { module: "contractEvents", label: "Contract Events" },
  // Legal Affairs — Litigation & Advisory
  { module: "lawFirms", label: "Law Firms" },
  { module: "legalAdvisors", label: "Legal Advisors" },
  { module: "legalCases", label: "Legal Cases", extraActions: ["close", "reopen"] },
  { module: "legalHearings", label: "Legal Hearings" },
  { module: "legalClaims", label: "Legal Claims" },
  { module: "legalNotices", label: "Legal Notices", extraActions: ["send"] },
  { module: "legalCaseLinks", label: "Legal Case Links" },
  { module: "bi", label: "Business Intelligence" },
  // CRM & Sales Center — a business layer over existing entities (no new tables).
  // crm.view gates the CRM hub (dashboard, search, customer profile, available
  // units, sales performance). Per-entity actions reuse the existing module codes.
  { module: "crm", label: "CRM & Sales" },
  // Land Bank Management
  { module: "landParcels", label: "Land Parcels" },
  { module: "landOwnerships", label: "Land Ownership Records" },
  { module: "landLegalStatuses", label: "Land Legal Status" },
  { module: "landUtilizations", label: "Land Utilization" },
  { module: "landDocuments", label: "Land Documents" },
  { module: "landAcquisitions", label: "Land Acquisition Records" },
  // Unit Handover
  { module: "handoverRequests", label: "Handover Requests" },
  { module: "handoverSchedules", label: "Handover Schedules" },
  { module: "handoverChecklistItems", label: "Handover Checklist Items" },
  { module: "handoverMinutes", label: "Handover Minutes" },
  { module: "handoverSnags", label: "Handover Snags" },
  { module: "handoverApprovals", label: "Handover Approvals", extraActions: ["approve", "reject"] },
  // Customer Service
  { module: "slaPolicies", label: "SLA Policies" },
  { module: "serviceEscalations", label: "Service Escalations", extraActions: ["resolve"] },
  { module: "complaints", label: "Complaints" },
  { module: "maintenanceRequests", label: "Maintenance Requests" },
  { module: "supportTickets", label: "Customer Requests" },
  { module: "callLogs", label: "Call Center" },
  { module: "workOrders", label: "Work Orders" },
  { module: "customerSatisfactionSurveys", label: "Satisfaction Surveys" },
  // Fixed Assets
  { module: "assetCategories", label: "Asset Categories" },
  { module: "fixedAssets", label: "Fixed Assets" },
  { module: "assetTransfers", label: "Asset Transfers", extraActions: ["approve"] },
  { module: "assetDepreciations", label: "Asset Depreciation", extraActions: ["post", "reverse"] },
  { module: "assetInventoryCounts", label: "Asset Inventory Counts" },
  { module: "assetDisposals", label: "Asset Disposals", extraActions: ["approve"] },
  // General Administration
  { module: "correspondence", label: "Correspondence" },
  { module: "meetings", label: "Meetings" },
  { module: "administrativeDecisions", label: "Administrative Decisions" },
  { module: "administrativeTasks", label: "Administrative Tasks" },
  { module: "generalServices", label: "General Services" },
  { module: "vehicles", label: "Vehicles" },
  { module: "drivers", label: "Drivers" },
  { module: "vehicleMissions", label: "Vehicle Missions" },
  { module: "vehicleMaintenance", label: "Vehicle Maintenance" },
  { module: "visitorLogs", label: "Visitor Logs" },
  { module: "circulars", label: "Circulars" },
  { module: "policies", label: "Policies" },
  // Insurance Management (standalone module)
  { module: "employeeInsurances", label: "Employee Insurances" },
  { module: "insuranceForms", label: "Insurance Forms" },
  { module: "insuranceAdditions", label: "Insurance Additions" },
  { module: "insuranceExclusions", label: "Insurance Exclusions" },
  { module: "insuranceDataAmendments", label: "Insurance Data Amendments" },
  { module: "insuranceSubscriptions", label: "Insurance Subscriptions" },
  { module: "insurancePaymentNotices", label: "Insurance Payment Notices" },
  { module: "insuranceReconciliations", label: "Insurance Reconciliations" },
  { module: "insuranceArrears", label: "Insurance Arrears" },
  { module: "insurancePenalties", label: "Insurance Penalties" },
  { module: "serviceTerminations", label: "Service Terminations" },
  { module: "insuranceSettlements", label: "Insurance Settlements" },
  { module: "insuranceClearances", label: "Insurance Clearances" },
  { module: "subcontractorInsurances", label: "Subcontractor Insurances" },
  { module: "projectLaborInsurances", label: "Project Labor Insurances" },
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

// CRM & Sales roles — least-privilege role templates built from EXISTING permission
// codes. Money stays read-only (no receipts.create / installmentCollections.create)
// and contracts stay under Legal Affairs (contracts.view only — no create/update/
// delete/approve). Re-running upserts the permission set so the roles stay current.
async function seedCrmRoles(): Promise<void> {
  const crud = (m: string): string[] => [`${m}.view`, `${m}.create`, `${m}.update`, `${m}.delete`];
  const cru = (m: string): string[] => [`${m}.view`, `${m}.create`, `${m}.update`];
  const cr = (m: string): string[] => [`${m}.view`, `${m}.create`];
  const view = (m: string): string[] => [`${m}.view`];

  // Read-only context shared by every CRM role: the CRM hub, the real-estate
  // catalogue, contract status (Legal Affairs owns the workflow), and finance/
  // collections figures (payment status مستحق/مدفوع/متأخر) — all view-only.
  const sharedRead = [
    "crm.view",
    ...view("projects"), ...view("buildings"), ...view("floors"),
    ...view("units"), ...view("unitTypes"), ...view("unitStatuses"),
    ...view("leadSources"),
    ...view("contracts"), // view contract status / open linked record only
    ...view("installmentPlans"), ...view("installmentSchedules"),
    ...view("installmentCollections"), ...view("receipts"),
  ];

  // Sales User — front-line rep: works leads, customers, communication history,
  // follow-ups and reservations; never deletes and never touches money/contracts.
  const salesUser = [
    ...sharedRead,
    ...cru("leads"), ...cru("leadActivities"), ...cru("leadFollowUps"),
    ...cru("customers"), ...cru("customerContacts"),
    ...cru("customerDocuments"), ...cru("customerNotes"),
    ...cru("reservations"), ...cru("reservationNotes"),
    ...cru("reservationDocuments"), ...cr("reservationPayments"),
  ];

  // Sales Admin — team lead: everything a rep can do, plus delete/cleanup,
  // lead assignment/distribution and conversions. Still no money, no contracts.
  const salesAdmin = Array.from(new Set([
    ...salesUser,
    ...crud("leads"), ...crud("leadActivities"), ...crud("leadFollowUps"),
    ...crud("customers"), ...crud("customerContacts"),
    ...crud("customerDocuments"), ...crud("customerNotes"),
    ...crud("reservations"), ...crud("reservationNotes"),
    ...crud("reservationDocuments"), ...crud("reservationPayments"),
    ...crud("leadAssignments"), ...crud("leadConversions"),
    ...cru("leadSources"),
  ]));

  // CRM Manager — oversight: full CRM management plus audit visibility. Money and
  // contract workflow remain read-only (governed by Finance and Legal Affairs).
  const crmManager = Array.from(new Set([
    ...salesAdmin,
    ...view("audit"),
    ...view("customerInvoices"),
  ]));

  const roles: Array<{ name: string; description: string; permissions: string[] }> = [
    { name: "Sales User", description: "Front-line sales rep: leads, customers, follow-ups, reservations. Read-only on money and contracts.", permissions: salesUser },
    { name: "Sales Admin", description: "Sales team lead: lead distribution, conversions, reservation management. Read-only on money and contracts.", permissions: salesAdmin },
    { name: "CRM Manager", description: "CRM oversight: full sales/CRM management with audit visibility. Read-only on money and contract workflow.", permissions: crmManager },
  ];

  for (const r of roles) {
    const [existing] = await db.select().from(rolesTable).where(eq(rolesTable.name, r.name));
    if (existing) {
      await db.update(rolesTable).set({ description: r.description, permissions: r.permissions }).where(eq(rolesTable.id, existing.id));
    } else {
      await db.insert(rolesTable).values({ name: r.name, description: r.description, permissions: r.permissions });
    }
  }
  console.log(`Seeded ${roles.length} CRM roles (Sales User, Sales Admin, CRM Manager)`);
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
      { documentType: "Payment Voucher", prefix: "PV", padding: 5, resetYearly: true },
      { documentType: "Customer Invoice", prefix: "CINV", padding: 5, resetYearly: true },
      { documentType: "Supplier Invoice", prefix: "SINV", padding: 5, resetYearly: true },
      { documentType: "Contract", prefix: "CON", padding: 4, resetYearly: false },
      { documentType: "Journal Entry", prefix: "JE", padding: 6, resetYearly: true },
      { documentType: "Employee", prefix: "EMP", padding: 5, resetYearly: false },
      { documentType: "Payroll Run", prefix: "PR", padding: 5, resetYearly: true },
      { documentType: "Leave Request", prefix: "LV", padding: 5, resetYearly: true },
      { documentType: "Employee Loan", prefix: "LOAN", padding: 5, resetYearly: false },
      { documentType: "Employee Advance", prefix: "ADV", padding: 5, resetYearly: false },
      { documentType: "Legal Contract", prefix: "LGC", padding: 5, resetYearly: false },
      { documentType: "Legal Case", prefix: "CASE", padding: 5, resetYearly: true },
      { documentType: "Legal Claim", prefix: "CLM", padding: 5, resetYearly: true },
      { documentType: "Legal Notice", prefix: "NOT", padding: 5, resetYearly: true },
      { documentType: "Legal Hearing", prefix: "HRG", padding: 5, resetYearly: true },
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
  ["1050", "Cheques Under Collection", "شيكات تحت التحصيل", "asset", "debit", "11", true],
  ["1060", "Input VAT Receivable", "ضريبة القيمة المضافة على المشتريات", "asset", "debit", "11", true],
  ["1070", "Employee Loans Receivable", "قروض الموظفين", "asset", "debit", "11", true],
  ["1080", "Employee Advances", "سلف الموظفين", "asset", "debit", "11", true],
  ["12", "Non-Current Assets", "الأصول غير المتداولة", "asset", "debit", "1", false],
  ["1210", "Property & Equipment", "الممتلكات والمعدات", "asset", "debit", "12", true],
  ["2", "Liabilities", "الخصوم", "liability", "credit", null, false],
  ["21", "Current Liabilities", "الخصوم المتداولة", "liability", "credit", "2", false],
  ["2010", "Accounts Payable", "الذمم الدائنة", "liability", "credit", "21", true],
  ["2020", "Customer Advances", "دفعات العملاء المقدمة", "liability", "credit", "21", true],
  ["2030", "Cheques Payable", "شيكات مستحقة الدفع", "liability", "credit", "21", true],
  ["2040", "Output VAT Payable", "ضريبة القيمة المضافة على المبيعات", "liability", "credit", "21", true],
  ["2050", "Salaries Payable", "رواتب مستحقة الدفع", "liability", "credit", "21", true],
  ["2060", "Employee Deductions Payable", "استقطاعات الموظفين", "liability", "credit", "21", true],
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
  ["receipt.cheque", "1050", "1030", "Cheque receipt from customer (into Cheques Under Collection)"],
  ["payment.cash", "2010", "1010", "Cash payment to supplier/contractor"],
  ["payment.bank", "2010", "1020", "Bank payment to supplier/contractor"],
  ["payment.cheque", "2010", "2030", "Cheque payment to supplier/contractor"],
  ["invoice.customer.revenue", "1030", "4010", "Customer invoice revenue"],
  ["invoice.customer.tax", "1030", "2040", "Customer invoice output VAT"],
  ["invoice.supplier.expense", "5030", "2010", "Supplier invoice expense"],
  ["invoice.supplier.tax", "1060", "2010", "Supplier invoice input VAT"],
  ["cheque.incoming.returned", "1030", "1050", "Incoming cheque returned/bounced"],
  ["reservation.payment", "1010", "2020", "Reservation deposit"],
  ["installment.collection", "1010", "1030", "Installment collection"],
  ["treasury.in", "1010", "2020", "Cash inflow"],
  ["treasury.out", "5030", "1010", "Cash outflow"],
  ["bank.in", "1020", "2020", "Bank inflow"],
  ["bank.out", "5030", "1020", "Bank outflow"],
  ["contract.created", "1030", "4010", "Property sale recognized"],
  ["penalty.assessed", "1030", "4030", "Late-payment penalty assessed"],
  ["cheque.incoming.collection", "1050", "1030", "Incoming cheque under collection"],
  ["cheque.outgoing.collection", "2010", "2030", "Outgoing cheque issued for payment"],
  ["cheque.incoming.cleared", "1020", "1050", "Incoming cheque cleared"],
  ["cheque.outgoing.cleared", "2030", "1020", "Outgoing cheque cleared"],
  ["inventory.goods_receipt", "1040", "2010", "Goods received into inventory"],
  ["inventory.goods_issue", "5010", "1040", "Goods issued from inventory"],
  ["inventory.stock_adjustment", "5030", "1040", "Stock adjustment"],
  ["payroll.salaries", "5020", "2050", "Payroll: salary expense vs salaries payable"],
  ["payroll.deductions", "5020", "2060", "Payroll: employee deductions payable"],
  ["loan.disbursement", "1070", "1020", "Employee loan disbursed from bank"],
  ["advance.payment", "1080", "1010", "Employee advance paid in cash"],
  ["legal.fees", "5030", "1010", "Legal fees expense paid in cash"],
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

  // Reconcile the cheque clearing mappings to the two-phase (collection -> clearing)
  // model. These event keys predate the bridge accounts (1050 / 2030), so existing
  // rows are skipped by the idempotent insert above and must be re-pointed here.
  const chequeMappingFixes: Array<[string, string, string]> = [
    ["cheque.incoming.cleared", "1020", "1050"],
    ["cheque.outgoing.cleared", "2030", "1020"],
    // A cheque receipt settles AR into the Cheques Under Collection bridge (1050),
    // mirroring how payment.cheque settles AP into Cheques Payable (2030). The cheque
    // record's clearing leg then drains the bridge into Bank. Earlier seeds pointed
    // the debit at Bank (1020) directly, which double-counted Bank/AR once a linked
    // cheque also cleared, so re-point existing rows to the bridge here.
    ["receipt.cheque", "1050", "1030"],
  ];
  for (const [eventKey, debitCode, creditCode] of chequeMappingFixes) {
    const debitAccountId = codeToId.get(debitCode) ?? null;
    const creditAccountId = codeToId.get(creditCode) ?? null;
    if (!debitAccountId || !creditAccountId) continue;
    await db
      .update(accountMappingsTable)
      .set({ debitAccountId, creditAccountId })
      .where(and(eq(accountMappingsTable.companyId, companyId), eq(accountMappingsTable.eventKey, eventKey)));
  }

  // Sample VAT tax codes (idempotent by company + code).
  const existingTaxCodes = await db.select().from(taxCodesTable).where(eq(taxCodesTable.companyId, companyId));
  const taxCodeKeys = new Set(existingTaxCodes.map((t) => t.code));
  const outputVatId = codeToId.get("2040") ?? null;
  const inputVatId = codeToId.get("1060") ?? null;
  const sampleTaxCodes: Array<{ code: string; name: string; nameAr: string; taxType: string; rate: string; taxAccountId: string | null }> = [
    { code: "VAT15", name: "Output VAT 15%", nameAr: "ضريبة القيمة المضافة 15%", taxType: "output", rate: "15", taxAccountId: outputVatId },
    { code: "VAT15-IN", name: "Input VAT 15%", nameAr: "ضريبة المدخلات 15%", taxType: "input", rate: "15", taxAccountId: inputVatId },
    { code: "VAT0", name: "Zero-rated 0%", nameAr: "معفاة بنسبة صفر", taxType: "output", rate: "0", taxAccountId: outputVatId },
    { code: "EXEMPT", name: "Exempt", nameAr: "معفاة", taxType: "exempt", rate: "0", taxAccountId: null },
  ];
  let createdTaxCodes = 0;
  for (const tc of sampleTaxCodes) {
    if (taxCodeKeys.has(tc.code)) continue;
    await db.insert(taxCodesTable).values({ companyId, ...tc, status: "active" });
    createdTaxCodes += 1;
  }
  console.log(`Seeded ${createdTaxCodes} tax codes`);

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

async function seedHr(): Promise<void> {
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.code, "HQ001"));
  if (!company) {
    console.log("No sample company found, skipping HR seed");
    return;
  }
  const companyId = company.id;
  const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.companyId, companyId));
  const branchId = branch?.id ?? null;

  const existingDepts = await db.select().from(departmentsTable).where(eq(departmentsTable.companyId, companyId));
  if (existingDepts.length) {
    console.log("HR demo data already present, skipping");
    return;
  }

  const deptDefs: Array<{ code: string; name: string; nameAr: string }> = [
    { code: "HR", name: "Human Resources", nameAr: "الموارد البشرية" },
    { code: "FIN", name: "Finance", nameAr: "المالية" },
    { code: "OPS", name: "Operations", nameAr: "العمليات" },
  ];
  const deptIds = new Map<string, string>();
  for (const d of deptDefs) {
    const [row] = await db.insert(departmentsTable).values({ companyId, ...d, status: "active" }).returning();
    deptIds.set(d.code, row.id);
  }

  const [hrSection] = await db
    .insert(sectionsTable)
    .values({ companyId, code: "HR-REC", name: "Recruitment", nameAr: "التوظيف", departmentId: deptIds.get("HR"), status: "active" })
    .returning();

  const jobDefs: Array<{ code: string; name: string; nameAr: string; dept: string; grade: string }> = [
    { code: "MGR", name: "Manager", nameAr: "مدير", dept: "HR", grade: "A" },
    { code: "ACC", name: "Accountant", nameAr: "محاسب", dept: "FIN", grade: "B" },
    { code: "ENG", name: "Engineer", nameAr: "مهندس", dept: "OPS", grade: "B" },
  ];
  const jobIds = new Map<string, string>();
  for (const j of jobDefs) {
    const [row] = await db
      .insert(jobTitlesTable)
      .values({ companyId, code: j.code, name: j.name, nameAr: j.nameAr, departmentId: deptIds.get(j.dept), grade: j.grade, status: "active" })
      .returning();
    jobIds.set(j.code, row.id);
  }

  const empDefs: Array<{ code: string; firstName: string; lastName: string; firstNameAr: string; lastNameAr: string; dept: string; job: string; salary: string; hireDate: string }> = [
    { code: "EMP00001", firstName: "Ahmed", lastName: "Ali", firstNameAr: "أحمد", lastNameAr: "علي", dept: "HR", job: "MGR", salary: "15000", hireDate: "2022-01-15" },
    { code: "EMP00002", firstName: "Sara", lastName: "Hassan", firstNameAr: "سارة", lastNameAr: "حسن", dept: "FIN", job: "ACC", salary: "9000", hireDate: "2023-03-01" },
    { code: "EMP00003", firstName: "Omar", lastName: "Khalid", firstNameAr: "عمر", lastNameAr: "خالد", dept: "OPS", job: "ENG", salary: "11000", hireDate: "2021-06-20" },
  ];
  const empIds: string[] = [];
  for (const e of empDefs) {
    const [row] = await db
      .insert(employeesTable)
      .values({
        companyId,
        branchId,
        code: e.code,
        firstName: e.firstName,
        lastName: e.lastName,
        firstNameAr: e.firstNameAr,
        lastNameAr: e.lastNameAr,
        departmentId: deptIds.get(e.dept),
        sectionId: e.dept === "HR" ? hrSection.id : null,
        jobTitleId: jobIds.get(e.job),
        employmentType: "full_time",
        hireDate: e.hireDate,
        basicSalary: e.salary,
        status: "active",
      })
      .returning();
    empIds.push(row.id);
  }

  await db.insert(shiftsTable).values({
    companyId, code: "DAY", name: "Day Shift", nameAr: "الوردية الصباحية",
    startTime: "08:00", endTime: "17:00", breakMinutes: 60, workHours: "8", status: "active",
  });

  const leaveTypeDefs: Array<{ code: string; name: string; nameAr: string; days: string; paid: boolean }> = [
    { code: "ANNUAL", name: "Annual Leave", nameAr: "إجازة سنوية", days: "21", paid: true },
    { code: "SICK", name: "Sick Leave", nameAr: "إجازة مرضية", days: "14", paid: true },
  ];
  const leaveTypeIds = new Map<string, string>();
  for (const lt of leaveTypeDefs) {
    const [row] = await db
      .insert(leaveTypesTable)
      .values({ companyId, code: lt.code, name: lt.name, nameAr: lt.nameAr, daysPerYear: lt.days, isPaid: lt.paid, carryForward: lt.code === "ANNUAL", status: "active" })
      .returning();
    leaveTypeIds.set(lt.code, row.id);
  }

  const year = new Date().getUTCFullYear();
  for (const empId of empIds) {
    for (const [code, ltId] of leaveTypeIds) {
      const entitled = code === "ANNUAL" ? "21" : "14";
      await db.insert(leaveBalancesTable).values({
        companyId, employeeId: empId, leaveTypeId: ltId, year, entitled, used: "0", remaining: entitled,
      });
    }
  }

  const componentDefs: Array<{ code: string; name: string; nameAr: string; type: string; amount: string }> = [
    { code: "BASIC", name: "Basic Salary", nameAr: "الراتب الأساسي", type: "earning", amount: "0" },
    { code: "HOUSING", name: "Housing Allowance", nameAr: "بدل سكن", type: "earning", amount: "2000" },
    { code: "TRANSPORT", name: "Transport Allowance", nameAr: "بدل مواصلات", type: "earning", amount: "800" },
    { code: "GOSI", name: "Social Insurance", nameAr: "التأمينات الاجتماعية", type: "deduction", amount: "500" },
  ];
  for (const c of componentDefs) {
    await db.insert(salaryComponentsTable).values({
      companyId, code: c.code, name: c.name, nameAr: c.nameAr, componentType: c.type,
      calculationType: "fixed", amount: c.amount, status: "active",
    });
  }

  const month = new Date().getUTCMonth();
  const periodStart = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const periodEnd = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
  await db.insert(payrollPeriodsTable).values({
    companyId,
    code: `PP-${year}-${String(month + 1).padStart(2, "0")}`,
    name: `${MONTH_NAMES_EN[month]} ${year}`,
    year,
    month: month + 1,
    startDate: periodStart,
    endDate: periodEnd,
    payDate: periodEnd,
    status: "open",
  });

  console.log(`Seeded HR: ${deptDefs.length} departments, ${empDefs.length} employees, ${leaveTypeDefs.length} leave types, ${componentDefs.length} salary components`);
}

function mapLegalStatus(s: string | null | undefined): string {
  const v = (s ?? "").toLowerCase();
  if (["cancelled", "canceled"].includes(v)) return "cancelled";
  if (["terminated"].includes(v)) return "terminated";
  if (["draft", "pending"].includes(v)) return "draft";
  return "active";
}

// Idempotently registers every existing sales/construction/procurement contract
// into the legal_contracts master registry (keyed by sourceModule + sourceId)
// and sets the nullable back-link on the source row. Never mutates financial
// fields or FKs on the source contracts, so accounting/installments/AR-AP are
// untouched. Returns per-module counts for the validation report.
async function backfillLegalContracts(): Promise<Record<string, { total: number; created: number }>> {
  // Always run across ALL companies — the per-module `run` below iterates every
  // non-deleted source contract regardless of company, so the registry stays the
  // master record of every contract even in non-demo environments. (Previously
  // this was gated on a demo company code, which silently skipped backfill when
  // that company was absent, leaving the registry empty.)
  const result: Record<string, { total: number; created: number }> = {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function run(module: string, sourceTable: any, map: (row: any) => Record<string, unknown>): Promise<void> {
    const rows = (await db.select().from(sourceTable).where(eq(sourceTable.isDeleted, false))) as Record<string, unknown>[];
    const existing = (await db
      .select({ id: legalContractsTable.id, sourceId: legalContractsTable.sourceId })
      .from(legalContractsTable)
      .where(and(eq(legalContractsTable.sourceModule, module), eq(legalContractsTable.isDeleted, false)))) as { id: string; sourceId: string | null }[];
    // Map each already-registered sourceId -> its legal_contracts id, so reruns can heal back-links.
    const registered = new Map<string, string>();
    for (const e of existing) {
      if (e.sourceId) registered.set(e.sourceId, e.id);
    }
    let created = 0;
    for (const row of rows) {
      const sourceId = row.id as string;
      // Resolve (or create) the registry row for this source contract.
      let legalId = registered.get(sourceId);
      if (!legalId) {
        const [inserted] = await db.insert(legalContractsTable).values(map(row) as typeof legalContractsTable.$inferInsert).returning();
        legalId = inserted.id;
        registered.set(sourceId, legalId);
        created += 1;
      }
      // Heal the back-link whenever it is still null — idempotent across partial/interrupted runs.
      // Only ever fill a null reference; never overwrite an existing one.
      if (row.legalContractId == null) {
        await db.update(sourceTable).set({ legalContractId: legalId }).where(eq(sourceTable.id, sourceId));
      }
    }
    // Post-backfill validation: every non-deleted source row must now be both registered and back-linked.
    const linked = rows.filter((r) => r.legalContractId != null || registered.has(r.id as string)).length;
    if (linked !== rows.length) {
      console.warn(`Legal backfill WARNING — ${module}: ${linked}/${rows.length} source rows linked (mismatch)`);
    }
    result[module] = { total: rows.length, created };
  }

  await run("sales", contractsTable, (row) => ({
    companyId: row.companyId,
    branchId: row.branchId ?? null,
    code: `SLC-${row.code}`,
    title: String(row.code),
    contractType: "sales",
    sourceModule: "sales",
    sourceId: row.id,
    counterpartyType: "customer",
    counterpartyId: row.customerId ?? null,
    status: mapLegalStatus(row.status as string),
    contractDate: row.contractDate ?? null,
    value: String(row.totalPrice ?? "0"),
  }));

  await run("construction", contractorContractsTable, (row) => ({
    companyId: row.companyId,
    code: `CTC-${row.code}`,
    title: String(row.title ?? row.code),
    titleAr: row.titleAr ?? null,
    contractType: "construction",
    sourceModule: "construction",
    sourceId: row.id,
    counterpartyType: "contractor",
    counterpartyId: row.contractorId ?? null,
    status: mapLegalStatus(row.status as string),
    contractDate: row.startDate ?? null,
    effectiveDate: row.startDate ?? null,
    expiryDate: row.endDate ?? null,
    value: String(row.contractValue ?? "0"),
    description: row.description ?? null,
  }));

  await run("procurement", purchaseContractsTable, (row) => ({
    companyId: row.companyId,
    code: `PRC-${row.code}`,
    title: String(row.title ?? row.code),
    titleAr: row.titleAr ?? null,
    contractType: "procurement",
    sourceModule: "procurement",
    sourceId: row.id,
    counterpartyType: "supplier",
    counterpartyId: row.supplierId ?? null,
    status: mapLegalStatus(row.status as string),
    contractDate: row.startDate ?? null,
    effectiveDate: row.startDate ?? null,
    expiryDate: row.endDate ?? null,
    value: String(row.contractValue ?? "0"),
    description: row.description ?? null,
  }));

  const summary = Object.entries(result)
    .map(([m, c]) => `${m}: ${c.created}/${c.total} registered`)
    .join(", ");
  console.log(`Legal backfill — ${summary || "nothing to register"}`);
  return result;
}

async function seedLegal(): Promise<void> {
  const [company] = await db.select().from(companiesTable).where(eq(companiesTable.code, "HQ001"));
  if (!company) {
    console.log("No sample company found, skipping legal demo data");
    return;
  }
  const companyId = company.id;

  const [existingFirm] = await db.select().from(lawFirmsTable).where(eq(lawFirmsTable.code, "LF001"));
  if (existingFirm) {
    console.log("Legal demo data already exists, skipping");
    return;
  }

  await db.insert(contractTemplatesTable).values([
    { companyId, code: "TPL-NDA", name: "Non-Disclosure Agreement", nameAr: "اتفاقية عدم الإفصاح", contractType: "legal", description: "Standard NDA template" },
    { companyId, code: "TPL-SVC", name: "Service Agreement", nameAr: "اتفاقية خدمات", contractType: "legal", description: "Standard service agreement template" },
  ]);

  const [firm] = await db
    .insert(lawFirmsTable)
    .values({ companyId, code: "LF001", name: "Al Adala Law Firm", nameAr: "مكتب العدالة للمحاماة", contactPerson: "Khalid Al Otaibi", phone: "+966500001111", email: "info@aladala.local", specialization: "Commercial & Real Estate" })
    .returning();

  const [advisor] = await db
    .insert(legalAdvisorsTable)
    .values({ companyId, code: "ADV001", name: "Sara Al Harbi", nameAr: "سارة الحربي", advisorType: "external", lawFirmId: firm.id, phone: "+966500002222", email: "sara@aladala.local", specialization: "Litigation", barNumber: "BAR-2099" })
    .returning();

  const [legalCase] = await db
    .insert(legalCasesTable)
    .values({
      companyId,
      code: "CASE-00001",
      title: "Contract dispute — Tower A supplier",
      titleAr: "نزاع تعاقدي — مورد البرج أ",
      caseType: "commercial",
      role: "plaintiff",
      status: "in_progress",
      courtName: "Riyadh Commercial Court",
      courtCaseNumber: "RC-2026-1456",
      filingDate: `${new Date().getUTCFullYear()}-02-10`,
      opponentName: "Falcon Supplies Co.",
      claimAmount: "250000",
      advisorId: advisor.id,
      lawFirmId: firm.id,
      description: "Dispute over undelivered materials under purchase contract.",
    })
    .returning();

  await db.insert(legalHearingsTable).values({
    companyId,
    legalCaseId: legalCase.id,
    code: "HRG-00001",
    hearingDate: `${new Date().getUTCFullYear()}-03-15`,
    hearingTime: "10:00",
    location: "Riyadh Commercial Court",
    courtRoom: "Room 3",
    status: "scheduled",
    summary: "First hearing — submission of evidence.",
  });

  await db.insert(legalClaimsTable).values({
    companyId,
    legalCaseId: legalCase.id,
    code: "CLM-00001",
    claimType: "financial",
    direction: "by_company",
    amount: "250000",
    status: "submitted",
    claimDate: `${new Date().getUTCFullYear()}-02-10`,
    description: "Recovery of advance payment for undelivered materials.",
  });

  await db.insert(legalNoticesTable).values({
    companyId,
    code: "NOT-00001",
    noticeType: "demand",
    legalCaseId: legalCase.id,
    recipientType: "supplier",
    recipientName: "Falcon Supplies Co.",
    subject: "Demand for delivery or refund",
    body: "Formal demand to deliver outstanding materials within 15 days or refund the advance.",
    noticeDate: `${new Date().getUTCFullYear()}-01-20`,
    dueDate: `${new Date().getUTCFullYear()}-02-04`,
    deliveryMethod: "registered_mail",
    status: "sent",
  });

  console.log("Seeded legal demo data: 2 templates, 1 law firm, 1 advisor, 1 case (+hearing, claim, notice)");
}

const PORTAL_USER_PASSWORD = "Customer@123456";

async function seedPortal(): Promise<void> {
  const [company] = await db
    .select()
    .from(companiesTable)
    .where(eq(companiesTable.code, "HQ001"));
  if (!company) {
    console.log("No sample company found, skipping portal demo data");
    return;
  }
  const companyId = company.id;

  // Attach a portal login to the first seeded customer for the demo company.
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.companyId, companyId))
    .orderBy(customersTable.code)
    .limit(1);
  if (!customer) {
    console.log("Skipped portal seed: no customers found.");
    return;
  }

  const passwordHash = await hashPassword(PORTAL_USER_PASSWORD);
  const username = "customer1";

  let [portalUser] = await db
    .select()
    .from(customerUsersTable)
    .where(eq(customerUsersTable.username, username));

  if (portalUser) {
    // Re-running the seed resets the password and clears any lockout so the
    // demo account is always recoverable.
    await db
      .update(customerUsersTable)
      .set({
        passwordHash,
        status: "active",
        isActive: true,
        lockedUntil: null,
        failedAttempts: "0",
      })
      .where(eq(customerUsersTable.id, portalUser.id));
  } else {
    [portalUser] = await db
      .insert(customerUsersTable)
      .values({
        companyId,
        customerId: customer.id,
        username,
        email: customer.email,
        phone: customer.phone,
        passwordHash,
        status: "active",
      })
      .returning();
  }

  // Idempotent demo content keyed by deterministic codes.
  const [existingMr] = await db
    .select()
    .from(maintenanceRequestsTable)
    .where(eq(maintenanceRequestsTable.code, "MR-DEMO-001"));
  if (!existingMr) {
    await db.insert(maintenanceRequestsTable).values({
      companyId,
      customerId: customer.id,
      customerUserId: portalUser.id,
      code: "MR-DEMO-001",
      category: "plumbing",
      priority: "high",
      subject: "Water leak in kitchen",
      description: "There is a persistent leak under the kitchen sink.",
      status: "open",
    });
  }

  const [existingCmp] = await db
    .select()
    .from(complaintsTable)
    .where(eq(complaintsTable.code, "CMP-DEMO-001"));
  if (!existingCmp) {
    await db.insert(complaintsTable).values({
      companyId,
      customerId: customer.id,
      customerUserId: portalUser.id,
      code: "CMP-DEMO-001",
      category: "billing",
      subject: "Question about last installment",
      description: "I was charged earlier than the agreed due date.",
      status: "open",
    });
  }

  const [existingNotif] = await db
    .select()
    .from(customerNotificationsTable)
    .where(
      and(
        eq(customerNotificationsTable.customerId, customer.id),
        eq(customerNotificationsTable.title, "Welcome to your customer portal"),
      ),
    );
  if (!existingNotif) {
    await db.insert(customerNotificationsTable).values({
      companyId,
      customerId: customer.id,
      customerUserId: portalUser.id,
      title: "Welcome to your customer portal",
      body: "You can now view your units, contracts, installments and raise requests.",
      category: "general",
    });
  }

  const [existingTicket] = await db
    .select()
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.code, "TKT-DEMO-001"));
  if (!existingTicket) {
    const [ticket] = await db
      .insert(supportTicketsTable)
      .values({
        companyId,
        customerId: customer.id,
        customerUserId: portalUser.id,
        code: "TKT-DEMO-001",
        subject: "How do I download my contract?",
        category: "general",
        priority: "medium",
        status: "open",
      })
      .returning();
    await db.insert(supportTicketMessagesTable).values({
      companyId,
      ticketId: ticket.id,
      customerId: customer.id,
      authorType: "customer",
      authorId: portalUser.id,
      authorName: customer.fullName,
      body: "I need a copy of my signed contract. Where can I find it?",
    });
  }

  console.log(
    `Seeded customer portal demo (username: ${username}, password: ${PORTAL_USER_PASSWORD})`,
  );
}

// Master Data engine: seed each category as a system lookup type and its options
// as system lookup values. Stored value codes are kept identical to the existing
// snake_case enum codes so current records keep resolving to the same EN/AR
// labels. Idempotent: types are upserted by code, values inserted on conflict do
// nothing, and labels/order are refreshed so re-running keeps the engine current.
async function seedMasterData(): Promise<void> {
  let typeCount = 0;
  let valueCount = 0;
  for (let i = 0; i < LOOKUP_CATEGORIES.length; i++) {
    const cat = LOOKUP_CATEGORIES[i];
    const [existingType] = await db
      .select()
      .from(lookupTypesTable)
      .where(eq(lookupTypesTable.code, cat.code));

    let typeId: string;
    if (existingType) {
      await db
        .update(lookupTypesTable)
        .set({
          nameEn: cat.nameEn,
          nameAr: cat.nameAr,
          module: cat.module ?? null,
          sortOrder: i,
          isSystem: true,
        })
        .where(eq(lookupTypesTable.id, existingType.id));
      typeId = existingType.id;
    } else {
      const [created] = await db
        .insert(lookupTypesTable)
        .values({
          code: cat.code,
          nameEn: cat.nameEn,
          nameAr: cat.nameAr,
          module: cat.module ?? null,
          sortOrder: i,
          isSystem: true,
        })
        .returning();
      typeId = created.id;
      typeCount++;
    }

    for (let j = 0; j < cat.valueCodes.length; j++) {
      const code = cat.valueCodes[j];
      const label = LABELS[code];
      if (!label) {
        console.warn(`Master data: missing label for "${code}" in "${cat.code}"`);
        continue;
      }
      const [existingValue] = await db
        .select()
        .from(lookupValuesTable)
        .where(
          and(
            eq(lookupValuesTable.typeId, typeId),
            eq(lookupValuesTable.code, code),
          ),
        );
      if (existingValue) {
        // Refresh labels/order for system rows; never touch admin-edited custom
        // values (those are isSystem=false and not in the registry anyway).
        if (existingValue.isSystem) {
          await db
            .update(lookupValuesTable)
            .set({ labelEn: label.en, labelAr: label.ar, sortOrder: j })
            .where(eq(lookupValuesTable.id, existingValue.id));
        }
      } else {
        await db.insert(lookupValuesTable).values({
          typeId,
          code,
          labelEn: label.en,
          labelAr: label.ar,
          sortOrder: j,
          isSystem: true,
        });
        valueCount++;
      }
    }
  }
  console.log(
    `Seeded master data (${LOOKUP_CATEGORIES.length} categories; +${typeCount} new types, +${valueCount} new values)`,
  );
}

async function main(): Promise<void> {
  await seedPermissions();
  const roleId = await seedSuperAdminRole();
  await seedSuperAdminUser(roleId);
  await seedCrmRoles();
  await seedCurrencies();
  await seedCompany();
  await seedNumberSequences();
  await seedSettings();
  await seedMasterData();
  await seedRealEstate();
  await seedFinance();
  await seedReservations();
  await seedAccounting();
  await seedHr();
  await backfillLegalContracts();
  await seedLegal();
  await seedPortal();
  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
