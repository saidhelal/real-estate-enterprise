import {
  useListStockCountItems,
  useCreateStockCountItem,
  useUpdateStockCountItem,
  useDeleteStockCountItem,
  getListStockCountItemsQueryKey,
  useListStockCounts,
  useListInventoryItems,
  useListWarehouseLocations,
  useListCompanies,
  type StockCountItem,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function StockCountItemsPage() {
  useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: countData } = useListStockCounts({ pageSize: 200 });
  const countOptions = (countData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));
  const { data: itemData } = useListInventoryItems({ pageSize: 200 });
  const itemOptions = (itemData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: locationData } = useListWarehouseLocations({ pageSize: 200 });
  const locationOptions = (locationData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    { name: "countId", label: "Stock Count", labelAr: "الجرد", type: "select", options: countOptions },
    { name: "itemId", label: "Item", labelAr: "الصنف", type: "select", options: itemOptions },
    { name: "locationId", label: "Location", labelAr: "الموقع", type: "select", options: locationOptions },
    { name: "systemQuantity", label: "System Quantity", labelAr: "الكمية بالنظام", type: "number" },
    { name: "countedQuantity", label: "Counted Quantity", labelAr: "الكمية المجرودة", type: "number" },
    { name: "varianceQuantity", label: "Variance", labelAr: "الانحراف", type: "number" },
    { name: "unitCost", label: "Unit Cost", labelAr: "تكلفة الوحدة", type: "money" },
    { name: "varianceValue", label: "Variance Value", labelAr: "قيمة الانحراف", type: "money" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<StockCountItem>[] = [
    { header: "Stock Count", headerAr: "الجرد", render: (r) => <span className="font-medium">{r.countId ?? "-"}</span> },
    { header: "Unit Cost", headerAr: "تكلفة الوحدة", render: (r) => r.unitCost ?? "-" },
  ];

  return (
    <ResourceManager
      title="Stock Count Items"
      titleAr="بنود الجرد"
      columns={columns}
      fields={fields}
      useList={useListStockCountItems}
      useCreate={useCreateStockCountItem}
      useUpdate={useUpdateStockCountItem}
      useDelete={useDeleteStockCountItem}
      getListQueryKey={getListStockCountItemsQueryKey}
      companyId={companyId}
    />
  );
}
