import {
  useListSections,
  useCreateSection,
  useUpdateSection,
  useDeleteSection,
  getListSectionsQueryKey,
  useListDepartments,
  useListCompanies,
  type Section,
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

export default function SectionsPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: departments } = useListDepartments({ pageSize: 200 });

  const departmentOptions = (departments?.data ?? []).map((d) => ({
    value: d.id,
    label: d.name,
    labelAr: d.nameAr,
  }));
  const departmentName = (id: string | null | undefined) => {
    const d = (departments?.data ?? []).find((x) => x.id === id);
    return d ? (language === "ar" ? d.nameAr : d.name) : "-";
  };

  const fields: ResourceField[] = [
    { name: "code", label: t("common.code"), required: true, createOnly: true },
    { name: "name", label: t("common.name"), required: true },
    { name: "nameAr", label: t("common.name_ar"), required: true, rtl: true },
    { name: "departmentId", label: t("nav.departments"), type: "select", options: departmentOptions },
    { name: "description", label: t("common.description"), type: "textarea" },
    { name: "status", label: t("common.status"), type: "select", options: STATUS },
  ];

  const columns: ResourceColumn<Section>[] = [
    { header: t("common.code"), render: (r) => r.code },
    { header: t("common.name"), render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: t("nav.departments"), render: (r) => departmentName(r.departmentId) },
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
      title={t("nav.sections")}
      columns={columns}
      fields={fields}
      useList={useListSections}
      useCreate={useCreateSection}
      useUpdate={useUpdateSection}
      useDelete={useDeleteSection}
      getListQueryKey={getListSectionsQueryKey}
      companyId={companyId}
    />
  );
}
