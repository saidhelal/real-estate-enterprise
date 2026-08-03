import {
  useListAssetCategories,
  useCreateAssetCategory,
  useUpdateAssetCategory,
  useDeleteAssetCategory,
  getListAssetCategoriesQueryKey,
  useListCompanies,
  type AssetCategory,
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

export default function AssetCategoriesPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { options: DEPRECIATION_METHODS } = useLookupOptions("asset_depreciation_method", ["straight_line", "declining_balance"]);

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "usefulLifeYears", label: "Useful Life (Years)", labelAr: "العمر الإنتاجي (سنوات)", type: "money" },
    { name: "depreciationMethod", label: "Depreciation Method", labelAr: "طريقة الإهلاك", type: "select", options: DEPRECIATION_METHODS },
    { name: "depreciationRate", label: "Depreciation Rate (%)", labelAr: "معدل الإهلاك (%)", type: "money" },
    { name: "assetAccountId", label: "Asset Account ID", labelAr: "معرّف حساب الأصل" },
    { name: "depreciationAccountId", label: "Depreciation Account ID", labelAr: "معرّف حساب مجمع الإهلاك" },
    { name: "expenseAccountId", label: "Expense Account ID", labelAr: "معرّف حساب مصروف الإهلاك" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<AssetCategory>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => language === "ar" ? (r.nameAr ?? r.name) : r.name },
    { header: "Method", headerAr: "الطريقة", render: (r) => <Badge variant="secondary">{enumLabel(r.depreciationMethod, language)}</Badge> },
    { header: "Rate (%)", headerAr: "المعدل (%)", render: (r) => r.depreciationRate ?? "-" },
  ];

  return (
    <ResourceManager
      title="Asset Categories"
      titleAr="فئات الأصول"
      columns={columns}
      fields={fields}
      useList={useListAssetCategories}
      useCreate={useCreateAssetCategory}
      useUpdate={useUpdateAssetCategory}
      useDelete={useDeleteAssetCategory}
      getListQueryKey={getListAssetCategoriesQueryKey}
      companyId={companyId}
    />
  );
}
