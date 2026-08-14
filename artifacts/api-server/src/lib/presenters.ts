import type {
  UserRow,
  RoleRow,
  CompanyRow,
  BranchRow,
  FiscalYearRow,
  CurrencyRow,
  ExchangeRateRow,
  SettingRow,
  NumberSequenceRow,
  AuditLogRow,
  LoginHistoryRow,
  ChangeRequestRow,
} from "@workspace/db";

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export interface RoleApi {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
  createdAt: string;
}

export function toRole(row: RoleRow, userCount = 0): RoleApi {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isSystem: row.isSystem,
    permissions: row.permissions,
    userCount,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toUser(row: UserRow, roles: RoleApi[] = []) {
  return {
    id: row.id,
    username: row.username,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    status: row.status,
    isActive: row.isActive,
    mustChangePassword: row.mustChangePassword,
    lastLoginAt: iso(row.lastLoginAt),
    failedAttempts: row.failedAttempts,
    companyId: row.companyId,
    employeeId: row.employeeId,
    roles,
    createdAt: row.createdAt.toISOString(),
    updatedAt: iso(row.updatedAt),
  };
}

export function toChangeRequest(row: ChangeRequestRow) {
  return {
    id: row.id,
    companyId: row.companyId,
    requestType: row.requestType,
    entity: row.entity,
    entityId: row.entityId,
    entityLabel: row.entityLabel,
    method: row.method,
    path: row.path,
    payload: row.payload ?? null,
    reason: row.reason,
    status: row.status,
    requestedBy: row.requestedBy,
    requestedByName: row.requestedByName,
    reviewedBy: row.reviewedBy,
    reviewedByName: row.reviewedByName,
    reviewNotes: row.reviewNotes,
    reviewedAt: iso(row.reviewedAt),
    executedAt: iso(row.executedAt),
    executionError: row.executionError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: iso(row.updatedAt),
  };
}

export function toCompany(row: CompanyRow, branchCount = 0) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    nameAr: row.nameAr,
    taxNumber: row.taxNumber,
    email: row.email,
    phone: row.phone,
    address: row.address,
    baseCurrency: row.baseCurrency,
    // Institutional profile — what the company is called on paper, how it is
    // registered, who signs for it, and what its official stationery carries.
    // Every print template resolves its company tokens from here, so this is
    // the only place those values are read from.
    legalName: row.legalName,
    legalNameAr: row.legalNameAr,
    tradeName: row.tradeName,
    legalForm: row.legalForm,
    commercialRegister: row.commercialRegister,
    website: row.website,
    logoUrl: row.logoUrl,
    officialEmail: row.officialEmail,
    fax: row.fax,
    poBox: row.poBox,
    representativeName: row.representativeName,
    representativeTitle: row.representativeTitle,
    printHeader: row.printHeader,
    printFooter: row.printFooter,
    branchCount,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toBranch(row: BranchRow, companyName: string | null = null) {
  return {
    id: row.id,
    companyId: row.companyId,
    companyName,
    code: row.code,
    name: row.name,
    nameAr: row.nameAr,
    manager: row.manager,
    phone: row.phone,
    address: row.address,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toFiscalYear(row: FiscalYearRow) {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toCurrency(row: CurrencyRow) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    symbol: row.symbol,
    isBase: row.isBase,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toExchangeRate(row: ExchangeRateRow) {
  return {
    id: row.id,
    fromCurrency: row.fromCurrency,
    toCurrency: row.toCurrency,
    rate: row.rate,
    rateDate: row.rateDate,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toSetting(row: SettingRow) {
  return {
    key: row.key,
    value: row.value,
    category: row.category,
    label: row.label,
  };
}

export function formatSequenceSample(
  prefix: string,
  nextNumber: number,
  padding: number,
  resetYearly: boolean,
): string {
  const number = String(nextNumber).padStart(padding, "0");
  const year = new Date().getFullYear();
  return resetYearly ? `${prefix}-${year}-${number}` : `${prefix}-${number}`;
}

export function toNumberSequence(row: NumberSequenceRow) {
  return {
    id: row.id,
    documentType: row.documentType,
    prefix: row.prefix,
    nextNumber: row.nextNumber,
    padding: row.padding,
    resetYearly: row.resetYearly,
    companyId: row.companyId,
    isActive: row.isActive,
    sample: formatSequenceSample(row.prefix, row.nextNumber, row.padding, row.resetYearly),
    createdAt: row.createdAt.toISOString(),
  };
}

export function toAuditLog(row: AuditLogRow) {
  return {
    id: row.id,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    userName: row.userName,
    ipAddress: row.ipAddress,
    oldValue: row.oldValue,
    newValue: row.newValue,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toLoginHistory(row: LoginHistoryRow) {
  return {
    id: row.id,
    userName: row.userName,
    success: row.success,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
  };
}
