import {
  useListInventoryTransferItems,
  useCreateInventoryTransferItem,
  useUpdateInventoryTransferItem,
  useDeleteInventoryTransferItem,
  getListInventoryTransferItemsQueryKey,
  useListInventoryTransfers,
  useListInventoryItems,
  useListWarehouseLocations,
  useListCompanies,
  type InventoryTransferItem,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function InventoryTransferItemsPage() {
  useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: transferData } = useListInventoryTransfers({ pageSize: 200 });
  const transferOptions = (transferData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));
  const { data: itemData } = useListInventoryItems({ pageSize: 200 });
  const itemOptions = (itemData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: fromLocationData } = useListWarehouseLocations({ pageSize: 200 });
  const fromLocationOptions = (fromLocationData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const toLocationOptions = (fromLocationData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    { name: "transferId", label: "Transfer", labelAr: "التحويل", type: "select", options: transferOptions },
    { name: "itemId", label: "Item", labelAr: "الصنف", type: "select", options: itemOptions },
    { name: "fromLocationId", label: "From Location", labelAr: "من موقع", type: "select", options: fromLocationOptions },
    { name: "toLocationId", label: "To Location", labelAr: "إلى موقع", type: "select", options: toLocationOptions },
    { name: "quantity", label: "Quantity", labelAr: "الكمية", type: "number" },
    { name: "unitCost", label: "Unit Cost", labelAr: "تكلفة الوحدة", type: "money" },
    { name: "totalCost", label: "Total Cost", labelAr: "التكلفة الإجمالية", type: "money" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<InventoryTransferItem>[] = [
    { header: "Transfer", headerAr: "التحويل", render: (r) => <span className="font-medium">{r.transferId ?? "-"}</span> },
    { header: "Unit Cost", headerAr: "تكلفة الوحدة", render: (r) => r.unitCost ?? "-" },
  ];

  return (
    <ResourceManager
      title="Inventory Transfer Items"
      titleAr="بنود تحويل المخزون"
      columns={columns}
      fields={fields}
      useList={useListInventoryTransferItems}
      useCreate={useCreateInventoryTransferItem}
      useUpdate={useUpdateInventoryTransferItem}
      useDelete={useDeleteInventoryTransferItem}
      getListQueryKey={getListInventoryTransferItemsQueryKey}
      companyId={companyId}
    />
  );
}
