import {
  useListStockOpeningBalances,
  useCreateStockOpeningBalance,
  useUpdateStockOpeningBalance,
  useDeleteStockOpeningBalance,
  getListStockOpeningBalancesQueryKey,
  useListInventoryItems,
  useListWarehouses,
  useListWarehouseLocations,
  useListCompanies,
  type StockOpeningBalance,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function StockOpeningBalancesPage() {
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
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      generated: true,
      generatorKey: "stockOpeningBalance",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "itemId", label: "Item", labelAr: "الصنف", type: "select", options: itemOptions },
    { name: "warehouseId", label: "Warehouse", labelAr: "المستودع", type: "select", options: warehouseOptions },
    { name: "locationId", label: "Location", labelAr: "الموقع", type: "select", options: locationOptions },
    { name: "balanceDate", label: "Balance Date", labelAr: "تاريخ الرصيد", type: "date" },
    { name: "quantity", label: "Quantity", labelAr: "الكمية", type: "number" },
    { name: "unitCost", label: "Unit Cost", labelAr: "تكلفة الوحدة", type: "money" },
    { name: "totalValue", label: "Total Value", labelAr: "القيمة الإجمالية", type: "money" },
    { name: "batchNumber", label: "Batch Number", labelAr: "رقم الدفعة" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft", "confirmed"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<StockOpeningBalance>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Unit Cost", headerAr: "تكلفة الوحدة", render: (r) => r.unitCost ?? "-" },
  ];

  return (
    <ResourceManager
      title="Stock Opening Balances"
      titleAr="الأرصدة الافتتاحية للمخزون"
      columns={columns}
      fields={fields}
      useList={useListStockOpeningBalances}
      useCreate={useCreateStockOpeningBalance}
      useUpdate={useUpdateStockOpeningBalance}
      useDelete={useDeleteStockOpeningBalance}
      getListQueryKey={getListStockOpeningBalancesQueryKey}
      companyId={companyId}
    />
  );
}
