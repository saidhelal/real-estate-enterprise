import {
  useListLandParcels,
  useCreateLandParcel,
  useUpdateLandParcel,
  useDeleteLandParcel,
  getListLandParcelsQueryKey,
  useListCompanies,
  type LandParcel,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumLabel, enumOptions } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function LandParcelsPage() {
  const { language } = useLanguage();
  const STATUS = enumOptions(["available", "acquired", "under_development", "developed", "sold", "on_hold"]);
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: STATUS },
    { name: "area", label: "Area", labelAr: "المساحة", type: "money" },
    { name: "areaUnit", label: "Area Unit", labelAr: "وحدة المساحة" },
    { name: "marketValue", label: "Market Value", labelAr: "القيمة السوقية", type: "money" },
    { name: "zoning", label: "Zoning", labelAr: "التصنيف العمراني" },
    { name: "classification", label: "Classification", labelAr: "التصنيف" },
    { name: "location", label: "Location", labelAr: "الموقع" },
    { name: "locationAr", label: "Location (Arabic)", labelAr: "الموقع بالعربية", rtl: true },
    { name: "projectId", label: "Project ID", labelAr: "معرّف المشروع" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<LandParcel>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => language === "ar" ? (r.nameAr ?? r.name) : r.name },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Area", headerAr: "المساحة", render: (r) => r.area ?? "-" },
    { header: "Market Value", headerAr: "القيمة السوقية", render: (r) => r.marketValue ?? "-" },
  ];

  return (
    <ResourceManager
      title="Land Parcels"
      titleAr="قطع الأراضي"
      columns={columns}
      fields={fields}
      useList={useListLandParcels}
      useCreate={useCreateLandParcel}
      useUpdate={useUpdateLandParcel}
      useDelete={useDeleteLandParcel}
      getListQueryKey={getListLandParcelsQueryKey}
      companyId={companyId}
    />
  );
}
