import {
  useListKpiTemplates,
  useCreateKpiTemplate,
  useUpdateKpiTemplate,
  useDeleteKpiTemplate,
  getListKpiTemplatesQueryKey,
  useListCompanies,
  type KpiTemplate,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

const STATUS = enumOptions(["active", "inactive"]);

export default function KpiTemplatesPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: t("common.code"), required: true, createOnly: true },
    { name: "name", label: t("common.name"), required: true },
    { name: "nameAr", label: t("common.name_ar"), required: true, rtl: true },
    { name: "category", label: t("hr.category") },
    { name: "weight", label: t("hr.weight"), type: "number" },
    { name: "maxScore", label: t("hr.max_score"), type: "number" },
    { name: "description", label: t("common.description"), type: "textarea" },
    { name: "status", label: t("common.status"), type: "select", options: STATUS },
  ];

  const columns: ResourceColumn<KpiTemplate>[] = [
    { header: t("common.code"), render: (r) => r.code },
    { header: t("common.name"), render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: t("hr.category"), render: (r) => r.category ?? "-" },
    { header: t("hr.weight"), render: (r) => r.weight },
    { header: t("hr.max_score"), render: (r) => r.maxScore },
    {
      header: t("common.status"),
      render: (r) => (
        <Badge variant={r.status === "active" ? "secondary" : "outline"}>
          {enumLabel(r.status, language)}
        </Badge>
      ),
    },
  ];

  return (
    <ResourceManager
      title={t("nav.kpi_templates")}
      columns={columns}
      fields={fields}
      useList={useListKpiTemplates}
      useCreate={useCreateKpiTemplate}
      useUpdate={useUpdateKpiTemplate}
      useDelete={useDeleteKpiTemplate}
      getListQueryKey={getListKpiTemplatesQueryKey}
      companyId={companyId}
    />
  );
}
