import {
  useListTechnicalSpecifications,
  useCreateTechnicalSpecification,
  useUpdateTechnicalSpecification,
  useDeleteTechnicalSpecification,
  getListTechnicalSpecificationsQueryKey,
  useListEngineeringDisciplines,
  useListCompanies,
  type TechnicalSpecification,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function TechnicalSpecificationsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: disciplineData } = useListEngineeringDisciplines({ pageSize: 200 });
  const disciplineOptions = (disciplineData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "disciplineId", label: "Discipline", labelAr: "التخصص", type: "select", options: disciplineOptions },
    { name: "section", label: "Section", labelAr: "القسم" },
    { name: "content", label: "Content", labelAr: "المحتوى", type: "textarea" },
    { name: "version", label: "Version", labelAr: "الإصدار" },
  ];

  const columns: ResourceColumn<TechnicalSpecification>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr : r.name) },
  ];

  return (
    <ResourceManager
      title="Technical Specifications"
      titleAr="المواصفات الفنية"
      columns={columns}
      fields={fields}
      useList={useListTechnicalSpecifications}
      useCreate={useCreateTechnicalSpecification}
      useUpdate={useUpdateTechnicalSpecification}
      useDelete={useDeleteTechnicalSpecification}
      getListQueryKey={getListTechnicalSpecificationsQueryKey}
      companyId={companyId}
    />
  );
}
