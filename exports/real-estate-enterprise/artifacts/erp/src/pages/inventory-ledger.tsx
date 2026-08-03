import {
  useListInventoryLedgers,
  useCreateInventoryLedger,
  useUpdateInventoryLedger,
  useDeleteInventoryLedger,
  getListInventoryLedgersQueryKey,
  useListInventoryItems,
  useListWarehouses,
  useListWarehouseLocations,
  useListCompanies,
  type InventoryLedger,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function InventoryLedgersPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: itemData } = useListInventoryItems({ pageSize: 200 });
  const itemOptions = (itemData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: warehouseData } = useListWarehouses({ pageSize: 200 });
  const warehouseOptions = (warehouseData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: locationData } = useListWarehouseLocations({ pageSize: 200 });
  const locationOptions = (locationData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    { name: "itemId", label: "Item", labelAr: "الصنف", type: "select", options: itemOptions },
    { name: "warehouseId", label: "Warehouse", labelAr: "المستودع", type: "select", options: warehouseOptions },
    { name: "locationId", label: "Location", labelAr: "الموقع", type: "select", options: locationOptions },
    { name: "transactionDate", label: "Transaction Date", labelAr: "تاريخ الحركة", type: "date" },
    { name: "transactionType", label: "Transaction Type", labelAr: "نوع الحركة", type: "select", options: enumOptions(["receipt", "issue", "transfer_in", "transfer_out", "adjustment", "opening", "count"]) },
    { name: "referenceType", label: "Reference Type", labelAr: "نوع المرجع" },
    { name: "referenceNumber", label: "Reference Number", labelAr: "رقم المرجع" },
    { name: "quantityIn", label: "Quantity In", labelAr: "الكمية الواردة", type: "number" },
    { name: "quantityOut", label: "Quantity Out", labelAr: "الكمية الصادرة", type: "number" },
    { name: "balanceQuantity", label: "Balance Quantity", labelAr: "الكمية المتبقية", type: "number" },
    { name: "unitCost", label: "Unit Cost", labelAr: "تكلفة الوحدة", type: "money" },
    { name: "balanceValue", label: "Balance Value", labelAr: "قيمة الرصيد", type: "money" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<InventoryLedger>[] = [
    { header: "Item", headerAr: "الصنف", render: (r) => <span className="font-medium">{r.itemId ?? "-"}</span> },
    { header: "Transaction Type", headerAr: "نوع الحركة", render: (r) => <Badge variant="secondary">{enumLabel(r.transactionType, language)}</Badge> },
    { header: "Unit Cost", headerAr: "تكلفة الوحدة", render: (r) => r.unitCost ?? "-" },
  ];

  return (
    <ResourceManager
      title="Inventory Ledger"
      titleAr="دفتر حركة المخزون"
      columns={columns}
      fields={fields}
      useList={useListInventoryLedgers}
      useCreate={useCreateInventoryLedger}
      useUpdate={useUpdateInventoryLedger}
      useDelete={useDeleteInventoryLedger}
      getListQueryKey={getListInventoryLedgersQueryKey}
      companyId={companyId}
    />
  );
}
