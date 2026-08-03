import {
  useListAssetTransfers,
  useCreateAssetTransfer,
  useUpdateAssetTransfer,
  useDeleteAssetTransfer,
  getListAssetTransfersQueryKey,
  useListCompanies,
  useListFixedAssets,
  type AssetTransfer,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function AssetTransfersPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: assetIdData } = useListFixedAssets({ pageSize: 200 });
  const assetIdOptions = (assetIdData?.data ?? []).map((x) => ({ value: x.id, label: x.name, labelAr: x.nameAr ?? x.name }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "assetId", label: "Asset", labelAr: "الأصل", type: "select", required: true, options: assetIdOptions },
    { name: "fromBranchId", label: "From Branch ID", labelAr: "من الفرع" },
    { name: "toBranchId", label: "To Branch ID", labelAr: "إلى الفرع" },
    { name: "fromCostCenterId", label: "From Cost Center ID", labelAr: "من مركز التكلفة" },
    { name: "toCostCenterId", label: "To Cost Center ID", labelAr: "إلى مركز التكلفة" },
    { name: "transferDate", label: "Transfer Date", labelAr: "تاريخ التحويل", type: "date" },
    { name: "reason", label: "Reason", labelAr: "السبب" },
    { name: "reasonAr", label: "Reason (Arabic)", labelAr: "السبب بالعربية", rtl: true },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["pending", "completed", "cancelled"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<AssetTransfer>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Transfer Date", headerAr: "تاريخ التحويل", render: (r) => r.transferDate ?? "-" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Asset Transfers"
      titleAr="تحويلات الأصول"
      columns={columns}
      fields={fields}
      useList={useListAssetTransfers}
      useCreate={useCreateAssetTransfer}
      useUpdate={useUpdateAssetTransfer}
      useDelete={useDeleteAssetTransfer}
      getListQueryKey={getListAssetTransfersQueryKey}
      companyId={companyId}
    />
  );
}
