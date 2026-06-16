import {
  useListFixedAssets,
  useCreateFixedAsset,
  useUpdateFixedAsset,
  useDeleteFixedAsset,
  getListFixedAssetsQueryKey,
  useListCompanies,
  useListAssetCategories,
  type FixedAsset,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function FixedAssetsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: categoryIdData } = useListAssetCategories({ pageSize: 200 });
  const categoryIdOptions = (categoryIdData?.data ?? []).map((x) => ({ value: x.id, label: x.name, labelAr: x.nameAr ?? x.name }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "categoryId", label: "Category", labelAr: "الفئة", type: "select", required: true, options: categoryIdOptions },
    { name: "branchId", label: "Branch ID", labelAr: "معرّف الفرع" },
    { name: "costCenterId", label: "Cost Center ID", labelAr: "معرّف مركز التكلفة" },
    { name: "acquisitionDate", label: "Acquisition Date", labelAr: "تاريخ الاقتناء", type: "date" },
    { name: "acquisitionCost", label: "Acquisition Cost", labelAr: "تكلفة الاقتناء", type: "money" },
    { name: "salvageValue", label: "Salvage Value", labelAr: "القيمة المتبقية", type: "money" },
    { name: "usefulLifeYears", label: "Useful Life (Years)", labelAr: "العمر الإنتاجي (سنوات)", type: "money" },
    { name: "depreciationMethod", label: "Depreciation Method", labelAr: "طريقة الإهلاك", type: "select", options: enumOptions(["straight_line", "declining_balance"]) },
    { name: "accumulatedDepreciation", label: "Accumulated Depreciation", labelAr: "مجمع الإهلاك", type: "money" },
    { name: "bookValue", label: "Book Value", labelAr: "القيمة الدفترية", type: "money" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["active", "under_maintenance", "disposed", "written_off"]) },
    { name: "location", label: "Location", labelAr: "الموقع" },
    { name: "locationAr", label: "Location (Arabic)", labelAr: "الموقع بالعربية", rtl: true },
    { name: "serialNo", label: "Serial No.", labelAr: "الرقم التسلسلي" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<FixedAsset>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => language === "ar" ? (r.nameAr ?? r.name) : r.name },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Cost", headerAr: "التكلفة", render: (r) => r.acquisitionCost ?? "-" },
    { header: "Book Value", headerAr: "القيمة الدفترية", render: (r) => r.bookValue ?? "-" },
  ];

  return (
    <ResourceManager
      title="Fixed Assets"
      titleAr="الأصول الثابتة"
      columns={columns}
      fields={fields}
      useList={useListFixedAssets}
      useCreate={useCreateFixedAsset}
      useUpdate={useUpdateFixedAsset}
      useDelete={useDeleteFixedAsset}
      getListQueryKey={getListFixedAssetsQueryKey}
      companyId={companyId}
    />
  );
}
