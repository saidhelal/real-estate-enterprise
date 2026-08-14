import {
  useListLeadSources,
  useCreateLeadSource,
  useUpdateLeadSource,
  useDeleteLeadSource,
  getListLeadSourcesQueryKey,
  useListCompanies,
  type LeadSource,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function LeadSourcesPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Code",
      labelAr: "الرمز",
      // Issued by the central sequence engine on save; shown in the form
      // before saving and never typed in.
      generated: true,
      generatorKey: "leadSource",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
  ];

  const columns: ResourceColumn<LeadSource>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr : r.name) },
  ];

  return (
    <ResourceManager
      title="Lead Sources"
      titleAr="مصادر العملاء المحتملين"
      columns={columns}
      fields={fields}
      useList={useListLeadSources}
      useCreate={useCreateLeadSource}
      useUpdate={useUpdateLeadSource}
      useDelete={useDeleteLeadSource}
      getListQueryKey={getListLeadSourcesQueryKey}
      companyId={companyId}
    />
  );
}
