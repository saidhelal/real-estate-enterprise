import { eq } from "drizzle-orm";
import {
  db,
  companiesTable,
  customersTable,
  contractsTable,
  unitsTable,
  floorsTable,
  buildingsTable,
  phasesTable,
  projectsTable,
  type LegalContractRow,
} from "@workspace/db";
import { renderTemplate } from "./print-engine";

/* ------------------------------------------------------------------ */
/* Contract smart variables — chained token resolution + locked doc.  */
/*                                                                    */
/* The Central Print Engine resolves base tokens plus ONE entity      */
/* group. A real-estate contract needs the whole chain, so this       */
/* resolver walks company -> sale -> customer / unit -> floor ->      */
/* building -> phase -> project and exposes every value as a          */
/* {{group.field}} token. Lookups are defensive: a missing link       */
/* yields empty tokens, never an error.                               */
/* ------------------------------------------------------------------ */

function val(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  return String(raw);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function one(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any,
  id: string | null | undefined,
): Promise<Record<string, unknown> | null> {
  if (!id) return null;
  const rows = (await db
    .select()
    .from(table)
    .where(eq(table.id, id))
    .limit(1)) as Record<string, unknown>[];
  return rows[0] ?? null;
}

/**
 * Resolve the full smart-variable token map for a legal contract: always the
 * company and the contract's own metadata, plus — when the contract is linked
 * to a sales contract (sourceModule = "sales") — the entire sale entity chain.
 */
export async function resolveContractTokens(
  contract: LegalContractRow,
): Promise<Record<string, string>> {
  const values: Record<string, string> = {};
  const now = new Date();
  values["document.date"] = now.toISOString().slice(0, 10);
  values["document.time"] = now.toISOString().slice(11, 16);

  const company = await one(companiesTable, contract.companyId as string);
  if (company) {
    values["company.name"] = val(company["name"]);
    values["company.nameAr"] = val(company["nameAr"]);
    values["company.code"] = val(company["code"]);
    values["company.taxNumber"] = val(company["taxNumber"]);
    values["company.phone"] = val(company["phone"]);
    values["company.email"] = val(company["email"]);
    values["company.address"] = val(company["address"]);
  }

  // Legal contract metadata (always available).
  values["contract.code"] = val(contract.code);
  values["contract.title"] = val(contract.title);
  values["contract.titleAr"] = val(contract.titleAr);
  values["contract.value"] = val(contract.value);
  values["contract.date"] = val(contract.contractDate);
  values["contract.status"] = val(contract.status);

  if (contract.sourceModule === "sales" && contract.sourceId) {
    const sale = await one(contractsTable, contract.sourceId as string);
    if (sale) {
      values["sale.code"] = val(sale["code"]);
      values["sale.date"] = val(sale["contractDate"]);
      values["sale.totalPrice"] = val(sale["totalPrice"]);
      values["sale.downPayment"] = val(sale["downPayment"]);
      values["sale.status"] = val(sale["status"]);

      const customer = await one(customersTable, sale["customerId"] as string);
      if (customer) {
        values["customer.code"] = val(customer["code"]);
        values["customer.name"] = val(customer["fullName"]);
        values["customer.nameAr"] = val(customer["nameAr"]);
        values["customer.nationalId"] = val(customer["nationalId"]);
        values["customer.phone"] = val(customer["phone"]);
        values["customer.email"] = val(customer["email"]);
        values["customer.address"] = val(customer["address"]);
      }

      const unit = await one(unitsTable, sale["unitId"] as string);
      if (unit) {
        values["unit.code"] = val(unit["code"]);
        values["unit.name"] = val(unit["name"]);
        values["unit.nameAr"] = val(unit["nameAr"]);
        values["unit.area"] = val(unit["area"]);
        values["unit.basePrice"] = val(unit["basePrice"]);
        values["unit.bedrooms"] = val(unit["bedrooms"]);
        values["unit.bathrooms"] = val(unit["bathrooms"]);

        const [floor, building, phase, project] = await Promise.all([
          one(floorsTable, unit["floorId"] as string),
          one(buildingsTable, unit["buildingId"] as string),
          one(phasesTable, unit["phaseId"] as string),
          one(projectsTable, unit["projectId"] as string),
        ]);
        if (floor) {
          values["floor.code"] = val(floor["code"]);
          values["floor.name"] = val(floor["name"]);
          values["floor.nameAr"] = val(floor["nameAr"]);
          values["floor.number"] = val(floor["floorNumber"]);
        }
        if (building) {
          values["building.code"] = val(building["code"]);
          values["building.name"] = val(building["name"]);
          values["building.nameAr"] = val(building["nameAr"]);
        }
        if (phase) {
          values["phase.code"] = val(phase["code"]);
          values["phase.name"] = val(phase["name"]);
          values["phase.nameAr"] = val(phase["nameAr"]);
        }
        if (project) {
          values["project.code"] = val(project["code"]);
          values["project.name"] = val(project["name"]);
          values["project.nameAr"] = val(project["nameAr"]);
          values["project.location"] = val(project["location"]);
        }
      }
    }
  }

  return values;
}

/**
 * Render the editable template into the immutable, locked approval copy. The
 * template HTML is authored content and is stored verbatim here; it is always
 * DOMPurify-sanitized on the client before being printed/displayed. Token
 * values are HTML-escaped by renderTemplate, and the wrapper escapes the title.
 */
export function buildApprovedDocument(args: {
  contract: LegalContractRow;
  templateHtml: string;
  tokens: Record<string, string>;
  approvedAt: Date;
}): string {
  const body = renderTemplate(args.templateHtml, args.tokens);
  const title =
    args.tokens["contract.title"] ||
    String(args.contract.title ?? "") ||
    String(args.contract.code ?? "");
  const stamp = args.approvedAt.toISOString().slice(0, 19).replace("T", " ");
  const safeTitle = escapeHtml(title);
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${safeTitle}</title><style>body{font-family:system-ui,'Segoe UI',Tahoma,Arial,sans-serif;padding:32px;color:#111;line-height:1.6}h1.doc-title{font-size:20px;margin:0 0 16px}.doc-meta{font-size:12px;color:#555;margin-bottom:24px}.doc-body{font-size:14px}.doc-lock{margin-top:40px;padding-top:12px;border-top:1px solid #ccc;font-size:11px;color:#777}img{max-width:100%}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px}</style></head><body><h1 class="doc-title">${safeTitle}</h1><div class="doc-meta">${escapeHtml(args.tokens["company.nameAr"] || args.tokens["company.name"] || "")} — ${escapeHtml(String(args.contract.code ?? ""))}</div><div class="doc-body">${body}</div><div class="doc-lock">نسخة معتمدة ومقفلة، غير قابلة للتعديل — Approved, locked copy. Generated ${escapeHtml(stamp)} UTC.</div></body></html>`;
}

export interface ContractTokenGroup {
  group: string;
  groupAr: string;
  tokens: Array<{ token: string; label: string; labelAr: string }>;
}

/** Reference palette of every smart variable a contract template can use. */
export function contractTokenCatalog(): ContractTokenGroup[] {
  return [
    {
      group: "Company",
      groupAr: "الشركة",
      tokens: [
        { token: "company.name", label: "Company name", labelAr: "اسم الشركة" },
        { token: "company.nameAr", label: "Company name (AR)", labelAr: "اسم الشركة (عربي)" },
        { token: "company.taxNumber", label: "Tax number", labelAr: "الرقم الضريبي" },
        { token: "company.phone", label: "Phone", labelAr: "الهاتف" },
        { token: "company.address", label: "Address", labelAr: "العنوان" },
      ],
    },
    {
      group: "Customer",
      groupAr: "العميل",
      tokens: [
        { token: "customer.name", label: "Customer name", labelAr: "اسم العميل" },
        { token: "customer.nameAr", label: "Customer name (AR)", labelAr: "اسم العميل (عربي)" },
        { token: "customer.nationalId", label: "National ID", labelAr: "رقم الهوية" },
        { token: "customer.phone", label: "Phone", labelAr: "الهاتف" },
        { token: "customer.address", label: "Address", labelAr: "العنوان" },
      ],
    },
    {
      group: "Project",
      groupAr: "المشروع",
      tokens: [
        { token: "project.name", label: "Project name", labelAr: "اسم المشروع" },
        { token: "project.nameAr", label: "Project name (AR)", labelAr: "اسم المشروع (عربي)" },
        { token: "project.location", label: "Location", labelAr: "الموقع" },
        { token: "phase.name", label: "Phase name", labelAr: "اسم المرحلة" },
        { token: "building.name", label: "Building name", labelAr: "اسم المبنى" },
        { token: "floor.name", label: "Floor name", labelAr: "اسم الدور" },
        { token: "floor.number", label: "Floor number", labelAr: "رقم الدور" },
      ],
    },
    {
      group: "Unit",
      groupAr: "الوحدة",
      tokens: [
        { token: "unit.code", label: "Unit code", labelAr: "رمز الوحدة" },
        { token: "unit.name", label: "Unit name", labelAr: "اسم الوحدة" },
        { token: "unit.area", label: "Area", labelAr: "المساحة" },
        { token: "unit.basePrice", label: "Base price", labelAr: "السعر الأساسي" },
        { token: "unit.bedrooms", label: "Bedrooms", labelAr: "غرف النوم" },
        { token: "unit.bathrooms", label: "Bathrooms", labelAr: "دورات المياه" },
      ],
    },
    {
      group: "Sale",
      groupAr: "البيع",
      tokens: [
        { token: "sale.code", label: "Sale contract no.", labelAr: "رقم عقد البيع" },
        { token: "sale.date", label: "Sale date", labelAr: "تاريخ البيع" },
        { token: "sale.totalPrice", label: "Total price", labelAr: "السعر الإجمالي" },
        { token: "sale.downPayment", label: "Down payment", labelAr: "الدفعة المقدمة" },
      ],
    },
    {
      group: "Contract",
      groupAr: "العقد",
      tokens: [
        { token: "contract.code", label: "Contract code", labelAr: "رمز العقد" },
        { token: "contract.title", label: "Title", labelAr: "العنوان" },
        { token: "contract.value", label: "Value", labelAr: "القيمة" },
        { token: "contract.date", label: "Contract date", labelAr: "تاريخ العقد" },
        { token: "document.date", label: "Print date", labelAr: "تاريخ الطباعة" },
      ],
    },
  ];
}
