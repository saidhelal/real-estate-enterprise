import {
  useListAssetDisposals,
  useCreateAssetDisposal,
  useUpdateAssetDisposal,
  useDeleteAssetDisposal,
  getListAssetDisposalsQueryKey,
  useListCompanies,
  useListFixedAssets,
  type AssetDisposal,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function AssetDisposalsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: assetIdData } = useListFixedAssets({ pageSize: 200 });
  const assetIdOptions = (assetIdData?.data ?? []).map((x) => ({ value: x.id, label: x.name, labelAr: x.nameAr ?? x.name }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "assetId", label: "Asset", labelAr: "الأصل", type: "select", required: true, options: assetIdOptions },
    { name: "disposalDate", label: "Disposal Date", labelAr: "تاريخ الاستبعاد", type: "date" },
    { name: "disposalType", label: "Disposal Type", labelAr: "نوع الاستبعاد", type: "select", options: enumOptions(["sale", "scrap", "donation", "write_off"]) },
    { name: "proceeds", label: "Proceeds", labelAr: "العائدات", type: "money" },
    { name: "bookValueAtDisposal", label: "Book Value at Disposal", labelAr: "القيمة الدفترية عند الاستبعاد", type: "money" },
    { name: "gainLoss", label: "Gain / Loss", labelAr: "الربح / الخسارة", type: "money" },
    { name: "buyerName", label: "Buyer Name", labelAr: "اسم المشتري" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["pending", "completed", "cancelled"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<AssetDisposal>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Type", headerAr: "النوع", render: (r) => <Badge variant="secondary">{enumLabel(r.disposalType, language)}</Badge> },
    { header: "Proceeds", headerAr: "العائدات", render: (r) => r.proceeds ?? "-" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Asset Disposals"
      titleAr="استبعاد الأصول"
      columns={columns}
      fields={fields}
      useList={useListAssetDisposals}
      useCreate={useCreateAssetDisposal}
      useUpdate={useUpdateAssetDisposal}
      useDelete={useDeleteAssetDisposal}
      getListQueryKey={getListAssetDisposalsQueryKey}
      companyId={companyId}
    />
  );
}
