import {
  useListFloors,
  useCreateFloor,
  useUpdateFloor,
  useDeleteFloor,
  getListFloorsQueryKey,
  useListBuildings,
  useListCompanies,
  type Floor,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function FloorsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const { data: buildings } = useListBuildings({ pageSize: 200 });
  const companyId = companies?.[0]?.id;
  const buildingOptions = (buildings?.data ?? []).map((b) => ({ value: b.id, label: b.name }));

  const fields: ResourceField[] = [
    { name: "buildingId", label: "Building", labelAr: "المبنى", type: "select", required: true, options: buildingOptions },
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "floorNumber", label: "Floor Number", labelAr: "رقم الطابق", type: "number" },
  ];

  const columns: ResourceColumn<Floor>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: "Floor Number", headerAr: "رقم الطابق", render: (r) => r.floorNumber ?? "-" },
  ];

  return (
    <ResourceManager
      title="Floors"
      titleAr="الطوابق"
      columns={columns}
      fields={fields}
      useList={useListFloors}
      useCreate={useCreateFloor}
      useUpdate={useUpdateFloor}
      useDelete={useDeleteFloor}
      getListQueryKey={getListFloorsQueryKey}
      companyId={companyId}
    />
  );
}
