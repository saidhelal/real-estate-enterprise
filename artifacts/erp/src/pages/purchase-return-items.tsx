import {
  useListPurchaseReturnItems,
  useCreatePurchaseReturnItem,
  useUpdatePurchaseReturnItem,
  useDeletePurchaseReturnItem,
  getListPurchaseReturnItemsQueryKey,
  useListPurchaseReturns,
  useListCompanies,
  type PurchaseReturnItem,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function PurchaseReturnItemsPage() {
  useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: returnData } = useListPurchaseReturns({ pageSize: 200 });
  const returnOptions = (returnData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));

  const fields: ResourceField[] = [
    { name: "returnId", label: "Purchase Return", labelAr: "مرتجع الشراء", type: "select", options: returnOptions },
    { name: "description", label: "Description", labelAr: "الوصف", required: true },
    { name: "unit", label: "Unit", labelAr: "الوحدة" },
    { name: "quantity", label: "Quantity", labelAr: "الكمية", type: "money" },
    { name: "unitPrice", label: "Unit Price", labelAr: "سعر الوحدة", type: "money" },
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money" },
    { name: "reason", label: "Reason", labelAr: "السبب" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<PurchaseReturnItem>[] = [
    { header: "Description", headerAr: "الوصف", render: (r) => <span className="font-medium">{r.description ?? "-"}</span> },
    { header: "Quantity", headerAr: "الكمية", render: (r) => r.quantity ?? "-" },
  ];

  return (
    <ResourceManager
      title="Purchase Return Items"
      titleAr="بنود مرتجع الشراء"
      columns={columns}
      fields={fields}
      useList={useListPurchaseReturnItems}
      useCreate={useCreatePurchaseReturnItem}
      useUpdate={useUpdatePurchaseReturnItem}
      useDelete={useDeletePurchaseReturnItem}
      getListQueryKey={getListPurchaseReturnItemsQueryKey}
      companyId={companyId}
    />
  );
}
