import {
  useListLandUtilizations,
  useCreateLandUtilization,
  useUpdateLandUtilization,
  useDeleteLandUtilization,
  getListLandUtilizationsQueryKey,
  useListCompanies,
  useListLandParcels,
  type LandUtilization,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function LandUtilizationsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: parcelIdData } = useListLandParcels({ pageSize: 200 });
  const parcelIdOptions = (parcelIdData?.data ?? []).map((x) => ({ value: x.id, label: x.name, labelAr: x.nameAr ?? x.name }));

  const fields: ResourceField[] = [
    { name: "parcelId", label: "Parcel", labelAr: "القطعة", type: "select", required: true, options: parcelIdOptions },
    { name: "utilizationType", label: "Utilization Type", labelAr: "نوع الاستغلال", type: "select", options: enumOptions(["development", "sale", "lease", "reserve"]) },
    { name: "allocatedArea", label: "Allocated Area", labelAr: "المساحة المخصصة", type: "money" },
    { name: "projectId", label: "Project ID", labelAr: "معرّف المشروع" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["planned", "active", "completed", "cancelled"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<LandUtilization>[] = [
    { header: "Type", headerAr: "النوع", render: (r) => <Badge variant="secondary">{enumLabel(r.utilizationType, language)}</Badge> },
    { header: "Allocated Area", headerAr: "المساحة المخصصة", render: (r) => r.allocatedArea ?? "-" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Land Utilization"
      titleAr="استغلال الأراضي"
      columns={columns}
      fields={fields}
      useList={useListLandUtilizations}
      useCreate={useCreateLandUtilization}
      useUpdate={useUpdateLandUtilization}
      useDelete={useDeleteLandUtilization}
      getListQueryKey={getListLandUtilizationsQueryKey}
      companyId={companyId}
    />
  );
}
