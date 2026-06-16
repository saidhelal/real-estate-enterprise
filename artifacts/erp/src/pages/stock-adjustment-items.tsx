import {
  useListStockAdjustmentItems,
  useCreateStockAdjustmentItem,
  useUpdateStockAdjustmentItem,
  useDeleteStockAdjustmentItem,
  getListStockAdjustmentItemsQueryKey,
  useListStockAdjustments,
  useListInventoryItems,
  useListWarehouseLocations,
  useListCompanies,
  type StockAdjustmentItem,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function StockAdjustmentItemsPage() {
  useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: adjustmentData } = useListStockAdjustments({ pageSize: 200 });
  const adjustmentOptions = (adjustmentData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));
  const { data: itemData } = useListInventoryItems({ pageSize: 200 });
  const itemOptions = (itemData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: locationData } = useListWarehouseLocations({ pageSize: 200 });
  const locationOptions = (locationData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    { name: "adjustmentId", label: "Adjustment", labelAr: "التسوية", type: "select", options: adjustmentOptions },
    { name: "itemId", label: "Item", labelAr: "الصنف", type: "select", options: itemOptions },
    { name: "locationId", label: "Location", labelAr: "الموقع", type: "select", options: locationOptions },
    { name: "systemQuantity", label: "System Quantity", labelAr: "الكمية بالنظام", type: "number" },
    { name: "actualQuantity", label: "Actual Quantity", labelAr: "الكمية الفعلية", type: "number" },
    { name: "differenceQuantity", label: "Difference", labelAr: "الفرق", type: "number" },
    { name: "unitCost", label: "Unit Cost", labelAr: "تكلفة الوحدة", type: "money" },
    { name: "totalCost", label: "Total Cost", labelAr: "التكلفة الإجمالية", type: "money" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<StockAdjustmentItem>[] = [
    { header: "Adjustment", headerAr: "التسوية", render: (r) => <span className="font-medium">{r.adjustmentId ?? "-"}</span> },
    { header: "Unit Cost", headerAr: "تكلفة الوحدة", render: (r) => r.unitCost ?? "-" },
  ];

  return (
    <ResourceManager
      title="Stock Adjustment Items"
      titleAr="بنود تسوية المخزون"
      columns={columns}
      fields={fields}
      useList={useListStockAdjustmentItems}
      useCreate={useCreateStockAdjustmentItem}
      useUpdate={useUpdateStockAdjustmentItem}
      useDelete={useDeleteStockAdjustmentItem}
      getListQueryKey={getListStockAdjustmentItemsQueryKey}
      companyId={companyId}
    />
  );
}
