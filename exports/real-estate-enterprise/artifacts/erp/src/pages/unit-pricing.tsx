import {
  useListUnitPricings,
  useCreateUnitPricing,
  useUpdateUnitPricing,
  useDeleteUnitPricing,
  getListUnitPricingsQueryKey,
  useListUnitPriceLists,
  useListUnits,
  useListCompanies,
  type UnitPricing,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function UnitPricingPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const { data: priceLists } = useListUnitPriceLists({ pageSize: 200 });
  const { data: units } = useListUnits({ pageSize: 200 });
  const companyId = companies?.[0]?.id;
  const priceListOptions = (priceLists?.data ?? []).map((p) => ({
    value: p.id,
    label: language === "ar" ? p.nameAr : p.name,
  }));
  const unitOptions = (units?.data ?? []).map((u) => ({ value: u.id, label: u.name }));

  const fields: ResourceField[] = [
    { name: "priceListId", label: "Price List", labelAr: "قائمة الأسعار", type: "select", required: true, options: priceListOptions },
    { name: "unitId", label: "Unit", labelAr: "الوحدة", type: "select", required: true, options: unitOptions },
    { name: "price", label: "Price", labelAr: "السعر", type: "money" },
    { name: "effectiveDate", label: "Effective Date", labelAr: "تاريخ السريان", type: "date" },
  ];

  const columns: ResourceColumn<UnitPricing>[] = [
    { header: "Price", headerAr: "السعر", render: (r) => <span className="font-medium">{r.price}</span> },
    { header: "Effective Date", headerAr: "تاريخ السريان", render: (r) => r.effectiveDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="Unit Pricing"
      titleAr="تسعير الوحدات"
      columns={columns}
      fields={fields}
      useList={useListUnitPricings}
      useCreate={useCreateUnitPricing}
      useUpdate={useUpdateUnitPricing}
      useDelete={useDeleteUnitPricing}
      getListQueryKey={getListUnitPricingsQueryKey}
      companyId={companyId}
    />
  );
}
