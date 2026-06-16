import {
  useListAssetDepreciations,
  useCreateAssetDepreciation,
  useUpdateAssetDepreciation,
  useDeleteAssetDepreciation,
  getListAssetDepreciationsQueryKey,
  useListCompanies,
  useListFixedAssets,
  type AssetDepreciation,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function AssetDepreciationsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: assetIdData } = useListFixedAssets({ pageSize: 200 });
  const assetIdOptions = (assetIdData?.data ?? []).map((x) => ({ value: x.id, label: x.name, labelAr: x.nameAr ?? x.name }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "assetId", label: "Asset", labelAr: "الأصل", type: "select", required: true, options: assetIdOptions },
    { name: "periodDate", label: "Period Date", labelAr: "تاريخ الفترة", type: "date" },
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money" },
    { name: "method", label: "Method", labelAr: "الطريقة" },
    { name: "accumulatedAfter", label: "Accumulated After", labelAr: "المجمع بعد", type: "money" },
    { name: "bookValueAfter", label: "Book Value After", labelAr: "القيمة الدفترية بعد", type: "money" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<AssetDepreciation>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Period", headerAr: "الفترة", render: (r) => r.periodDate ?? "-" },
    { header: "Amount", headerAr: "المبلغ", render: (r) => r.amount ?? "-" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Asset Depreciation"
      titleAr="إهلاك الأصول"
      columns={columns}
      fields={fields}
      useList={useListAssetDepreciations}
      useCreate={useCreateAssetDepreciation}
      useUpdate={useUpdateAssetDepreciation}
      useDelete={useDeleteAssetDepreciation}
      getListQueryKey={getListAssetDepreciationsQueryKey}
      companyId={companyId}
    />
  );
}
