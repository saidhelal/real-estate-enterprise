import {
  useListPurchaseOrderItems,
  useCreatePurchaseOrderItem,
  useUpdatePurchaseOrderItem,
  useDeletePurchaseOrderItem,
  getListPurchaseOrderItemsQueryKey,
  useListPurchaseOrders,
  useListCompanies,
  type PurchaseOrderItem,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function PurchaseOrderItemsPage() {
  useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: poData } = useListPurchaseOrders({ pageSize: 200 });
  const poOptions = (poData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));

  const fields: ResourceField[] = [
    { name: "poId", label: "Purchase Order", labelAr: "أمر الشراء", type: "select", options: poOptions },
    { name: "description", label: "Description", labelAr: "الوصف", required: true },
    { name: "descriptionAr", label: "Description (Arabic)", labelAr: "الوصف بالعربية", rtl: true },
    { name: "unit", label: "Unit", labelAr: "الوحدة" },
    { name: "quantity", label: "Quantity", labelAr: "الكمية", type: "money" },
    { name: "receivedQuantity", label: "Received Quantity", labelAr: "الكمية المستلمة", type: "money" },
    { name: "unitPrice", label: "Unit Price", labelAr: "سعر الوحدة", type: "money" },
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<PurchaseOrderItem>[] = [
    { header: "Description", headerAr: "الوصف", render: (r) => <span className="font-medium">{r.description ?? "-"}</span> },
    { header: "Quantity", headerAr: "الكمية", render: (r) => r.quantity ?? "-" },
  ];

  return (
    <ResourceManager
      title="Purchase Order Items"
      titleAr="بنود أمر الشراء"
      columns={columns}
      fields={fields}
      useList={useListPurchaseOrderItems}
      useCreate={useCreatePurchaseOrderItem}
      useUpdate={useUpdatePurchaseOrderItem}
      useDelete={useDeletePurchaseOrderItem}
      getListQueryKey={getListPurchaseOrderItemsQueryKey}
      companyId={companyId}
    />
  );
}
