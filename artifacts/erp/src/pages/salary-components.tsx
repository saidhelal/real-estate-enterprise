import {
  useListSalaryComponents,
  useCreateSalaryComponent,
  useUpdateSalaryComponent,
  useDeleteSalaryComponent,
  getListSalaryComponentsQueryKey,
  useListCompanies,
  type SalaryComponent,
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
const COMPONENT_TYPE = enumOptions(["earning", "deduction"]);
const CALC_TYPE = enumOptions(["fixed", "percentage"]);

export default function SalaryComponentsPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: t("common.code"), required: true, createOnly: true },
    { name: "name", label: t("common.name"), required: true },
    { name: "nameAr", label: t("common.name_ar"), required: true, rtl: true },
    { name: "componentType", label: t("hr.component_type"), type: "select", options: COMPONENT_TYPE },
    { name: "calculationType", label: t("hr.calculation_type"), type: "select", options: CALC_TYPE },
    { name: "amount", label: t("hr.amount"), type: "money" },
    { name: "percentage", label: t("hr.percentage"), type: "number" },
    { name: "taxable", label: t("hr.taxable"), type: "boolean" },
    { name: "description", label: t("common.description"), type: "textarea" },
    { name: "status", label: t("common.status"), type: "select", options: STATUS },
  ];

  const columns: ResourceColumn<SalaryComponent>[] = [
    { header: t("common.code"), render: (r) => r.code },
    { header: t("common.name"), render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: t("hr.component_type"), render: (r) => <Badge variant="secondary">{enumLabel(r.componentType, language)}</Badge> },
    { header: t("hr.calculation_type"), render: (r) => enumLabel(r.calculationType, language) },
    { header: t("hr.amount"), render: (r) => r.amount },
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
      title={t("nav.salary_components")}
      columns={columns}
      fields={fields}
      useList={useListSalaryComponents}
      useCreate={useCreateSalaryComponent}
      useUpdate={useUpdateSalaryComponent}
      useDelete={useDeleteSalaryComponent}
      getListQueryKey={getListSalaryComponentsQueryKey}
      companyId={companyId}
    />
  );
}
