import {
  useListConsultants,
  useCreateConsultant,
  useUpdateConsultant,
  useDeleteConsultant,
  getListConsultantsQueryKey,
  useListEngineeringDisciplines,
  useListCompanies,
  type Consultant,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function ConsultantsPage() {
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
    { name: "contactPerson", label: "Contact Person", labelAr: "جهة الاتصال" },
    { name: "email", label: "Email", labelAr: "البريد الإلكتروني" },
    { name: "phone", label: "Phone", labelAr: "الهاتف" },
    { name: "licenseNumber", label: "License Number", labelAr: "رقم الترخيص" },
    { name: "address", label: "Address", labelAr: "العنوان", type: "textarea" },
  ];

  const columns: ResourceColumn<Consultant>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr : r.name) },
  ];

  return (
    <ResourceManager
      title="Consultants"
      titleAr="الاستشاريون"
      columns={columns}
      fields={fields}
      useList={useListConsultants}
      useCreate={useCreateConsultant}
      useUpdate={useUpdateConsultant}
      useDelete={useDeleteConsultant}
      getListQueryKey={getListConsultantsQueryKey}
      companyId={companyId}
    />
  );
}
