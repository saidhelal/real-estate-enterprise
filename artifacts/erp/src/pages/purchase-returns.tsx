import {
  useListPurchaseReturns,
  useCreatePurchaseReturn,
  useUpdatePurchaseReturn,
  useDeletePurchaseReturn,
  getListPurchaseReturnsQueryKey,
  useListGoodsReceiptNotes,
  useListSuppliers,
  useListCompanies,
  type PurchaseReturn,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function PurchaseReturnsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: grnData } = useListGoodsReceiptNotes({ pageSize: 200 });
  const grnOptions = (grnData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));
  const { data: supplierData } = useListSuppliers({ pageSize: 200 });
  const supplierOptions = (supplierData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "grnId", label: "Goods Receipt", labelAr: "إذن الاستلام", type: "select", options: grnOptions },
    { name: "supplierId", label: "Supplier", labelAr: "المورد", type: "select", options: supplierOptions },
    { name: "returnDate", label: "Return Date", labelAr: "تاريخ المرتجع", type: "date" },
    { name: "reason", label: "Reason", labelAr: "السبب", type: "textarea" },
    { name: "totalAmount", label: "Total Amount", labelAr: "المبلغ الإجمالي", type: "money" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft", "submitted", "approved", "completed", "cancelled"]) },
    { name: "approvedBy", label: "Approved By", labelAr: "اعتمد بواسطة" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<PurchaseReturn>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Total Amount", headerAr: "المبلغ الإجمالي", render: (r) => r.totalAmount ?? "-" },
  ];

  return (
    <ResourceManager
      title="Purchase Returns"
      titleAr="مرتجعات الشراء"
      columns={columns}
      fields={fields}
      useList={useListPurchaseReturns}
      useCreate={useCreatePurchaseReturn}
      useUpdate={useUpdatePurchaseReturn}
      useDelete={useDeletePurchaseReturn}
      getListQueryKey={getListPurchaseReturnsQueryKey}
      companyId={companyId}
    />
  );
}
