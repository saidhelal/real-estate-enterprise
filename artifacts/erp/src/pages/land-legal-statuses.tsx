import {
  useListLandLegalStatuses,
  useCreateLandLegalStatus,
  useUpdateLandLegalStatus,
  useDeleteLandLegalStatus,
  getListLandLegalStatusesQueryKey,
  useListCompanies,
  useListLandParcels,
  type LandLegalStatus,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumLabel, enumOptions } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function LandLegalStatusesPage() {
  const { language } = useLanguage();
  const STATUS = enumOptions(["clear", "disputed", "mortgaged", "restricted", "under_review"]);
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: parcelIdData } = useListLandParcels({ pageSize: 200 });
  const parcelIdOptions = (parcelIdData?.data ?? []).map((x) => ({ value: x.id, label: x.name, labelAr: x.nameAr ?? x.name }));

  const fields: ResourceField[] = [
    { name: "parcelId", label: "Parcel", labelAr: "القطعة", type: "select", required: true, options: parcelIdOptions },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: STATUS },
    { name: "authority", label: "Authority", labelAr: "الجهة" },
    { name: "referenceNo", label: "Reference No.", labelAr: "الرقم المرجعي" },
    { name: "effectiveDate", label: "Effective Date", labelAr: "تاريخ السريان", type: "date" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<LandLegalStatus>[] = [
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Authority", headerAr: "الجهة", render: (r) => r.authority ?? "-" },
    { header: "Reference", headerAr: "المرجع", render: (r) => r.referenceNo ?? "-" },
    { header: "Effective Date", headerAr: "تاريخ السريان", render: (r) => r.effectiveDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="Land Legal Status"
      titleAr="الحالة القانونية للأراضي"
      columns={columns}
      fields={fields}
      useList={useListLandLegalStatuses}
      useCreate={useCreateLandLegalStatus}
      useUpdate={useUpdateLandLegalStatus}
      useDelete={useDeleteLandLegalStatus}
      getListQueryKey={getListLandLegalStatusesQueryKey}
      companyId={companyId}
    />
  );
}
