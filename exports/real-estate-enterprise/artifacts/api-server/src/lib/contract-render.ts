import { eq } from "drizzle-orm";
import QRCode from "qrcode";
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
  employeesTable,
  installmentPlansTable,
  type LegalContractRow,
} from "@workspace/db";
import { renderTemplate } from "./print-engine";

/* ------------------------------------------------------------------ */
/* Contract smart variables — chained token resolution + official doc. */
/*                                                                    */
/* The Central Print Engine resolves base tokens plus ONE entity      */
/* group. A real-estate contract needs the whole chain, so this       */
/* resolver walks company -> sale -> customer / unit -> floor ->      */
/* building -> phase -> project, plus the installment plan, the       */
/* responsible (sales) employee and the acting user, and exposes      */
/* every value as a {{group.field}} token. Lookups are defensive: a   */
/* missing link yields empty tokens, never an error.                  */
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

export interface RenderActor {
  fullName?: string | null;
  username?: string | null;
}

/**
 * Resolve the full smart-variable token map for a legal contract: always the
 * company and the contract's own metadata, plus — when the contract is linked
 * to a sales contract (sourceModule = "sales") — the entire sale entity chain
 * (customer, unit, floor, building, phase, project, installment plan). Also
 * resolves the responsible (sales) employee and the acting user.
 */
export async function resolveContractTokens(
  contract: LegalContractRow,
  actor?: RenderActor | null,
): Promise<Record<string, string>> {
  const values: Record<string, string> = {};
  const now = new Date();
  values["document.date"] = now.toISOString().slice(0, 10);
  values["document.time"] = now.toISOString().slice(11, 16);

  // Acting user (current user) — always available from the request context.
  values["user.name"] = val(actor?.fullName);
  values["user.username"] = val(actor?.username);

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
  values["contract.version"] = val(contract.currentVersion);
  values["contract.verificationId"] = val(contract.verificationId);

  // Responsible / sales representative (the employee accountable for the deal).
  const salesRep = await one(employeesTable, contract.responsibleEmployeeId as string);
  if (salesRep) {
    const first = val(salesRep["firstName"]);
    const last = val(salesRep["lastName"]);
    values["salesRep.name"] = `${first} ${last}`.trim();
    const firstAr = val(salesRep["firstNameAr"]);
    const lastAr = val(salesRep["lastNameAr"]);
    values["salesRep.nameAr"] = `${firstAr} ${lastAr}`.trim();
    values["salesRep.code"] = val(salesRep["code"]);
    values["salesRep.phone"] = val(salesRep["phone"]);
    values["salesRep.email"] = val(salesRep["email"]);
  }

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

      // Installment plan for this sale (latest active plan wins, defensively).
      const plans = (await db
        .select()
        .from(installmentPlansTable)
        .where(eq(installmentPlansTable.contractId, sale["id"] as string))
        .limit(1)) as Record<string, unknown>[];
      const plan = plans[0];
      if (plan) {
        values["installment.code"] = val(plan["code"]);
        values["installment.totalAmount"] = val(plan["totalAmount"]);
        values["installment.downPayment"] = val(plan["downPayment"]);
        values["installment.count"] = val(plan["numberOfInstallments"]);
        values["installment.frequency"] = val(plan["frequency"]);
        values["installment.startDate"] = val(plan["startDate"]);
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

/** Generate a QR-code PNG data URL for the given text (empty string on error). */
export async function generateQrDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, { margin: 1, width: 160 });
  } catch {
    return "";
  }
}

export interface BuildDocumentArgs {
  contract: LegalContractRow;
  templateHtml: string;
  tokens: Record<string, string>;
  /** "draft" stamps a DRAFT watermark; "approved" stamps APPROVED + lock note. */
  mode: "draft" | "approved";
  generatedAt: Date;
  /** Approved-mode metadata (verification id, approver, version, QR). */
  verificationId?: string | null;
  approverName?: string | null;
  version?: number | null;
  qrDataUrl?: string | null;
}

/**
 * Render the editable template into an official, print-ready document: A4 page
 * geometry, company header, footer with automatic page numbering, a DRAFT or
 * APPROVED watermark, and (for approved copies) a verification block carrying
 * the QR code, verification id, approver and version. The template HTML is
 * authored content stored verbatim; it is always DOMPurify-sanitized on the
 * client before being printed/displayed. Token values are HTML-escaped by
 * renderTemplate, and this wrapper escapes every interpolated field.
 */
export function buildContractDocument(args: BuildDocumentArgs): string {
  const body = renderTemplate(args.templateHtml, args.tokens);
  const title =
    args.tokens["contract.title"] ||
    String(args.contract.title ?? "") ||
    String(args.contract.code ?? "");
  const safeTitle = escapeHtml(title);
  const companyName = escapeHtml(
    args.tokens["company.nameAr"] || args.tokens["company.name"] || "",
  );
  const companyMeta = escapeHtml(
    [args.tokens["company.taxNumber"], args.tokens["company.phone"]]
      .filter(Boolean)
      .join(" — "),
  );
  const code = escapeHtml(String(args.contract.code ?? ""));
  const stamp = args.generatedAt.toISOString().slice(0, 19).replace("T", " ");
  const isApproved = args.mode === "approved";
  const watermarkText = isApproved ? "APPROVED معتمد" : "DRAFT مسودة";
  const watermarkColor = isApproved ? "rgba(22,101,52,0.10)" : "rgba(180,83,9,0.12)";

  let verifyBlock = "";
  if (isApproved) {
    const vid = escapeHtml(String(args.verificationId ?? ""));
    const approver = escapeHtml(String(args.approverName ?? ""));
    const version = escapeHtml(String(args.version ?? args.contract.currentVersion ?? 1));
    const qr = args.qrDataUrl
      ? `<img class="qr" src="${escapeHtml(args.qrDataUrl)}" alt="verification qr" />`
      : "";
    verifyBlock = `<div class="doc-verify"><div class="verify-meta"><div><span class="vlabel">رقم التحقق / Verification ID:</span> <strong>${vid}</strong></div><div><span class="vlabel">المعتمد / Approved by:</span> ${approver}</div><div><span class="vlabel">الإصدار / Version:</span> ${version}</div><div><span class="vlabel">تاريخ الاعتماد / Approved at:</span> ${escapeHtml(stamp)} UTC</div></div>${qr}</div>`;
  }

  const lockNote = isApproved
    ? `<div class="doc-lock">نسخة رسمية معتمدة ومقفلة، غير قابلة للتعديل — Official, approved, locked copy. Generated ${escapeHtml(stamp)} UTC.</div>`
    : `<div class="doc-lock doc-draft-note">مسودة — غير معتمدة. لا تُعتمد للتوقيع. — DRAFT — not approved, not valid for signature.</div>`;

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${safeTitle}</title><style>
@page{size:A4;margin:24mm 18mm 22mm 18mm}
*{box-sizing:border-box}
body{font-family:system-ui,'Segoe UI',Tahoma,Arial,sans-serif;color:#111;line-height:1.6;margin:0}
.doc-watermark{position:fixed;top:45%;left:0;right:0;text-align:center;font-size:84px;font-weight:800;letter-spacing:6px;color:${watermarkColor};transform:rotate(-24deg);z-index:0;pointer-events:none;white-space:nowrap}
.doc-header{position:running(header)}
header.print-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1f2937;padding-bottom:8px;margin-bottom:18px}
header.print-header .co{font-size:16px;font-weight:700}
header.print-header .meta{font-size:11px;color:#555;text-align:left}
.doc-title{font-size:20px;margin:0 0 4px;position:relative;z-index:1}
.doc-sub{font-size:12px;color:#555;margin-bottom:18px;position:relative;z-index:1}
.doc-body{font-size:14px;position:relative;z-index:1}
.doc-body img{max-width:100%}
.doc-body table{border-collapse:collapse;width:100%}
.doc-body td,.doc-body th{border:1px solid #ddd;padding:6px}
.doc-verify{margin-top:36px;padding-top:14px;border-top:1px solid #ccc;display:flex;justify-content:space-between;align-items:center;gap:16px;position:relative;z-index:1}
.doc-verify .verify-meta{font-size:11px;color:#333;line-height:1.9}
.doc-verify .vlabel{color:#666}
.doc-verify .qr{width:120px;height:120px}
.doc-lock{margin-top:18px;padding-top:10px;border-top:1px solid #eee;font-size:11px;color:#777;position:relative;z-index:1}
.doc-draft-note{color:#b45309;font-weight:600}
.print-footer{position:fixed;bottom:-16mm;left:0;right:0;font-size:10px;color:#888;display:flex;justify-content:space-between;border-top:1px solid #eee;padding-top:4px}
.print-footer .pageno::after{content:"صفحة " counter(page) " / " counter(pages)}
</style></head><body>
<div class="doc-watermark">${escapeHtml(watermarkText)}</div>
<header class="print-header"><div class="co">${companyName}</div><div class="meta">${companyMeta}<br>${code}</div></header>
<h1 class="doc-title">${safeTitle}</h1>
<div class="doc-sub">${companyName} — ${code}</div>
<div class="doc-body">${body}</div>
${verifyBlock}
${lockNote}
<footer class="print-footer"><span>${companyName} — ${code}</span><span class="pageno"></span></footer>
</body></html>`;
}

/**
 * Backwards-compatible approved-document builder. Delegates to
 * buildContractDocument in "approved" mode.
 */
export function buildApprovedDocument(args: {
  contract: LegalContractRow;
  templateHtml: string;
  tokens: Record<string, string>;
  approvedAt: Date;
  verificationId?: string | null;
  approverName?: string | null;
  qrDataUrl?: string | null;
}): string {
  return buildContractDocument({
    contract: args.contract,
    templateHtml: args.templateHtml,
    tokens: args.tokens,
    mode: "approved",
    generatedAt: args.approvedAt,
    verificationId: args.verificationId ?? null,
    approverName: args.approverName ?? null,
    version: args.contract.currentVersion ?? 1,
    qrDataUrl: args.qrDataUrl ?? null,
  });
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
      group: "Installment plan",
      groupAr: "خطة الأقساط",
      tokens: [
        { token: "installment.code", label: "Plan no.", labelAr: "رقم الخطة" },
        { token: "installment.totalAmount", label: "Total amount", labelAr: "إجمالي المبلغ" },
        { token: "installment.downPayment", label: "Down payment", labelAr: "الدفعة المقدمة" },
        { token: "installment.count", label: "No. of installments", labelAr: "عدد الأقساط" },
        { token: "installment.frequency", label: "Frequency", labelAr: "التكرار" },
        { token: "installment.startDate", label: "Start date", labelAr: "تاريخ البدء" },
      ],
    },
    {
      group: "Sales representative",
      groupAr: "مندوب المبيعات",
      tokens: [
        { token: "salesRep.name", label: "Sales rep name", labelAr: "اسم المندوب" },
        { token: "salesRep.nameAr", label: "Sales rep name (AR)", labelAr: "اسم المندوب (عربي)" },
        { token: "salesRep.phone", label: "Phone", labelAr: "الهاتف" },
        { token: "salesRep.email", label: "Email", labelAr: "البريد" },
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
        { token: "contract.version", label: "Version", labelAr: "الإصدار" },
        { token: "contract.verificationId", label: "Verification ID", labelAr: "رقم التحقق" },
      ],
    },
    {
      group: "User & date",
      groupAr: "المستخدم والتاريخ",
      tokens: [
        { token: "user.name", label: "Current user", labelAr: "المستخدم الحالي" },
        { token: "user.username", label: "Username", labelAr: "اسم المستخدم" },
        { token: "document.date", label: "Print date", labelAr: "تاريخ الطباعة" },
        { token: "document.time", label: "Print time", labelAr: "وقت الطباعة" },
      ],
    },
  ];
}
