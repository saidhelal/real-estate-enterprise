import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  useListLeads,
  useCreateLead,
  useUpdateLead,
  useDeleteLead,
  getListLeadsQueryKey,
  useListBranches,
  useListLeadSources,
  useListUsers,
  useListCompanies,
  useCreateCustomer,
  useCreateLeadConversion,
  getListCustomersQueryKey,
  type Lead,
  type LeadInput,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumLabel } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, UserPlus, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";

/** Excel header aliases (English + Arabic) mapped to lead fields. */
const HEADER_ALIASES: Record<keyof LeadInput | "mobile", string[]> = {
  companyId: [],
  branchId: ["branch", "الفرع"],
  code: ["code", "lead code", "الرمz", "الرمز", "الكود", "كود"],
  fullName: ["full name", "name", "الاسم", "الاسم الكامل", "اسم"],
  phone: ["phone", "tel", "الهاتف", "رقم الهاتف"],
  mobile: ["mobile", "cell", "الجوال", "الموبايل", "رقم الجوال"],
  nationalId: [
    "national id",
    "nationalid",
    "national",
    "id number",
    "الرقم القومي",
    "رقم الهوية",
    "الهوية",
    "الرقم الوطني",
  ],
  email: ["email", "e-mail", "البريد", "البريد الإلكتروني"],
  sourceId: [],
  campaignId: [],
  channelId: [],
  assignedToUserId: [],
  status: ["status", "الحالة"],
  budget: ["budget", "الميزانية"],
  notes: ["notes", "note", "ملاحظات", "ملاحظة"],
};

function norm(s: string): string {
  return String(s).trim().toLowerCase().replace(/\s+/g, " ");
}

/** Build a header -> field resolver from the first row's keys. */
function resolveRow(row: Record<string, unknown>): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {};
  for (const [rawKey, rawVal] of Object.entries(row)) {
    const key = norm(rawKey);
    const val = rawVal == null ? "" : String(rawVal).trim();
    if (!val) continue;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.map(norm).includes(key)) {
        const target = field === "mobile" ? "phone" : field;
        // Phone may come from either "phone" or "mobile"; keep first non-empty.
        if (!out[target]) out[target] = val;
        break;
      }
    }
  }
  return out;
}

interface ImportSummary {
  created: number;
  duplicates: number;
  failed: number;
  skipped: number;
  errors: string[];
}

export default function LeadsPage() {
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createLead = useCreateLead();
  const createCustomer = useCreateCustomer();
  const createConversion = useCreateLeadConversion();
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<Partial<Record<string, string>>[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const { options: STATUS } = useLookupOptions("lead_status", [
    "new",
    "contacted",
    "qualified",
    "proposal",
    "won",
    "lost",
  ]);
  const { data: companies } = useListCompanies();
  const { data: branches } = useListBranches();
  const { data: sources } = useListLeadSources({ pageSize: 200 });
  const { data: users } = useListUsers();
  const companyId = companies?.[0]?.id;

  const branchOptions = (branches ?? []).map((b) => ({ value: b.id, label: b.name }));
  const sourceOptions = (sources?.data ?? []).map((s) => ({ value: s.id, label: s.name }));
  const userOptions = (users ?? []).map((u) => ({ value: u.id, label: u.fullName ?? u.username }));

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence on save; shown before saving.
      generated: true,
      generatorKey: "Lead",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "fullName", label: "Full Name", labelAr: "الاسم الكامل", required: true },
    { name: "phone", label: "Mobile", labelAr: "الجوال" },
    { name: "nationalId", label: "National ID", labelAr: "الرقم القومي" },
    { name: "email", label: "Email", labelAr: "البريد الإلكتروني" },
    { name: "branchId", label: "Branch", labelAr: "الفرع", type: "select", options: branchOptions },
    { name: "sourceId", label: "Source", labelAr: "المصدر", type: "select", options: sourceOptions },
    { name: "assignedToUserId", label: "Assigned To", labelAr: "معين إلى", type: "select", options: userOptions },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", required: true, options: STATUS },
    { name: "budget", label: "Budget", labelAr: "الميزانية", type: "money" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<Lead>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Full Name", headerAr: "الاسم الكامل", render: (r) => r.fullName },
    { header: "Mobile", headerAr: "الجوال", render: (r) => r.phone ?? "-" },
    { header: "National ID", headerAr: "الرقم القومي", render: (r) => r.nationalId ?? "-" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  async function handleFile(file: File) {
    setSummary(null);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const parsed = raw.map(resolveRow).filter((r) => r.fullName);
      setRows(parsed);
      if (parsed.length === 0) {
        toast({
          title: t("leads.import_no_rows"),
          description: t("leads.import_no_rows_desc"),
          variant: "destructive",
        });
      }
    } catch {
      setRows([]);
      toast({ title: t("leads.import_parse_error"), variant: "destructive" });
    }
  }

  async function runImport() {
    if (!companyId || rows.length === 0) return;
    setImporting(true);
    const result: ImportSummary = { created: 0, duplicates: 0, failed: 0, skipped: 0, errors: [] };
    const now = Date.now();
    let i = 0;
    for (const row of rows) {
      i += 1;
      const fullName = row.fullName?.trim();
      if (!fullName) {
        result.skipped += 1;
        continue;
      }
      const data: LeadInput = {
        companyId,
        code: row.code?.trim() || `LEAD-${now}-${i}`,
        fullName,
        status: row.status?.trim() || "new",
      };
      if (row.phone) data.phone = row.phone;
      if (row.nationalId) data.nationalId = row.nationalId;
      if (row.email) data.email = row.email;
      if (row.budget) data.budget = row.budget;
      if (row.notes) data.notes = row.notes;
      try {
        await createLead.mutateAsync({ data });
        result.created += 1;
      } catch (err) {
        const status = (err as { status?: number })?.status;
        if (status === 409) {
          result.duplicates += 1;
        } else {
          result.failed += 1;
          if (result.errors.length < 5) {
            result.errors.push(`${fullName}: ${(err as Error)?.message ?? "error"}`);
          }
        }
      }
    }
    await queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
    setImporting(false);
    setSummary(result);
    setRows([]);
    toast({
      title: t("leads.import_done"),
      description: `${t("leads.import_created")}: ${result.created} · ${t("leads.import_duplicates")}: ${result.duplicates} · ${t("leads.import_failed")}: ${result.failed}`,
    });
  }

  function resetImport() {
    setRows([]);
    setSummary(null);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Convert a lead into a real (assigned) customer in one click: create the
  // customer from the lead's data, then record the conversion. The conversion
  // endpoint transactionally flips the lead to "converted" and re-points its
  // activities/follow-ups onto the new customer, so its history is preserved.
  async function convertToCustomer(lead: Lead) {
    if (!companyId || convertingId) return;
    setConvertingId(lead.id);
    try {
      const customer = await createCustomer.mutateAsync({
        data: {
          companyId,
          fullName: lead.fullName,
          ...(lead.branchId ? { branchId: lead.branchId } : {}),
          ...(lead.phone ? { phone: lead.phone } : {}),
          ...(lead.nationalId ? { nationalId: lead.nationalId } : {}),
          ...(lead.email ? { email: lead.email } : {}),
          ...(lead.assignedToUserId ? { assignedToUserId: lead.assignedToUserId } : {}),
        },
      });
      await createConversion.mutateAsync({
        data: { companyId, leadId: lead.id, customerId: customer.id },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey({ pageSize: 200 }) }),
      ]);
      toast({
        title: language === "ar"
          ? `تم تحويل "${lead.fullName}" إلى عميل — يمكنك الآن بدء البيع وإنشاء الحجز`
          : `Converted "${lead.fullName}" to a customer — you can now start a sale and create a reservation`,
      });
    } catch (err) {
      const status = (err as { status?: number })?.status;
      toast({
        title: status === 409
          ? (language === "ar" ? "رمز العميل مستخدم، حاول مرة أخرى" : "Customer code already in use, try again")
          : t("common.error"),
        variant: "destructive",
      });
    } finally {
      setConvertingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setImportOpen(true)} data-testid="button-import-leads">
          <Upload className="h-4 w-4 me-2" />
          {t("leads.import_excel")}
        </Button>
      </div>

      <ResourceManager
        title="Leads"
        titleAr="العملاء المحتملون"
        columns={columns}
        fields={fields}
        useList={useListLeads}
        useCreate={useCreateLead}
        useUpdate={useUpdateLead}
        useDelete={useDeleteLead}
        getListQueryKey={getListLeadsQueryKey}
        companyId={companyId}
        rowActions={(lead) =>
          lead.status === "converted" ? (
            <Badge variant="secondary">{enumLabel("converted", language)}</Badge>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={convertingId !== null}
              onClick={() => void convertToCustomer(lead)}
              data-testid={`button-convert-lead-${lead.id}`}
            >
              {convertingId === lead.id ? (
                <Loader2 className="h-4 w-4 animate-spin me-1" />
              ) : (
                <UserPlus className="h-4 w-4 me-1" />
              )}
              {language === "ar" ? "تحويل إلى عميل" : "Convert to Customer"}
            </Button>
          )
        }
      />

      <Dialog
        open={importOpen}
        onOpenChange={(o) => {
          setImportOpen(o);
          if (!o) resetImport();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("leads.import_excel")}</DialogTitle>
            <DialogDescription>{t("leads.import_desc")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="block w-full text-sm file:me-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
              data-testid="input-import-file"
            />

            {fileName && !summary && (
              <p className="text-sm text-muted-foreground">
                {fileName} — {rows.length} {t("leads.import_rows_ready")}
              </p>
            )}

            {summary && (
              <div className="rounded-md border p-3 text-sm space-y-1" data-testid="text-import-summary">
                <div>{t("leads.import_created")}: {summary.created}</div>
                <div>{t("leads.import_duplicates")}: {summary.duplicates}</div>
                <div>{t("leads.import_failed")}: {summary.failed}</div>
                {summary.skipped > 0 && <div>{t("leads.import_skipped")}: {summary.skipped}</div>}
                {summary.errors.map((e, idx) => (
                  <div key={idx} className="text-destructive">{e}</div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              {t("common.close")}
            </Button>
            <Button
              onClick={runImport}
              disabled={importing || rows.length === 0 || !companyId}
              data-testid="button-run-import"
            >
              {importing ? t("leads.importing") : `${t("leads.import")} (${rows.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
