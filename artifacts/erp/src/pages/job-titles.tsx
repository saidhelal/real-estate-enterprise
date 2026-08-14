import {
  useListJobTitles,
  useCreateJobTitle,
  useUpdateJobTitle,
  useDeleteJobTitle,
  getListJobTitlesQueryKey,
  useListDepartments,
  useListCompanies,
  type JobTitle,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";


export default function JobTitlesPage() {
  // Domain owned by the lookup engine. The literal is the fallback used
  // until the registry is seeded, so behaviour is unchanged either way.
  const { options: lk_record_status } = useLookupOptions("record_status", ["active", "inactive"]);
  const STATUS = lk_record_status;
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: departments } = useListDepartments({ pageSize: 200 });

  const departmentOptions = (departments?.data ?? []).map((d) => ({
    value: d.id,
    label: d.name,
    labelAr: d.nameAr,
  }));

  const fields: ResourceField[] = [
    {
      name: "code",
      label: t("common.code"),
      // Issued by the central sequence engine on save; shown in the form
      // before saving and never typed in.
      generated: true,
      generatorKey: "jobTitle",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "name", label: t("common.name"), required: true },
    { name: "nameAr", label: t("common.name_ar"), required: true, rtl: true },
    { name: "departmentId", label: t("nav.departments"), type: "select", options: departmentOptions },
    { name: "grade", label: t("hr.grade") },
    { name: "description", label: t("common.description"), type: "textarea" },
    { name: "status", label: t("common.status"), type: "select", options: STATUS },
  ];

  const columns: ResourceColumn<JobTitle>[] = [
    { header: t("common.code"), render: (r) => r.code },
    { header: t("common.name"), render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: t("hr.grade"), render: (r) => r.grade ?? "-" },
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
      title={t("nav.job_titles")}
      columns={columns}
      fields={fields}
      useList={useListJobTitles}
      useCreate={useCreateJobTitle}
      useUpdate={useUpdateJobTitle}
      useDelete={useDeleteJobTitle}
      getListQueryKey={getListJobTitlesQueryKey}
      companyId={companyId}
    />
  );
}
