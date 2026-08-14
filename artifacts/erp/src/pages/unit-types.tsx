import {
  useListUnitTypes,
  useCreateUnitType,
  useUpdateUnitType,
  useDeleteUnitType,
  getListUnitTypesQueryKey,
  useListCompanies,
  type UnitType,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function UnitTypesPage() {
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
      generatorKey: "unitType",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
  ];

  const columns: ResourceColumn<UnitType>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: "Description", headerAr: "الوصف", render: (r) => r.description ?? "-" },
  ];

  return (
    <ResourceManager
      title="Unit Types"
      titleAr="أنواع الوحدات"
      columns={columns}
      fields={fields}
      useList={useListUnitTypes}
      useCreate={useCreateUnitType}
      useUpdate={useUpdateUnitType}
      useDelete={useDeleteUnitType}
      getListQueryKey={getListUnitTypesQueryKey}
      companyId={companyId}
    />
  );
}
