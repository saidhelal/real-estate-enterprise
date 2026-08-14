import mammoth from "mammoth";
import { eq } from "drizzle-orm";
import {
  db,
  customersTable,
  contractsTable,
  reservationsTable,

  correspondenceTable,

  administrativeTasksTable,
  administrativeDecisionsTable,
  meetingsTable,
  prPartiesTable,
  unitsTable,
  customerInvoicesTable,
  receiptsTable,
  suppliersTable,
  employeesTable,
} from "@workspace/db";

/* ------------------------------------------------------------------ */
/* Central Print Engine — token catalog, rendering and file import.   */
/*                                                                    */
/* The engine is shared by every module. A template's HTML carries    */
/* {{token}} placeholders that are resolved at render/print time from  */
/* a no-code "binding catalog": always-present base tokens (company /  */
/* user / document) plus an optional entity group chosen by the        */
/* template's documentType. Every resolved value is HTML-escaped       */
/* before interpolation so stored data can never inject markup.        */
/* ------------------------------------------------------------------ */

export interface BindingToken {
  token: string;
  label: string;
  labelAr: string;
  sample?: string | null;
  /** Internal: source column on the entity row (omitted for base tokens). */
  prop?: string;
}

export interface BindingGroup {
  group: string;
  groupAr: string;
  tokens: BindingToken[];
}

interface EntityBinding {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any;
  group: BindingGroup;
}

type Row = Record<string, unknown>;

/* ----------------------------- base tokens ------------------------ */

const BASE_GROUPS: BindingGroup[] = [
  {
    group: "Document",
    groupAr: "المستند",
    tokens: [
      { token: "document.number", label: "Document number", labelAr: "رقم المستند", sample: "DOC-0001" },
      { token: "document.date", label: "Print date", labelAr: "تاريخ الطباعة", sample: "2026-06-18" },
      { token: "document.time", label: "Print time", labelAr: "وقت الطباعة", sample: "14:30" },
      { token: "document.language", label: "Language", labelAr: "اللغة", sample: "ar" },
    ],
  },
  {
    group: "Company",
    groupAr: "الشركة",
    tokens: [
      { token: "company.name", label: "Company name (EN)", labelAr: "اسم الشركة (إنجليزي)", sample: "Holding Co." },
      { token: "company.nameAr", label: "Company name (AR)", labelAr: "اسم الشركة (عربي)", sample: "الشركة القابضة" },
      { token: "company.code", label: "Company code", labelAr: "رمز الشركة", sample: "C-001" },
      { token: "company.taxNumber", label: "Tax number", labelAr: "الرقم الضريبي", sample: "300000000000003" },
      { token: "company.phone", label: "Company phone", labelAr: "هاتف الشركة", sample: "+966-11-0000000" },
      { token: "company.email", label: "Company email", labelAr: "بريد الشركة", sample: "info@example.com" },
      { token: "company.address", label: "Company address", labelAr: "عنوان الشركة", sample: "Riyadh" },
      // The institutional profile. These are exactly the fields the Company
      // Profile screen edits — a template that wants the legal name gets the
      // one stored on the company row, never a name retyped into the template.
      { token: "company.legalName", label: "Legal name (EN)", labelAr: "الاسم القانوني (إنجليزي)", sample: "Holding Company LLC" },
      { token: "company.legalNameAr", label: "Legal name (AR)", labelAr: "الاسم القانوني (عربي)", sample: "الشركة القابضة ذ.م.م" },
      { token: "company.tradeName", label: "Trade name", labelAr: "الاسم التجاري", sample: "Holding" },
      { token: "company.legalForm", label: "Legal form", labelAr: "الشكل القانوني", sample: "LLC" },
      { token: "company.commercialRegister", label: "Commercial register", labelAr: "السجل التجاري", sample: "1010000000" },
      { token: "company.website", label: "Website", labelAr: "الموقع الإلكتروني", sample: "www.example.com" },
      { token: "company.officialEmail", label: "Official email", labelAr: "البريد الرسمي", sample: "office@example.com" },
      { token: "company.fax", label: "Fax", labelAr: "الفاكس", sample: "+966-11-0000001" },
      { token: "company.poBox", label: "P.O. Box", labelAr: "صندوق البريد", sample: "12345" },
      { token: "company.logoUrl", label: "Logo URL", labelAr: "رابط الشعار", sample: "" },
      { token: "company.representativeName", label: "Representative", labelAr: "الممثل الرسمي", sample: "" },
      { token: "company.representativeTitle", label: "Representative title", labelAr: "صفة الممثل", sample: "" },
      { token: "company.printHeader", label: "Print header", labelAr: "ترويسة الطباعة", sample: "" },
      { token: "company.printFooter", label: "Print footer", labelAr: "تذييل الطباعة", sample: "" },
    ],
  },
  {
    group: "User",
    groupAr: "المستخدم",
    tokens: [
      { token: "user.name", label: "Printed by (name)", labelAr: "طُبع بواسطة (الاسم)", sample: "Super Admin" },
      { token: "user.username", label: "Printed by (username)", labelAr: "طُبع بواسطة (اسم المستخدم)", sample: "superadmin" },
    ],
  },
];

/* --------------------------- entity bindings ---------------------- */
// documentType -> entity group. Resolution reads row[prop] defensively, so a
// prop that does not exist on a given row simply yields an empty string; it
// can never raise a runtime error.

const ENTITY_BINDINGS: Record<string, EntityBinding> = {
  customer: {
    table: customersTable,
    group: {
      group: "Customer",
      groupAr: "العميل",
      tokens: [
        { token: "customer.code", label: "Customer code", labelAr: "رمز العميل", prop: "code" },
        { token: "customer.name", label: "Customer name", labelAr: "اسم العميل", prop: "fullName" },
        { token: "customer.nameAr", label: "Customer name (AR)", labelAr: "اسم العميل (عربي)", prop: "nameAr" },
        { token: "customer.nationalId", label: "National ID", labelAr: "رقم الهوية", prop: "nationalId" },
        { token: "customer.phone", label: "Phone", labelAr: "الهاتف", prop: "phone" },
        { token: "customer.email", label: "Email", labelAr: "البريد", prop: "email" },
        { token: "customer.address", label: "Address", labelAr: "العنوان", prop: "address" },
      ],
    },
  },
  contract: {
    table: contractsTable,
    group: {
      group: "Contract",
      groupAr: "العقد",
      tokens: [
        { token: "contract.code", label: "Contract number", labelAr: "رقم العقد", prop: "code" },
        { token: "contract.date", label: "Contract date", labelAr: "تاريخ العقد", prop: "contractDate" },
        { token: "contract.totalPrice", label: "Total price", labelAr: "السعر الإجمالي", prop: "totalPrice" },
        { token: "contract.downPayment", label: "Down payment", labelAr: "الدفعة المقدمة", prop: "downPayment" },
        { token: "contract.status", label: "Status", labelAr: "الحالة", prop: "status" },
      ],
    },
  },
  /**
   * Internal correspondence and administrative directives.
   *
   * Both became printable records once the header gained a print action, and a
   * template with no binding for them would render a form with empty fields —
   * worse than no template at all. They join the same registry every other
   * entity uses, so the binding catalogue, the renderer and the print job all
   * pick them up with no further wiring.
   */
  correspondence: {
    table: correspondenceTable,
    group: {
      group: "Correspondence",
      groupAr: "المراسلة",
      tokens: [
        { token: "correspondence.code", label: "Reference", labelAr: "الرقم", prop: "code" },
        { token: "correspondence.subject", label: "Subject", labelAr: "الموضوع", prop: "subject" },
        { token: "correspondence.body", label: "Body", labelAr: "النص", prop: "body" },
        { token: "correspondence.date", label: "Date", labelAr: "التاريخ", prop: "correspondenceDate" },
        { token: "correspondence.priority", label: "Priority", labelAr: "الأولوية", prop: "priority" },
        { token: "correspondence.status", label: "Status", labelAr: "الحالة", prop: "status" },
        { token: "correspondence.kind", label: "Type", labelAr: "النوع", prop: "correspondenceKind" },
        { token: "correspondence.sender", label: "Sender", labelAr: "المرسل", prop: "senderName" },
        { token: "correspondence.recipient", label: "Recipient", labelAr: "المستلم", prop: "recipientName" },
        { token: "correspondence.replyDue", label: "Reply due", labelAr: "موعد الرد", prop: "replyDueDate" },
      ],
    },
  },
  administrative_task: {
    table: administrativeTasksTable,
    group: {
      group: "Directive",
      groupAr: "التوجيه",
      tokens: [
        { token: "task.code", label: "Directive number", labelAr: "رقم التوجيه", prop: "code" },
        { token: "task.title", label: "Subject", labelAr: "الموضوع", prop: "title" },
        { token: "task.description", label: "Directive", labelAr: "نص التوجيه", prop: "description" },
        { token: "task.priority", label: "Priority", labelAr: "الأولوية", prop: "priority" },
        { token: "task.status", label: "Status", labelAr: "الحالة", prop: "status" },
        { token: "task.startDate", label: "Issued on", labelAr: "تاريخ الإصدار", prop: "startDate" },
        { token: "task.dueDate", label: "Due date", labelAr: "تاريخ الاستحقاق", prop: "dueDate" },
        { token: "task.progress", label: "Progress", labelAr: "نسبة الإنجاز", prop: "progressPercent" },
        { token: "task.notes", label: "Notes", labelAr: "ملاحظات", prop: "notes" },
      ],
    },
  },
  /**
   * The three General Administration records that are genuinely printed:
   * minutes go out to attendees, a decision is circulated as an issued
   * document, and a relationship card is what someone carries into a meeting.
   *
   * The company's own profile needs no entry here — every template already
   * resolves `{{company.*}}` from the base groups, which read the company row
   * directly. Adding a `company_profile` entity would be a second path to the
   * same values.
   */
  meeting: {
    table: meetingsTable,
    group: {
      group: "Meeting",
      groupAr: "الاجتماع",
      tokens: [
        { token: "meeting.code", label: "Meeting number", labelAr: "رقم الاجتماع", prop: "code" },
        { token: "meeting.title", label: "Title", labelAr: "العنوان", prop: "title" },
        { token: "meeting.type", label: "Meeting type", labelAr: "نوع الاجتماع", prop: "meetingType" },
        { token: "meeting.date", label: "Held on", labelAr: "تاريخ الانعقاد", prop: "scheduledAt" },
        { token: "meeting.location", label: "Location", labelAr: "المكان", prop: "location" },
        { token: "meeting.status", label: "Status", labelAr: "الحالة", prop: "status" },
        { token: "meeting.attendees", label: "Attendees", labelAr: "الحضور", prop: "attendees" },
        { token: "meeting.agenda", label: "Agenda", labelAr: "جدول الأعمال", prop: "agenda" },
        { token: "meeting.minutes", label: "Minutes", labelAr: "المحضر", prop: "minutes" },
        { token: "meeting.notes", label: "Notes", labelAr: "ملاحظات", prop: "notes" },
      ],
    },
  },
  administrative_decision: {
    table: administrativeDecisionsTable,
    group: {
      group: "Decision",
      groupAr: "القرار",
      tokens: [
        { token: "decision.code", label: "Decision number", labelAr: "رقم القرار", prop: "code" },
        { token: "decision.title", label: "Subject", labelAr: "الموضوع", prop: "title" },
        { token: "decision.type", label: "Decision type", labelAr: "نوع القرار", prop: "decisionType" },
        { token: "decision.date", label: "Issued on", labelAr: "تاريخ الإصدار", prop: "decisionDate" },
        { token: "decision.description", label: "Decision", labelAr: "نص القرار", prop: "description" },
        { token: "decision.status", label: "Status", labelAr: "الحالة", prop: "status" },
        { token: "decision.dueDate", label: "Due date", labelAr: "تاريخ الاستحقاق", prop: "dueDate" },
        { token: "decision.notes", label: "Notes", labelAr: "ملاحظات", prop: "notes" },
      ],
    },
  },
  pr_party: {
    table: prPartiesTable,
    group: {
      group: "Relationship",
      groupAr: "العلاقة",
      tokens: [
        { token: "party.code", label: "Party code", labelAr: "رمز الجهة", prop: "code" },
        { token: "party.name", label: "Name", labelAr: "الاسم", prop: "name" },
        { token: "party.nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", prop: "nameAr" },
        { token: "party.type", label: "Party type", labelAr: "نوع الجهة", prop: "partyType" },
        { token: "party.relationship", label: "Relationship", labelAr: "نوع العلاقة", prop: "relationshipType" },
        { token: "party.importance", label: "Importance", labelAr: "الأهمية", prop: "importance" },
        { token: "party.contactPerson", label: "Contact person", labelAr: "مسؤول التواصل", prop: "contactPerson" },
        { token: "party.contactTitle", label: "Contact title", labelAr: "صفة المسؤول", prop: "contactTitle" },
        { token: "party.phone", label: "Phone", labelAr: "الهاتف", prop: "phone" },
        { token: "party.email", label: "Email", labelAr: "البريد الإلكتروني", prop: "email" },
        { token: "party.address", label: "Address", labelAr: "العنوان", prop: "address" },
        { token: "party.lastContact", label: "Last contact", labelAr: "آخر تواصل", prop: "lastContactDate" },
        { token: "party.nextFollowUp", label: "Next follow-up", labelAr: "المتابعة القادمة", prop: "nextFollowUpDate" },
        { token: "party.status", label: "Status", labelAr: "الحالة", prop: "status" },
        { token: "party.notes", label: "Notes", labelAr: "ملاحظات", prop: "notes" },
      ],
    },
  },
  reservation: {
    table: reservationsTable,
    group: {
      group: "Reservation",
      groupAr: "الحجز",
      tokens: [
        { token: "reservation.code", label: "Reservation number", labelAr: "رقم الحجز", prop: "code" },
        { token: "reservation.date", label: "Reservation date", labelAr: "تاريخ الحجز", prop: "reservationDate" },
        { token: "reservation.expiryDate", label: "Expiry date", labelAr: "تاريخ الانتهاء", prop: "expiryDate" },
        { token: "reservation.amount", label: "Amount", labelAr: "المبلغ", prop: "amount" },
        { token: "reservation.status", label: "Status", labelAr: "الحالة", prop: "status" },
      ],
    },
  },
  unit: {
    table: unitsTable,
    group: {
      group: "Unit",
      groupAr: "الوحدة",
      tokens: [
        { token: "unit.code", label: "Unit code", labelAr: "رمز الوحدة", prop: "code" },
        { token: "unit.name", label: "Unit name (EN)", labelAr: "اسم الوحدة (إنجليزي)", prop: "name" },
        { token: "unit.nameAr", label: "Unit name (AR)", labelAr: "اسم الوحدة (عربي)", prop: "nameAr" },
        { token: "unit.area", label: "Area", labelAr: "المساحة", prop: "area" },
        { token: "unit.basePrice", label: "Base price", labelAr: "السعر الأساسي", prop: "basePrice" },
      ],
    },
  },
  invoice: {
    table: customerInvoicesTable,
    group: {
      group: "Invoice",
      groupAr: "الفاتورة",
      tokens: [
        { token: "invoice.number", label: "Invoice number", labelAr: "رقم الفاتورة", prop: "number" },
        { token: "invoice.date", label: "Invoice date", labelAr: "تاريخ الفاتورة", prop: "invoiceDate" },
        { token: "invoice.dueDate", label: "Due date", labelAr: "تاريخ الاستحقاق", prop: "dueDate" },
        { token: "invoice.total", label: "Total", labelAr: "الإجمالي", prop: "total" },
        { token: "invoice.paidAmount", label: "Paid amount", labelAr: "المبلغ المدفوع", prop: "paidAmount" },
        { token: "invoice.status", label: "Status", labelAr: "الحالة", prop: "status" },
      ],
    },
  },
  receipt: {
    table: receiptsTable,
    group: {
      group: "Receipt",
      groupAr: "سند القبض",
      tokens: [
        { token: "receipt.code", label: "Receipt number", labelAr: "رقم السند", prop: "code" },
        { token: "receipt.date", label: "Receipt date", labelAr: "تاريخ السند", prop: "receiptDate" },
        { token: "receipt.amount", label: "Amount", labelAr: "المبلغ", prop: "amount" },
        { token: "receipt.paymentMethod", label: "Payment method", labelAr: "طريقة الدفع", prop: "paymentMethod" },
      ],
    },
  },
  supplier: {
    table: suppliersTable,
    group: {
      group: "Supplier",
      groupAr: "المورد",
      tokens: [
        { token: "supplier.code", label: "Supplier code", labelAr: "رمز المورد", prop: "code" },
        { token: "supplier.name", label: "Supplier name (EN)", labelAr: "اسم المورد (إنجليزي)", prop: "name" },
        { token: "supplier.nameAr", label: "Supplier name (AR)", labelAr: "اسم المورد (عربي)", prop: "nameAr" },
        { token: "supplier.taxNumber", label: "Tax number", labelAr: "الرقم الضريبي", prop: "taxNumber" },
        { token: "supplier.phone", label: "Phone", labelAr: "الهاتف", prop: "phone" },
        { token: "supplier.email", label: "Email", labelAr: "البريد", prop: "email" },
        { token: "supplier.address", label: "Address", labelAr: "العنوان", prop: "address" },
      ],
    },
  },
  employee: {
    table: employeesTable,
    group: {
      group: "Employee",
      groupAr: "الموظف",
      tokens: [
        { token: "employee.code", label: "Employee code", labelAr: "رقم الموظف", prop: "code" },
        { token: "employee.firstName", label: "First name", labelAr: "الاسم الأول", prop: "firstName" },
        { token: "employee.lastName", label: "Last name", labelAr: "اسم العائلة", prop: "lastName" },
        { token: "employee.nationalId", label: "National ID", labelAr: "رقم الهوية", prop: "nationalId" },
        { token: "employee.phone", label: "Phone", labelAr: "الهاتف", prop: "phone" },
        { token: "employee.basicSalary", label: "Basic salary", labelAr: "الراتب الأساسي", prop: "basicSalary" },
      ],
    },
  },
};

// When a module has no explicit documentType, surface its primary entity group
// so the designer still gets useful bindings.
const MODULE_DEFAULT_DOCTYPE: Record<string, string> = {
  customers: "customer",
  crm: "customer",
  realEstate: "unit",
  sales: "contract",
  finance: "receipt",
  arAp: "invoice",
  procurement: "supplier",
  hr: "employee",
  legal: "contract",
};

/** All document types that carry a live entity binding. */
export function knownDocumentTypes(): string[] {
  return Object.keys(ENTITY_BINDINGS);
}

/**
 * Build the binding catalog for a module / document type: the always-present
 * base groups plus (when resolvable) the matching entity group.
 */
export function getBindingCatalog(moduleKey: string, documentType?: string): BindingGroup[] {
  const groups: BindingGroup[] = BASE_GROUPS.map((g) => ({ ...g, tokens: [...g.tokens] }));
  const dt = (documentType && documentType.trim()) || MODULE_DEFAULT_DOCTYPE[moduleKey];
  const binding = dt ? ENTITY_BINDINGS[dt] : undefined;
  if (binding) groups.push({ ...binding.group, tokens: [...binding.group.tokens] });
  return groups;
}

/* ------------------------------ rendering ------------------------- */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatValue(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  return String(raw);
}

/** Resolve the entity record for a documentType + id (null when unknown). */
export async function fetchEntityRow(
  documentType: string,
  entityId: string,
): Promise<Row | null> {
  const binding = ENTITY_BINDINGS[documentType];
  if (!binding) return null;
  const rows = (await db
    .select()
    .from(binding.table)
    .where(eq(binding.table.id, entityId))
    .limit(1)) as Row[];
  return rows[0] ?? null;
}

export interface TokenValueInput {
  company?: Row | null;
  user?: { fullName?: string | null; username?: string | null } | null;
  documentNumber?: string | null;
  language: string;
  documentType?: string | null;
  entity?: Row | null;
}

/** Compute the full token -> value map (base tokens + entity tokens). */
export function buildTokenValues(input: TokenValueInput): Record<string, string> {
  const now = new Date();
  const company = input.company ?? {};
  const values: Record<string, string> = {
    "document.number": input.documentNumber ?? "",
    "document.date": now.toISOString().slice(0, 10),
    "document.time": now.toISOString().slice(11, 16),
    "document.language": input.language,
    "company.name": formatValue(company["name"]),
    "company.nameAr": formatValue(company["nameAr"]),
    "company.code": formatValue(company["code"]),
    "company.taxNumber": formatValue(company["taxNumber"]),
    "company.phone": formatValue(company["phone"]),
    "company.email": formatValue(company["email"]),
    "company.address": formatValue(company["address"]),
    "company.legalName": formatValue(company["legalName"]),
    "company.legalNameAr": formatValue(company["legalNameAr"]),
    "company.tradeName": formatValue(company["tradeName"]),
    "company.legalForm": formatValue(company["legalForm"]),
    "company.commercialRegister": formatValue(company["commercialRegister"]),
    "company.website": formatValue(company["website"]),
    "company.officialEmail": formatValue(company["officialEmail"]),
    "company.fax": formatValue(company["fax"]),
    "company.poBox": formatValue(company["poBox"]),
    "company.logoUrl": formatValue(company["logoUrl"]),
    "company.representativeName": formatValue(company["representativeName"]),
    "company.representativeTitle": formatValue(company["representativeTitle"]),
    "company.printHeader": formatValue(company["printHeader"]),
    "company.printFooter": formatValue(company["printFooter"]),
    "user.name": formatValue(input.user?.fullName),
    "user.username": formatValue(input.user?.username),
  };
  const binding = input.documentType ? ENTITY_BINDINGS[input.documentType] : undefined;
  if (binding) {
    for (const t of binding.group.tokens) {
      if (!t.prop) continue;
      values[t.token] = formatValue(input.entity ? input.entity[t.prop] : undefined);
    }
  }
  return values;
}

const TOKEN_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

/**
 * Replace every {{token}} in the template HTML with its HTML-escaped value.
 * Unknown tokens resolve to an empty string.
 */
export function renderTemplate(html: string, values: Record<string, string>): string {
  return html.replace(TOKEN_RE, (_match, token: string) =>
    escapeHtml(values[token] ?? ""),
  );
}

/* ------------------------------ file import ----------------------- */

export interface ImportOutcome {
  html: string;
  fileFormat: string;
  warning?: string | null;
}

/**
 * Convert an uploaded source file into template HTML. Word documents are
 * converted with mammoth; raw HTML is passed through; PDF cannot be converted
 * losslessly to editable HTML, so the source file is kept and the designer is
 * asked to author the HTML (a warning is returned, not an error).
 */
export async function importDocument(
  buffer: Buffer,
  fileFormat: string,
): Promise<ImportOutcome> {
  const fmt = fileFormat.toLowerCase();
  if (fmt === "docx" || fmt === "doc" || fmt === "word") {
    const result = await mammoth.convertToHtml({ buffer });
    const warning = result.messages.length
      ? result.messages.map((m) => m.message).join("; ")
      : null;
    return { html: result.value, fileFormat: "docx", warning };
  }
  if (fmt === "html" || fmt === "htm") {
    return { html: buffer.toString("utf8"), fileFormat: "html", warning: null };
  }
  if (fmt === "pdf") {
    return {
      html: "",
      fileFormat: "pdf",
      warning:
        "PDF files are stored as the source reference but cannot be converted to editable HTML automatically. Please author the template HTML and use the field palette to bind data.",
    };
  }
  return {
    html: "",
    fileFormat: fmt,
    warning: `Unsupported file format "${fileFormat}". Supported: Word (.docx), HTML.`,
  };
}
