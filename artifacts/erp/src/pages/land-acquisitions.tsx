import {
  useListLandAcquisitions,
  useCreateLandAcquisition,
  useUpdateLandAcquisition,
  useDeleteLandAcquisition,
  getListLandAcquisitionsQueryKey,
  useListCompanies,
  useListLandParcels,
  type LandAcquisition,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { useLanguage } from "@/lib/language-provider";

export default function LandAcquisitionsPage() {
  const { language } = useLanguage();
  const { options: ACQUISITION_TYPE } = useLookupOptions("land_acquisition_method", ["purchase", "inheritance", "grant", "exchange"]);
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: parcelIdData } = useListLandParcels({ pageSize: 200 });
  const parcelIdOptions = (parcelIdData?.data ?? []).map((x) => ({ value: x.id, label: x.name, labelAr: x.nameAr ?? x.name }));

  const fields: ResourceField[] = [
    { name: "parcelId", label: "Parcel", labelAr: "القطعة", type: "select", required: true, options: parcelIdOptions },
    { name: "acquisitionType", label: "Acquisition Type", labelAr: "نوع الاستحواذ", type: "select", options: ACQUISITION_TYPE },
    { name: "sellerName", label: "Seller Name", labelAr: "اسم البائع" },
    { name: "acquisitionDate", label: "Acquisition Date", labelAr: "تاريخ الاستحواذ", type: "date" },
    { name: "cost", label: "Cost", labelAr: "التكلفة", type: "money" },
    { name: "paymentStatus", label: "Payment Status", labelAr: "حالة الدفع", type: "select", options: enumOptions(["pending", "partial", "paid"]) },
    { name: "referenceNo", label: "Reference No.", labelAr: "الرقم المرجعي" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<LandAcquisition>[] = [
    { header: "Type", headerAr: "النوع", render: (r) => <Badge variant="secondary">{enumLabel(r.acquisitionType, language)}</Badge> },
    { header: "Seller", headerAr: "البائع", render: (r) => r.sellerName ?? "-" },
    { header: "Cost", headerAr: "التكلفة", render: (r) => r.cost ?? "-" },
    { header: "Payment", headerAr: "الدفع", render: (r) => <Badge variant="secondary">{enumLabel(r.paymentStatus, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Land Acquisition Records"
      titleAr="سجلات الاستحواذ"
      columns={columns}
      fields={fields}
      useList={useListLandAcquisitions}
      useCreate={useCreateLandAcquisition}
      useUpdate={useUpdateLandAcquisition}
      useDelete={useDeleteLandAcquisition}
      getListQueryKey={getListLandAcquisitionsQueryKey}
      companyId={companyId}
    />
  );
}
