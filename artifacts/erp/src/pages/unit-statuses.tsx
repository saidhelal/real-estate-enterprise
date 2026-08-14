import {
  useListUnitStatuses,
  useCreateUnitStatus,
  useUpdateUnitStatus,
  useDeleteUnitStatus,
  getListUnitStatusesQueryKey,
  useListCompanies,
  type UnitStatus,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function UnitStatusesPage() {
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
      generatorKey: "unitStatus",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "color", label: "Color", labelAr: "اللون" },
  ];

  const columns: ResourceColumn<UnitStatus>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: "Color", headerAr: "اللون", render: (r) => r.color ?? "-" },
  ];

  return (
    <ResourceManager
      title="Unit Statuses"
      titleAr="حالات الوحدات"
      columns={columns}
      fields={fields}
      useList={useListUnitStatuses}
      useCreate={useCreateUnitStatus}
      useUpdate={useUpdateUnitStatus}
      useDelete={useDeleteUnitStatus}
      getListQueryKey={getListUnitStatusesQueryKey}
      companyId={companyId}
    />
  );
}
