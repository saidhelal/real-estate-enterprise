import {
  useListLandOwnerships,
  useCreateLandOwnership,
  useUpdateLandOwnership,
  useDeleteLandOwnership,
  getListLandOwnershipsQueryKey,
  useListCompanies,
  useListLandParcels,
  type LandOwnership,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function LandOwnershipsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: parcelIdData } = useListLandParcels({ pageSize: 200 });
  const parcelIdOptions = (parcelIdData?.data ?? []).map((x) => ({ value: x.id, label: x.name, labelAr: x.nameAr ?? x.name }));

  const fields: ResourceField[] = [
    { name: "parcelId", label: "Parcel", labelAr: "القطعة", type: "select", required: true, options: parcelIdOptions },
    { name: "ownerName", label: "Owner Name", labelAr: "اسم المالك", required: true },
    { name: "ownerNameAr", label: "Owner Name (Arabic)", labelAr: "اسم المالك بالعربية", rtl: true },
    { name: "ownershipType", label: "Ownership Type", labelAr: "نوع الملكية", type: "select", options: enumOptions(["freehold", "leasehold", "usufruct", "joint"]) },
    { name: "sharePercentage", label: "Share %", labelAr: "نسبة الحصة", type: "money" },
    { name: "titleDeedNo", label: "Title Deed No.", labelAr: "رقم الصك" },
    { name: "registrationDate", label: "Registration Date", labelAr: "تاريخ التسجيل", type: "date" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<LandOwnership>[] = [
    { header: "Owner", headerAr: "المالك", render: (r) => language === "ar" ? (r.ownerNameAr ?? r.ownerName) : r.ownerName },
    { header: "Type", headerAr: "النوع", render: (r) => <Badge variant="secondary">{enumLabel(r.ownershipType, language)}</Badge> },
    { header: "Share %", headerAr: "الحصة", render: (r) => r.sharePercentage ?? "-" },
    { header: "Title Deed", headerAr: "الصك", render: (r) => r.titleDeedNo ?? "-" },
  ];

  return (
    <ResourceManager
      title="Land Ownership Records"
      titleAr="سجلات الملكية"
      columns={columns}
      fields={fields}
      useList={useListLandOwnerships}
      useCreate={useCreateLandOwnership}
      useUpdate={useUpdateLandOwnership}
      useDelete={useDeleteLandOwnership}
      getListQueryKey={getListLandOwnershipsQueryKey}
      companyId={companyId}
    />
  );
}
