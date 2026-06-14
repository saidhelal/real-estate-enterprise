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

async function main(): Promise<void> {
  await seedPermissions();
  const roleId = await seedSuperAdminRole();
  await seedSuperAdminUser(roleId);
  await seedCurrencies();
  await seedCompany();
  await seedNumberSequences();
  await seedSettings();
  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
