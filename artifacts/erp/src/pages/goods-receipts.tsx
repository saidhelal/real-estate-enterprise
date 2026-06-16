import {
  useListGoodsReceipts,
  useCreateGoodsReceipt,
  useUpdateGoodsReceipt,
  useDeleteGoodsReceipt,
  getListGoodsReceiptsQueryKey,
  useListWarehouses,
  useListSuppliers,
  useListPurchaseOrders,
  useListCompanies,
  type GoodsReceipt,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function GoodsReceiptsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: warehouseData } = useListWarehouses({ pageSize: 200 });
  const warehouseOptions = (warehouseData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: supplierData } = useListSuppliers({ pageSize: 200 });
  const supplierOptions = (supplierData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: poData } = useListPurchaseOrders({ pageSize: 200 });
  const poOptions = (poData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "receiptDate", label: "Receipt Date", labelAr: "تاريخ الاستلام", type: "date" },
    { name: "receiptType", label: "Receipt Type", labelAr: "نوع الاستلام", type: "select", options: enumOptions(["purchase", "return", "transfer", "production", "opening"]) },
    { name: "warehouseId", label: "Warehouse", labelAr: "المستودع", type: "select", options: warehouseOptions },
    { name: "supplierId", label: "Supplier", labelAr: "المورد", type: "select", options: supplierOptions },
    { name: "poId", label: "Purchase Order", labelAr: "أمر الشراء", type: "select", options: poOptions },
    { name: "referenceNumber", label: "Reference Number", labelAr: "رقم المرجع" },
    { name: "totalValue", label: "Total Value", labelAr: "القيمة الإجمالية", type: "money" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft", "received", "completed", "cancelled"]) },
    { name: "receivedBy", label: "Received By", labelAr: "استلم بواسطة" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<GoodsReceipt>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Receipt Type", headerAr: "نوع الاستلام", render: (r) => <Badge variant="secondary">{enumLabel(r.receiptType, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Total Value", headerAr: "القيمة الإجمالية", render: (r) => r.totalValue ?? "-" },
  ];

  return (
    <ResourceManager
      title="Goods Receipts"
      titleAr="استلام المخزون"
      columns={columns}
      fields={fields}
      useList={useListGoodsReceipts}
      useCreate={useCreateGoodsReceipt}
      useUpdate={useUpdateGoodsReceipt}
      useDelete={useDeleteGoodsReceipt}
      getListQueryKey={getListGoodsReceiptsQueryKey}
      companyId={companyId}
    />
  );
}
