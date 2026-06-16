import {
  useListDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  getListDepartmentsQueryKey,
  useListCompanies,
  type Department,
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

export default function DepartmentsPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: t("common.code"), required: true, createOnly: true },
    { name: "name", label: t("common.name"), required: true },
    { name: "nameAr", label: t("common.name_ar"), required: true, rtl: true },
    { name: "description", label: t("common.description"), type: "textarea" },
    { name: "status", label: t("common.status"), type: "select", options: STATUS },
  ];

  const columns: ResourceColumn<Department>[] = [
    { header: t("common.code"), render: (r) => r.code },
    { header: t("common.name"), render: (r) => (language === "ar" ? r.nameAr : r.name) },
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
      title={t("nav.departments")}
      columns={columns}
      fields={fields}
      useList={useListDepartments}
      useCreate={useCreateDepartment}
      useUpdate={useUpdateDepartment}
      useDelete={useDeleteDepartment}
      getListQueryKey={getListDepartmentsQueryKey}
      companyId={companyId}
    />
  );
}
