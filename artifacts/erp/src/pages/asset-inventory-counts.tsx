import {
  useListAssetInventoryCounts,
  useCreateAssetInventoryCount,
  useUpdateAssetInventoryCount,
  useDeleteAssetInventoryCount,
  getListAssetInventoryCountsQueryKey,
  useListCompanies,
  useListFixedAssets,
  type AssetInventoryCount,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumLabel } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { useLanguage } from "@/lib/language-provider";

export default function AssetInventoryCountsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: assetIdData } = useListFixedAssets({ pageSize: 200 });
  const assetIdOptions = (assetIdData?.data ?? []).map((x) => ({ value: x.id, label: x.name, labelAr: x.nameAr ?? x.name }));
  const { options: COUNT_RESULTS } = useLookupOptions("asset_count_result", ["found", "missing", "damaged"]);

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Code",
      labelAr: "الرمز",
      // Issued by the central sequence engine on save; shown in the form
      // before saving and never typed in.
      generated: true,
      generatorKey: "assetInventoryCount",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "assetId", label: "Asset", labelAr: "الأصل", type: "select", options: assetIdOptions },
    { name: "branchId", label: "Branch ID", labelAr: "معرّف الفرع" },
    { name: "countDate", label: "Count Date", labelAr: "تاريخ الجرد", type: "date" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: COUNT_RESULTS },
    { name: "location", label: "Location", labelAr: "الموقع" },
    { name: "countedBy", label: "Counted By", labelAr: "تم الجرد بواسطة" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<AssetInventoryCount>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Count Date", headerAr: "تاريخ الجرد", render: (r) => r.countDate ?? "-" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Location", headerAr: "الموقع", render: (r) => r.location ?? "-" },
  ];

  return (
    <ResourceManager
      title="Asset Inventory Counts"
      titleAr="جرد الأصول"
      columns={columns}
      fields={fields}
      useList={useListAssetInventoryCounts}
      useCreate={useCreateAssetInventoryCount}
      useUpdate={useUpdateAssetInventoryCount}
      useDelete={useDeleteAssetInventoryCount}
      getListQueryKey={getListAssetInventoryCountsQueryKey}
      companyId={companyId}
    />
  );
}
