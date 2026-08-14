import {
  useListInventoryItems,
  useCreateInventoryItem,
  useUpdateInventoryItem,
  useDeleteInventoryItem,
  getListInventoryItemsQueryKey,
  useListItemCategorys,
  useListItemGroups,
  useListUnitOfMeasures,
  useListCompanies,
  type InventoryItem,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { Badge } from "@/components/ui/badge";

export default function InventoryItemsPage() {
  // Domain owned by the lookup engine. The literal is the fallback used
  // until the registry is seeded, so behaviour is unchanged either way.
  const { options: lk_record_status } = useLookupOptions("record_status", ["active", "inactive"]);
  const { language } = useLanguage();
  const ITEM_TYPE = enumOptions(["stock", "non_stock", "service", "asset"]);
  const { options: VALUATION_METHOD } = useLookupOptions("costing_method", ["fifo", "lifo", "average", "standard"]);
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: categoryData } = useListItemCategorys({ pageSize: 200 });
  const categoryOptions = (categoryData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: groupData } = useListItemGroups({ pageSize: 200 });
  const groupOptions = (groupData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: uomData } = useListUnitOfMeasures({ pageSize: 200 });
  const uomOptions = (uomData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "categoryId", label: "Category", labelAr: "الفئة", type: "select", options: categoryOptions },
    { name: "groupId", label: "Group", labelAr: "المجموعة", type: "select", options: groupOptions },
    { name: "uomId", label: "Unit", labelAr: "الوحدة", type: "select", options: uomOptions },
    { name: "itemType", label: "Item Type", labelAr: "نوع الصنف", type: "select", options: ITEM_TYPE },
    { name: "barcode", label: "Barcode", labelAr: "الباركود" },
    { name: "costPrice", label: "Cost Price", labelAr: "سعر التكلفة", type: "money" },
    { name: "sellingPrice", label: "Selling Price", labelAr: "سعر البيع", type: "money" },
    { name: "valuationMethod", label: "Valuation Method", labelAr: "طريقة التقييم", type: "select", options: VALUATION_METHOD },
    { name: "reorderPoint", label: "Reorder Point", labelAr: "نقطة إعادة الطلب", type: "number" },
    { name: "minStock", label: "Min Stock", labelAr: "الحد الأدنى للمخزون", type: "number" },
    { name: "maxStock", label: "Max Stock", labelAr: "الحد الأقصى للمخزون", type: "number" },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: lk_record_status },
  ];

  const columns: ResourceColumn<InventoryItem>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: "Item Type", headerAr: "نوع الصنف", render: (r) => <Badge variant="secondary">{enumLabel(r.itemType, language)}</Badge> },
    { header: "Valuation Method", headerAr: "طريقة التقييم", render: (r) => <Badge variant="secondary">{enumLabel(r.valuationMethod, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Cost Price", headerAr: "سعر التكلفة", render: (r) => r.costPrice ?? "-" },
  ];

  return (
    <ResourceManager
      title="Inventory Items"
      titleAr="أصناف المخزون"
      columns={columns}
      fields={fields}
      useList={useListInventoryItems}
      useCreate={useCreateInventoryItem}
      useUpdate={useUpdateInventoryItem}
      useDelete={useDeleteInventoryItem}
      getListQueryKey={getListInventoryItemsQueryKey}
      companyId={companyId}
    />
  );
}
