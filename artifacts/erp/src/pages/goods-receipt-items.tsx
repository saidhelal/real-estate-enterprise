import {
  useListGoodsReceiptItems,
  useCreateGoodsReceiptItem,
  useUpdateGoodsReceiptItem,
  useDeleteGoodsReceiptItem,
  getListGoodsReceiptItemsQueryKey,
  useListGoodsReceipts,
  useListInventoryItems,
  useListWarehouseLocations,
  useListCompanies,
  type GoodsReceiptItem,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function GoodsReceiptItemsPage() {
  useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: receiptData } = useListGoodsReceipts({ pageSize: 200 });
  const receiptOptions = (receiptData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));
  const { data: itemData } = useListInventoryItems({ pageSize: 200 });
  const itemOptions = (itemData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: locationData } = useListWarehouseLocations({ pageSize: 200 });
  const locationOptions = (locationData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    { name: "receiptId", label: "Goods Receipt", labelAr: "إذن الاستلام", type: "select", options: receiptOptions },
    { name: "itemId", label: "Item", labelAr: "الصنف", type: "select", options: itemOptions },
    { name: "locationId", label: "Location", labelAr: "الموقع", type: "select", options: locationOptions },
    { name: "quantity", label: "Quantity", labelAr: "الكمية", type: "number" },
    { name: "unitCost", label: "Unit Cost", labelAr: "تكلفة الوحدة", type: "money" },
    { name: "totalCost", label: "Total Cost", labelAr: "التكلفة الإجمالية", type: "money" },
    { name: "batchNumber", label: "Batch Number", labelAr: "رقم الدفعة" },
    { name: "expiryDate", label: "Expiry Date", labelAr: "تاريخ الانتهاء", type: "date" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<GoodsReceiptItem>[] = [
    { header: "Goods Receipt", headerAr: "إذن الاستلام", render: (r) => <span className="font-medium">{r.receiptId ?? "-"}</span> },
    { header: "Unit Cost", headerAr: "تكلفة الوحدة", render: (r) => r.unitCost ?? "-" },
  ];

  return (
    <ResourceManager
      title="Goods Receipt Items"
      titleAr="بنود إذن الاستلام"
      columns={columns}
      fields={fields}
      useList={useListGoodsReceiptItems}
      useCreate={useCreateGoodsReceiptItem}
      useUpdate={useUpdateGoodsReceiptItem}
      useDelete={useDeleteGoodsReceiptItem}
      getListQueryKey={getListGoodsReceiptItemsQueryKey}
      companyId={companyId}
    />
  );
}
