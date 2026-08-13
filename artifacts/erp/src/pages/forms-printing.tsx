import { useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import DOMPurify from "dompurify";
import {
  useListFormTemplates,
  getListFormTemplatesQueryKey,
  useGetFormTemplate,
  getGetFormTemplateQueryKey,
  useCreateFormTemplate,
  useUpdateFormTemplate,
  useDisableFormTemplate,
  useEnableFormTemplate,
  useCreateFormTemplateVersion,
  useUpdateFormTemplateVersion,
  useSubmitFormTemplateVersion,
  useEndorseFormTemplateVersion,
  useApproveFormTemplateVersion,
  useRejectFormTemplateVersion,
  useActivateFormTemplateVersion,
  useGetFormBindingCatalog,
  useCreateFormUploadUrl,
  useImportFormTemplate,
  useListPrintJobs,
  getListPrintJobsQueryKey,
  useCreatePrintJob,
  renderFormTemplate,
  useListCompanies,
  type FormTemplate,
  type FormTemplateVersion,
} from "@workspace/api-client-react";
import { useLanguage } from "@/lib/language-provider";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  Plus,
  Upload,
  Printer,
  Eye,
  Send,
  ThumbsUp,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Ban,
  Power,
  QrCode,
  Barcode,
  Image as ImageIcon,
  PenLine,
  Stamp,
} from "lucide-react";

const DOCUMENT_TYPES = [
  "contract",
  "reservation",
  "unit",
  "invoice",
  "receipt",
  "supplier",
  "employee",
  "letter",
  "other",
];

const MODULE_LABELS: Record<string, { en: string; ar: string }> = {
  sales: { en: "Sales & CRM", ar: "المبيعات وإدارة العملاء" },
  realEstate: { en: "Real Estate", ar: "العقارات" },
  finance: { en: "Financial Management", ar: "الإدارة المالية" },
  engineering: { en: "Engineering", ar: "الهندسة" },
  construction: { en: "Construction", ar: "الإنشاءات" },
  procurement: { en: "Procurement", ar: "المشتريات" },
  inventory: { en: "Inventory", ar: "المخزون" },
  hr: { en: "Human Resources", ar: "الموارد البشرية" },
  legal: { en: "Legal Affairs", ar: "الشؤون القانونية" },
  landBank: { en: "Land Bank", ar: "بنك الأراضي" },
  customerService: { en: "Customer Service", ar: "خدمة العملاء" },
  fixedAssets: { en: "Fixed Assets", ar: "الأصول الثابتة" },
  general: { en: "General Administration", ar: "الشؤون الإدارية" },
  insurance: { en: "Insurance", ar: "التأمين" },
  businessIntelligence: { en: "Business Intelligence", ar: "ذكاء الأعمال" },
  administration: { en: "Administration", ar: "الإدارة" },
  systemAdministration: { en: "System Administration", ar: "إدارة النظام" },
};

// Merged modules: a parent module's single Forms & Printing also surfaces the
// templates of the child modules that were folded into it (links consolidated to
// one shared section per parent — child template content stays reachable).
const MODULE_GROUPS: Record<string, string[]> = {
  procurement: ["procurement", "inventory"],
  finance: ["finance", "fixedAssets"],
  engineering: ["engineering", "construction"],
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  submitted: "outline",
  endorsed: "outline",
  approved: "default",
  rejected: "destructive",
  superseded: "secondary",
  active: "default",
  disabled: "destructive",
};

function statusLabel(status: string, lang: "en" | "ar"): string {
  const map: Record<string, { en: string; ar: string }> = {
    draft: { en: "Draft", ar: "مسودة" },
    submitted: { en: "Submitted", ar: "مُقدَّم" },
    endorsed: { en: "Endorsed", ar: "مُعتمَد مبدئياً" },
    approved: { en: "Approved", ar: "معتمد" },
    rejected: { en: "Rejected", ar: "مرفوض" },
    superseded: { en: "Superseded", ar: "مُستبدل" },
    active: { en: "Active", ar: "نشط" },
    disabled: { en: "Disabled", ar: "معطّل" },
  };
  return map[status]?.[lang] ?? status;
}

/** Replace .form-qr / .form-barcode placeholder nodes with generated images, then return printable HTML. */
async function enhanceForPrint(html: string): Promise<string> {
  const clean = DOMPurify.sanitize(html, {
    ADD_ATTR: ["data-code"],
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
  });
  const doc = new DOMParser().parseFromString(clean, "text/html");
  for (const el of Array.from(doc.querySelectorAll(".form-qr"))) {
    const code = el.getAttribute("data-code") || el.textContent || " ";
    try {
      const url = await QRCode.toDataURL(code || " ", { width: 128, margin: 1 });
      const img = doc.createElement("img");
      img.src = url;
      img.style.width = "128px";
      img.style.height = "128px";
      el.replaceWith(img);
    } catch {
      /* leave placeholder */
    }
  }
  for (const el of Array.from(doc.querySelectorAll(".form-barcode"))) {
    const code = el.getAttribute("data-code") || el.textContent || "0";
    try {
      const canvas = document.createElement("canvas");
      JsBarcode(canvas, code || "0", { format: "CODE128", width: 2, height: 60, displayValue: true });
      const img = doc.createElement("img");
      img.src = canvas.toDataURL("image/png");
      el.replaceWith(img);
    } catch {
      /* leave placeholder */
    }
  }
  // Standalone print document — a complete HTML file handed to the printer with
  // none of the app stylesheet loaded, so design tokens would resolve to
  // nothing. The literal colours here and in the snippet buttons below are
  // intentional and must stay literal.
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,Segoe UI,Arial,sans-serif;padding:24px;color:#111}img{max-width:100%}</style></head><body>${doc.body.innerHTML}</body></html>`;
}

function printHtml(html: string) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 350);
}

export default function FormsPrintingPage() {
  const [, params] = useRoute("/forms-printing/:moduleKey");
  const moduleKey = params?.moduleKey ?? "general";
  const { language } = useLanguage();
  const lang = language === "ar" ? "ar" : "en";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const includedKeys = MODULE_GROUPS[moduleKey] ?? [moduleKey];
  const primaryKey = includedKeys[0];
  const secondaryKey = includedKeys[1];

  const primaryQuery = useListFormTemplates(
    { moduleKey: primaryKey, search: search || undefined },
    { query: { queryKey: getListFormTemplatesQueryKey({ moduleKey: primaryKey, search: search || undefined }) } },
  );
  const secondaryQuery = useListFormTemplates(
    { moduleKey: secondaryKey ?? "__none__", search: search || undefined },
    {
      query: {
        enabled: !!secondaryKey,
        queryKey: getListFormTemplatesQueryKey({ moduleKey: secondaryKey ?? "__none__", search: search || undefined }),
      },
    },
  );
  const templates = useMemo(
    () => [...(primaryQuery.data?.data ?? []), ...(secondaryQuery.data?.data ?? [])],
    [primaryQuery.data, secondaryQuery.data],
  );
  const isLoading = primaryQuery.isLoading || (!!secondaryKey && secondaryQuery.isLoading);

  const moduleLabel = MODULE_LABELS[moduleKey]?.[lang] ?? moduleKey;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={FileText}
        title={lang === "ar" ? "النماذج والطباعة" : "Forms & Printing"}
        meta={<span className="text-sm text-muted-foreground">{moduleLabel}</span>}
        bordered={false}
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <TemplateList
          templates={templates}
          selectedId={selectedId}
          onSelect={setSelectedId}
          search={search}
          onSearch={setSearch}
          lang={lang}
          moduleKey={moduleKey}
          companyId={companyId}
          isLoading={isLoading}
        />
        {selectedId ? (
          <TemplateDetail key={selectedId} templateId={selectedId} lang={lang} />
        ) : (
          <Card className="flex items-center justify-center min-h-[400px]">
            <CardContent className="text-muted-foreground text-sm pt-6">
              {lang === "ar"
                ? "اختر نموذجاً من القائمة أو أنشئ نموذجاً جديداً."
                : "Select a template from the list or create a new one."}
            </CardContent>
          </Card>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {lang === "ar"
          ? "الطباعة تستخدم آخر إصدار معتمد فقط. التعديلات تُنشئ إصداراً جديداً وتُطبَّق على المستندات الجديدة."
          : "Printing always uses the latest approved version. Edits create a new version applied to new documents only."}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function TemplateList(props: {
  templates: FormTemplate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearch: (v: string) => void;
  lang: "en" | "ar";
  moduleKey: string;
  companyId?: string;
  isLoading: boolean;
}) {
  const { templates, selectedId, onSelect, search, onSearch, lang, moduleKey, companyId } = props;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateFormTemplate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", nameAr: "", documentType: "other" });

  const handleCreate = () => {
    if (!companyId) {
      toast({ title: lang === "ar" ? "لا توجد شركة" : "No company found", variant: "destructive" });
      return;
    }
    if (!form.code || !form.name) {
      toast({ title: lang === "ar" ? "الرمز والاسم مطلوبان" : "Code and name are required", variant: "destructive" });
      return;
    }
    createMutation.mutate(
      {
        data: {
          companyId,
          moduleKey,
          code: form.code,
          name: form.name,
          nameAr: form.nameAr || undefined,
          documentType: form.documentType,
          sourceFormat: "html",
          content: "<h2>{{company.name}}</h2>\n<p></p>",
        },
      },
      {
        onSuccess: (detail) => {
          toast({ title: lang === "ar" ? "تم الإنشاء" : "Template created" });
          setOpen(false);
          setForm({ code: "", name: "", nameAr: "", documentType: "other" });
          queryClient.invalidateQueries({ queryKey: getListFormTemplatesQueryKey({ moduleKey }) });
          if (detail?.template?.id) onSelect(detail.template.id);
        },
        onError: () => toast({ title: lang === "ar" ? "فشل الإنشاء" : "Could not create", variant: "destructive" }),
      },
    );
  };

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">{lang === "ar" ? "النماذج" : "Templates"}</CardTitle>
          <Button size="sm" onClick={() => setOpen(true)} className="gap-1">
            <Plus className="h-4 w-4" />
            {lang === "ar" ? "جديد" : "New"}
          </Button>
        </div>
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={lang === "ar" ? "بحث..." : "Search..."}
          className="h-8"
        />
      </CardHeader>
      <CardContent className="p-2">
        <ScrollArea className="h-[460px]">
          <div className="space-y-1">
            {templates.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                {lang === "ar" ? "لا توجد نماذج بعد." : "No templates yet."}
              </p>
            )}
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => onSelect(t.id)}
                className={`w-full rounded-md border px-3 py-2 text-start transition-colors ${
                  selectedId === t.id ? "border-primary bg-muted" : "hover:bg-muted/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {lang === "ar" && t.nameAr ? t.nameAr : t.name}
                  </span>
                  <Badge variant={STATUS_VARIANT[t.status] ?? "secondary"} className="shrink-0 text-[10px]">
                    {statusLabel(t.status, lang)}
                  </Badge>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{t.code}</span>
                  <span>·</span>
                  <span>{t.documentType}</span>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lang === "ar" ? "نموذج جديد" : "New Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label>{lang === "ar" ? "الرمز" : "Code"}</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>{lang === "ar" ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>{lang === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
              <Input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>{lang === "ar" ? "نوع المستند" : "Document type"}</Label>
              <Select value={form.documentType} onValueChange={(v) => setForm({ ...form, documentType: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {lang === "ar" ? "إنشاء" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

function TemplateDetail({ templateId, lang }: { templateId: string; lang: "en" | "ar" }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const detailQuery = useGetFormTemplate(templateId);
  const detail = detailQuery.data;
  const template = detail?.template;
  const versions = useMemo(() => detail?.versions ?? [], [detail]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetFormTemplateQueryKey(templateId) });
    if (template) {
      queryClient.invalidateQueries({ queryKey: getListFormTemplatesQueryKey({ moduleKey: template.moduleKey }) });
    }
  };

  if (detailQuery.isLoading || !template) {
    return (
      <Card className="min-h-[400px]">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          {lang === "ar" ? "جارٍ التحميل..." : "Loading..."}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              {lang === "ar" && template.nameAr ? template.nameAr : template.name}
            </CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <span className="font-mono">{template.code}</span> · {template.documentType}
            </p>
          </div>
          <TemplateStateButtons template={template} lang={lang} onDone={invalidate} />
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="editor">
          <TabsList>
            <TabsTrigger value="editor">{lang === "ar" ? "المحرر" : "Editor"}</TabsTrigger>
            <TabsTrigger value="versions">{lang === "ar" ? "الإصدارات" : "Versions"}</TabsTrigger>
            <TabsTrigger value="print">{lang === "ar" ? "الطباعة" : "Print"}</TabsTrigger>
            <TabsTrigger value="log">{lang === "ar" ? "سجل الطباعة" : "Print Log"}</TabsTrigger>
          </TabsList>

          <TabsContent value="editor">
            <EditorTab template={template} versions={versions} lang={lang} onDone={invalidate} />
          </TabsContent>
          <TabsContent value="versions">
            <VersionsTab template={template} versions={versions} lang={lang} onDone={invalidate} />
          </TabsContent>
          <TabsContent value="print">
            <PrintTab template={template} lang={lang} />
          </TabsContent>
          <TabsContent value="log">
            <PrintLogTab templateId={template.id} lang={lang} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

function TemplateStateButtons({
  template,
  lang,
  onDone,
}: {
  template: FormTemplate;
  lang: "en" | "ar";
  onDone: () => void;
}) {
  const { toast } = useToast();
  const disableMutation = useDisableFormTemplate();
  const enableMutation = useEnableFormTemplate();

  const ok = () => {
    toast({ title: lang === "ar" ? "تم الحفظ" : "Saved" });
    onDone();
  };
  const err = () => toast({ title: lang === "ar" ? "حدث خطأ" : "Action failed", variant: "destructive" });

  if (template.status === "disabled") {
    return (
      <Button
        size="sm"
        variant="outline"
        className="gap-1"
        onClick={() => enableMutation.mutate({ id: template.id, data: {} }, { onSuccess: ok, onError: err })}
      >
        <Power className="h-4 w-4" />
        {lang === "ar" ? "تفعيل" : "Enable"}
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-1 text-destructive"
      onClick={() => disableMutation.mutate({ id: template.id, data: {} }, { onSuccess: ok, onError: err })}
    >
      <Ban className="h-4 w-4" />
      {lang === "ar" ? "تعطيل" : "Disable"}
    </Button>
  );
}

/* -------------------------------------------------------------------------- */

function EditorTab({
  template,
  versions,
  lang,
  onDone,
}: {
  template: FormTemplate;
  versions: FormTemplateVersion[];
  lang: "en" | "ar";
  onDone: () => void;
}) {
  const { toast } = useToast();
  const editable = useMemo(
    () =>
      versions.find((v) => v.status === "draft" || v.status === "rejected") ??
      versions.find((v) => v.id === template.currentVersionId) ??
      versions[0],
    [versions, template.currentVersionId],
  );
  const isEditable = editable?.status === "draft" || editable?.status === "rejected";

  const [content, setContent] = useState(editable?.content ?? "");
  const [contentAr, setContentAr] = useState(editable?.contentAr ?? "");
  const [changeSummary, setChangeSummary] = useState("");
  const [activeEditor, setActiveEditor] = useState<"en" | "ar">("en");
  const enRef = useRef<HTMLTextAreaElement>(null);
  const arRef = useRef<HTMLTextAreaElement>(null);

  const catalogQuery = useGetFormBindingCatalog(
    { moduleKey: template.moduleKey, documentType: template.documentType },
    { query: { queryKey: ["form-binding-catalog", template.moduleKey, template.documentType] } },
  );
  const groups = catalogQuery.data?.groups ?? [];

  const createVersion = useCreateFormTemplateVersion();
  const updateVersion = useUpdateFormTemplateVersion();
  const uploadUrl = useCreateFormUploadUrl();
  const importDoc = useImportFormTemplate();
  const fileRef = useRef<HTMLInputElement>(null);

  const insert = (snippet: string) => {
    if (activeEditor === "en") {
      const el = enRef.current;
      const pos = el?.selectionStart ?? content.length;
      const next = content.slice(0, pos) + snippet + content.slice(pos);
      setContent(next);
    } else {
      const el = arRef.current;
      const pos = el?.selectionStart ?? contentAr.length;
      const next = contentAr.slice(0, pos) + snippet + contentAr.slice(pos);
      setContentAr(next);
    }
  };

  const handleSave = () => {
    const payload = { content, contentAr: contentAr || undefined, changeSummary: changeSummary || undefined };
    if (isEditable && editable) {
      updateVersion.mutate(
        { id: template.id, versionId: editable.id, data: payload },
        {
          onSuccess: () => {
            toast({ title: lang === "ar" ? "تم حفظ المسودة" : "Draft saved" });
            onDone();
          },
          onError: () => toast({ title: lang === "ar" ? "فشل الحفظ" : "Save failed", variant: "destructive" }),
        },
      );
    } else {
      createVersion.mutate(
        { id: template.id, data: { ...payload, sourceFormat: "html" } },
        {
          onSuccess: () => {
            toast({ title: lang === "ar" ? "تم إنشاء إصدار جديد (مسودة)" : "New draft version created" });
            setChangeSummary("");
            onDone();
          },
          onError: () => toast({ title: lang === "ar" ? "فشل الإنشاء" : "Could not create version", variant: "destructive" }),
        },
      );
    }
  };

  const handleFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const fmt = ext === "docx" || ext === "doc" ? "docx" : ext === "pdf" ? "pdf" : "html";
    try {
      const { uploadUrl: url, filePath } = await uploadUrl.mutateAsync();
      await fetch(url, { method: "PUT", body: file });
      const result = await importDoc.mutateAsync({ data: { fileObjectPath: filePath, fileFormat: fmt } });
      if (activeEditor === "ar") setContentAr(result.html);
      else setContent(result.html);
      toast({
        title: lang === "ar" ? "تم الاستيراد" : "Imported",
        description: result.warning ?? undefined,
        variant: result.warning ? "destructive" : undefined,
      });
    } catch {
      toast({ title: lang === "ar" ? "فشل الاستيراد" : "Import failed", variant: "destructive" });
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_240px] pt-3">
      <div className="space-y-3">
        {!isEditable && (
          <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {lang === "ar"
              ? "هذا الإصدار معتمد/مقفل. الحفظ سيُنشئ إصداراً جديداً (مسودة) للمراجعة."
              : "This version is approved/locked. Saving will create a new draft version for review."}
          </div>
        )}
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <Label>{lang === "ar" ? "المحتوى (إنجليزي) — HTML" : "Content (English) — HTML"}</Label>
            <input
              ref={fileRef}
              type="file"
              accept=".html,.htm,.docx,.doc,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="outline" className="gap-1 h-7" onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" />
              {lang === "ar" ? "استيراد Word/PDF/HTML" : "Import Word/PDF/HTML"}
            </Button>
          </div>
          <Textarea
            ref={enRef}
            value={content}
            onFocus={() => setActiveEditor("en")}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[220px] font-mono text-xs"
            dir="ltr"
          />
        </div>
        <div className="grid gap-1.5">
          <Label>{lang === "ar" ? "المحتوى (عربي) — HTML" : "Content (Arabic) — HTML"}</Label>
          <Textarea
            ref={arRef}
            value={contentAr}
            onFocus={() => setActiveEditor("ar")}
            onChange={(e) => setContentAr(e.target.value)}
            className="min-h-[180px] font-mono text-xs"
            dir="rtl"
          />
        </div>
        <div className="grid gap-1.5">
          <Label>{lang === "ar" ? "ملخص التغيير" : "Change summary"}</Label>
          <Input value={changeSummary} onChange={(e) => setChangeSummary(e.target.value)} />
        </div>
        <Button onClick={handleSave} disabled={createVersion.isPending || updateVersion.isPending}>
          {isEditable
            ? lang === "ar"
              ? "حفظ المسودة"
              : "Save draft"
            : lang === "ar"
              ? "إنشاء إصدار جديد"
              : "Create new version"}
        </Button>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">{lang === "ar" ? "عناصر" : "Blocks"}</Label>
          <div className="mt-1 grid grid-cols-2 gap-1">
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => insert('<img src="{{company.logoUrl}}" style="height:64px" alt="logo" />')}>
              <ImageIcon className="h-3.5 w-3.5" /> {lang === "ar" ? "شعار" : "Logo"}
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => insert('<div class="form-qr" data-code="{{document.number}}"></div>')}>
              <QrCode className="h-3.5 w-3.5" /> QR
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => insert('<div class="form-barcode" data-code="{{document.number}}"></div>')}>
              <Barcode className="h-3.5 w-3.5" /> {lang === "ar" ? "باركود" : "Barcode"}
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => insert('<div style="margin-top:48px;border-top:1px solid #000;width:200px;padding-top:4px">{{document.signatureLabel}}</div>')}>
              <PenLine className="h-3.5 w-3.5" /> {lang === "ar" ? "توقيع" : "Signature"}
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => insert('<div style="margin-top:24px;width:120px;height:120px;border:1px dashed #999;border-radius:50%;display:flex;align-items:center;justify-content:center">{{company.name}}</div>')}>
              <Stamp className="h-3.5 w-3.5" /> {lang === "ar" ? "ختم" : "Stamp"}
            </Button>
          </div>
        </div>

        <div>
          <Label className="text-xs">{lang === "ar" ? "حقول الربط" : "Binding fields"}</Label>
          <ScrollArea className="mt-1 h-[300px] rounded-md border p-2">
            <div className="space-y-2">
              {groups.map((g) => (
                <div key={g.group}>
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    {lang === "ar" ? g.groupAr : g.group}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {g.tokens.map((tok) => (
                      <button
                        key={tok.token}
                        onClick={() => insert(`{{${tok.token}}}`)}
                        title={lang === "ar" ? tok.labelAr : tok.label}
                        className="rounded border bg-muted/40 px-1.5 py-0.5 text-[10px] font-mono hover:bg-muted"
                      >
                        {lang === "ar" ? tok.labelAr : tok.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function VersionsTab({
  template,
  versions,
  lang,
  onDone,
}: {
  template: FormTemplate;
  versions: FormTemplateVersion[];
  lang: "en" | "ar";
  onDone: () => void;
}) {
  const { toast } = useToast();
  const submit = useSubmitFormTemplateVersion();
  const endorse = useEndorseFormTemplateVersion();
  const approve = useApproveFormTemplateVersion();
  const reject = useRejectFormTemplateVersion();
  const activate = useActivateFormTemplateVersion();
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const ok = () => {
    toast({ title: lang === "ar" ? "تم" : "Done" });
    onDone();
  };
  const err = () => toast({ title: lang === "ar" ? "غير مسموح أو حالة غير صحيحة" : "Not allowed or invalid state", variant: "destructive" });

  const doReject = () => {
    if (!rejectFor) return;
    reject.mutate(
      { id: template.id, versionId: rejectFor, data: { reason: rejectReason || undefined } },
      {
        onSuccess: () => {
          setRejectFor(null);
          setRejectReason("");
          ok();
        },
        onError: err,
      },
    );
  };

  return (
    <div className="pt-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{lang === "ar" ? "الإصدار" : "Version"}</TableHead>
            <TableHead>{lang === "ar" ? "الحالة" : "Status"}</TableHead>
            <TableHead>{lang === "ar" ? "المسار" : "Trail"}</TableHead>
            <TableHead className="text-end">{lang === "ar" ? "إجراءات" : "Actions"}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {versions.map((v) => {
            const isCurrent = v.id === template.currentVersionId;
            return (
              <TableRow key={v.id}>
                <TableCell className="font-medium">
                  v{v.versionNumber}
                  {isCurrent && (
                    <Badge variant="default" className="ms-2 text-[10px]">
                      {lang === "ar" ? "حالي" : "Current"}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[v.status] ?? "secondary"}>{statusLabel(v.status, lang)}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {v.submittedByUserName && <div>↳ {v.submittedByUserName}</div>}
                  {v.endorsedByUserName && <div>✓ {v.endorsedByUserName}</div>}
                  {v.approvedByUserName && <div>★ {v.approvedByUserName}</div>}
                  {v.rejectReason && <div className="text-destructive">✗ {v.rejectReason}</div>}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-1">
                    {(v.status === "draft" || v.status === "rejected") && (
                      <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => submit.mutate({ id: template.id, versionId: v.id, data: {} }, { onSuccess: ok, onError: err })}>
                        <Send className="h-3.5 w-3.5" /> {lang === "ar" ? "تقديم" : "Submit"}
                      </Button>
                    )}
                    {v.status === "submitted" && (
                      <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => endorse.mutate({ id: template.id, versionId: v.id, data: {} }, { onSuccess: ok, onError: err })}>
                        <ThumbsUp className="h-3.5 w-3.5" /> {lang === "ar" ? "اعتماد مبدئي" : "Endorse"}
                      </Button>
                    )}
                    {v.status === "endorsed" && (
                      <Button size="sm" className="h-7 gap-1" onClick={() => approve.mutate({ id: template.id, versionId: v.id, data: {} }, { onSuccess: ok, onError: err })}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> {lang === "ar" ? "اعتماد" : "Approve"}
                      </Button>
                    )}
                    {(v.status === "submitted" || v.status === "endorsed") && (
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-destructive" onClick={() => setRejectFor(v.id)}>
                        <XCircle className="h-3.5 w-3.5" /> {lang === "ar" ? "رفض" : "Reject"}
                      </Button>
                    )}
                    {v.status === "superseded" && (
                      <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => activate.mutate({ id: template.id, versionId: v.id, data: {} }, { onSuccess: ok, onError: err })}>
                        <RotateCcw className="h-3.5 w-3.5" /> {lang === "ar" ? "استرجاع" : "Revert"}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={!!rejectFor} onOpenChange={(o) => !o && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lang === "ar" ? "سبب الرفض" : "Rejection reason"}</DialogTitle>
          </DialogHeader>
          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectFor(null)}>
              {lang === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={doReject}>
              {lang === "ar" ? "رفض" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function PrintTab({ template, lang }: { template: FormTemplate; lang: "en" | "ar" }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createPrint = useCreatePrintJob();
  const [printLang, setPrintLang] = useState<"ar" | "en">(lang);
  const [entityId, setEntityId] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [reprintReason, setReprintReason] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const hasApproved = !!template.currentVersionId;

  const doPreview = async () => {
    if (!hasApproved) {
      toast({ title: lang === "ar" ? "لا يوجد إصدار معتمد" : "No approved version", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await renderFormTemplate({
        templateId: template.id,
        entityId: entityId || undefined,
        language: printLang,
      });
      setPreview(await enhanceForPrint(res.html));
    } catch {
      toast({ title: lang === "ar" ? "تعذّر إنشاء المعاينة" : "Could not render preview", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const doPrint = () => {
    if (!hasApproved) {
      toast({ title: lang === "ar" ? "لا يوجد إصدار معتمد" : "No approved version", variant: "destructive" });
      return;
    }
    setBusy(true);
    createPrint.mutate(
      {
        data: {
          templateId: template.id,
          entityType: template.documentType,
          entityId: entityId || undefined,
          documentNumber: documentNumber || undefined,
          language: printLang,
          reprintReason: reprintReason || undefined,
        },
      },
      {
        onSuccess: async (result) => {
          setBusy(false);
          queryClient.invalidateQueries({ queryKey: getListPrintJobsQueryKey({ templateId: template.id }) });
          printHtml(await enhanceForPrint(result.html));
          setReprintReason("");
          toast({
            title: result.printJob.isReprint
              ? lang === "ar"
                ? "إعادة طباعة"
                : "Reprinted"
              : lang === "ar"
                ? "تمت الطباعة"
                : "Printed",
          });
        },
        onError: () => {
          setBusy(false);
          toast({
            title: lang === "ar" ? "تعذّرت الطباعة (قد يلزم سبب إعادة الطباعة)" : "Print failed (a reprint reason may be required)",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr] pt-3">
      <div className="space-y-3">
        {!hasApproved && (
          <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {lang === "ar" ? "لا يمكن الطباعة قبل اعتماد إصدار." : "Cannot print until a version is approved."}
          </div>
        )}
        <div className="grid gap-1.5">
          <Label>{lang === "ar" ? "اللغة" : "Language"}</Label>
          <Select value={printLang} onValueChange={(v) => setPrintLang(v as "ar" | "en")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ar">{lang === "ar" ? "عربي" : "Arabic"}</SelectItem>
              <SelectItem value="en">{lang === "ar" ? "إنجليزي" : "English"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>{lang === "ar" ? "معرّف السجل (اختياري)" : "Record ID (optional)"}</Label>
          <Input value={entityId} onChange={(e) => setEntityId(e.target.value)} placeholder="UUID" />
        </div>
        <div className="grid gap-1.5">
          <Label>{lang === "ar" ? "رقم المستند (اختياري)" : "Document number (optional)"}</Label>
          <Input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>{lang === "ar" ? "سبب إعادة الطباعة" : "Reprint reason"}</Label>
          <Input value={reprintReason} onChange={(e) => setReprintReason(e.target.value)} placeholder={lang === "ar" ? "مطلوب عند إعادة الطباعة" : "Required when reprinting"} />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 gap-1" onClick={doPreview} disabled={busy}>
            <Eye className="h-4 w-4" /> {lang === "ar" ? "معاينة" : "Preview"}
          </Button>
          <Button className="flex-1 gap-1" onClick={doPrint} disabled={busy}>
            <Printer className="h-4 w-4" /> {lang === "ar" ? "طباعة" : "Print"}
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-white min-h-[420px]">
        {preview ? (
          <iframe title="preview" srcDoc={preview} sandbox="" className="h-[480px] w-full rounded-md" />
        ) : (
          <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">
            {lang === "ar" ? "اضغط معاينة لعرض المستند" : "Click Preview to render the document"}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function PrintLogTab({ templateId, lang }: { templateId: string; lang: "en" | "ar" }) {
  const logQuery = useListPrintJobs(
    { templateId, pageSize: 100 },
    { query: { queryKey: getListPrintJobsQueryKey({ templateId, pageSize: 100 }) } },
  );
  const jobs = logQuery.data?.data ?? [];

  return (
    <div className="pt-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{lang === "ar" ? "التسلسل" : "Seq"}</TableHead>
            <TableHead>{lang === "ar" ? "النوع" : "Type"}</TableHead>
            <TableHead>{lang === "ar" ? "المستخدم" : "User"}</TableHead>
            <TableHead>{lang === "ar" ? "التاريخ" : "Date"}</TableHead>
            <TableHead>{lang === "ar" ? "النسخ" : "Copies"}</TableHead>
            <TableHead>{lang === "ar" ? "السبب" : "Reason"}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                {lang === "ar" ? "لا يوجد سجل طباعة." : "No print history."}
              </TableCell>
            </TableRow>
          )}
          {jobs.map((j) => (
            <TableRow key={j.id}>
              <TableCell className="font-medium">#{j.printSequence}</TableCell>
              <TableCell>
                <Badge variant={j.isReprint ? "outline" : "default"}>
                  {j.isReprint ? (lang === "ar" ? "إعادة طباعة" : "Reprint") : lang === "ar" ? "طباعة" : "Print"}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">{j.printedByUserName ?? "—"}</TableCell>
              <TableCell className="text-sm">{new Date(j.printedAt).toLocaleString()}</TableCell>
              <TableCell>{j.copies}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{j.reprintReason ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
