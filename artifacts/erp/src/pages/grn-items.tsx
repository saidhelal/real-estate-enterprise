import {
  useListGrnItems,
  useCreateGrnItem,
  useUpdateGrnItem,
  useDeleteGrnItem,
  getListGrnItemsQueryKey,
  useListGoodsReceiptNotes,
  useListCompanies,
  type GrnItem,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function GrnItemsPage() {
  useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: grnData } = useListGoodsReceiptNotes({ pageSize: 200 });
  const grnOptions = (grnData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));

  const fields: ResourceField[] = [
    { name: "grnId", label: "Goods Receipt", labelAr: "إذن الاستلام", type: "select", options: grnOptions },
    { name: "poItemId", label: "PO Item", labelAr: "بند أمر الشراء" },
    { name: "description", label: "Description", labelAr: "الوصف", required: true },
    { name: "unit", label: "Unit", labelAr: "الوحدة" },
    { name: "orderedQuantity", label: "Ordered Quantity", labelAr: "الكمية المطلوبة", type: "money" },
    { name: "receivedQuantity", label: "Received Quantity", labelAr: "الكمية المستلمة", type: "money" },
    { name: "acceptedQuantity", label: "Accepted Quantity", labelAr: "الكمية المقبولة", type: "money" },
    { name: "rejectedQuantity", label: "Rejected Quantity", labelAr: "الكمية المرفوضة", type: "money" },
    { name: "unitPrice", label: "Unit Price", labelAr: "سعر الوحدة", type: "money" },
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<GrnItem>[] = [
    { header: "Description", headerAr: "الوصف", render: (r) => <span className="font-medium">{r.description ?? "-"}</span> },
    { header: "Ordered Quantity", headerAr: "الكمية المطلوبة", render: (r) => r.orderedQuantity ?? "-" },
  ];

  return (
    <ResourceManager
      title="GRN Items"
      titleAr="بنود إذن الاستلام"
      columns={columns}
      fields={fields}
      useList={useListGrnItems}
      useCreate={useCreateGrnItem}
      useUpdate={useUpdateGrnItem}
      useDelete={useDeleteGrnItem}
      getListQueryKey={getListGrnItemsQueryKey}
      companyId={companyId}
    />
  );
}
