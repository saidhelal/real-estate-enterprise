import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListContractTemplates,
  useCreateContractTemplate,
  useUpdateContractTemplate,
  useDeleteContractTemplate,
  getListContractTemplatesQueryKey,
  useImportContractTemplate,
  useListCompanies,
  type ContractTemplate,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useObjectUpload } from "@/lib/document-files";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";

const CONTRACT_TYPE = enumOptions(["sales", "construction", "procurement", "legal", "other"]);

/**
 * Reference palette of smart variables a .docx contract template can embed as
 * {{group.field}} placeholders. Mirrors the server-side contractTokenCatalog;
 * kept intentionally compact for at-a-glance authoring guidance.
 */
const TOKEN_GROUPS: Array<{ group: string; groupAr: string; tokens: string[] }> = [
  { group: "Company", groupAr: "الشركة", tokens: ["company.name", "company.nameAr", "company.taxNumber", "company.phone", "company.address"] },
  { group: "Customer", groupAr: "العميل", tokens: ["customer.name", "customer.nameAr", "customer.nationalId", "customer.phone", "customer.address"] },
  { group: "Project", groupAr: "المشروع", tokens: ["project.name", "project.nameAr", "project.location", "phase.name", "building.name", "floor.name", "floor.number"] },
  { group: "Unit", groupAr: "الوحدة", tokens: ["unit.code", "unit.name", "unit.area", "unit.basePrice", "unit.bedrooms", "unit.bathrooms"] },
  { group: "Sale", groupAr: "البيع", tokens: ["sale.code", "sale.date", "sale.totalPrice", "sale.downPayment"] },
  { group: "Contract", groupAr: "العقد", tokens: ["contract.code", "contract.title", "contract.value", "contract.date", "document.date"] },
];

export default function ContractTemplatesPage() {
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const { uploadObject, isUploading } = useObjectUpload();
  const importMutation = useImportContractTemplate();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [contractType, setContractType] = useState("legal");

  const resetImportForm = () => {
    setFile(null);
    setCode("");
    setName("");
    setNameAr("");
    setContractType("legal");
    if (fileRef.current) fileRef.current.value = "";
  };

  const canImport = Boolean(companyId && file && code.trim() && name.trim());

  const handleImport = async () => {
    if (!companyId || !file) return;
    try {
      const fileObjectPath = await uploadObject(file);
      await importMutation.mutateAsync({
        data: {
          companyId,
          code: code.trim(),
          name: name.trim(),
          nameAr: nameAr.trim() || undefined,
          contractType,
          fileObjectPath,
          fileFormat: "docx",
        },
      });
      toast({ title: t("legal.import_success") });
      resetImportForm();
      queryClient.invalidateQueries({ queryKey: getListContractTemplatesQueryKey() });
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  const fields: ResourceField[] = [
    { name: "code", label: t("common.code"), required: true, createOnly: true },
    { name: "name", label: t("legal.name"), required: true },
    { name: "nameAr", label: t("legal.name_ar"), rtl: true },
    { name: "contractType", label: t("legal.contract_type"), type: "select", options: CONTRACT_TYPE, required: true },
    { name: "content", label: t("legal.content"), type: "textarea" },
    { name: "contentAr", label: `${t("legal.content")} (${t("legal.title_ar")})`, type: "textarea", rtl: true },
    { name: "description", label: t("legal.description"), type: "textarea" },
  ];

  const columns: ResourceColumn<ContractTemplate>[] = [
    { header: t("common.code"), render: (r) => r.code },
    { header: t("legal.name"), render: (r) => (language === "ar" ? (r.nameAr ?? r.name) : r.name) },
    { header: t("legal.contract_type"), render: (r) => enumLabel(r.contractType, language) },
    { header: t("legal.version"), render: (r) => r.version ?? 1 },
    { header: t("common.status"), render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("legal.import_template")}</CardTitle>
          <CardDescription>{t("legal.import_hint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("common.code")}</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("legal.name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("legal.name_ar")}</Label>
              <Input value={nameAr} dir="rtl" onChange={(e) => setNameAr(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("legal.contract_type")}</Label>
              <Select value={contractType} onValueChange={setContractType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPE.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {language === "ar" ? (o.labelAr ?? o.label) : o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("legal.choose_file")}</Label>
              <Input
                ref={fileRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <Button onClick={handleImport} disabled={!canImport || isUploading || importMutation.isPending}>
            {t("legal.import")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("legal.template_variables")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOKEN_GROUPS.map((g) => (
              <div key={g.group} className="space-y-2">
                <div className="text-sm font-medium">{language === "ar" ? g.groupAr : g.group}</div>
                <div className="flex flex-wrap gap-1.5">
                  {g.tokens.map((tok) => (
                    <code key={tok} className="rounded bg-muted px-1.5 py-0.5 text-xs">{`{{${tok}}}`}</code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ResourceManager
        title={t("nav.contract_templates")}
        columns={columns}
        fields={fields}
        useList={useListContractTemplates}
        useCreate={useCreateContractTemplate}
        useUpdate={useUpdateContractTemplate}
        useDelete={useDeleteContractTemplate}
        getListQueryKey={getListContractTemplatesQueryKey}
        companyId={companyId}
      />
    </div>
  );
}
