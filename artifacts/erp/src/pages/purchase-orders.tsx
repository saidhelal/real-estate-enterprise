import {
  useListPurchaseOrders,
  useCreatePurchaseOrder,
  useUpdatePurchaseOrder,
  useDeletePurchaseOrder,
  getListPurchaseOrdersQueryKey,
  useListSuppliers,
  useListSupplierQuotations,
  useListPurchaseRequests,
  useListCompanies,
  type PurchaseOrder,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function PurchaseOrdersPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: supplierData } = useListSuppliers({ pageSize: 200 });
  const supplierOptions = (supplierData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: quotationData } = useListSupplierQuotations({ pageSize: 200 });
  const quotationOptions = (quotationData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));
  const { data: requestData } = useListPurchaseRequests({ pageSize: 200 });
  const requestOptions = (requestData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "supplierId", label: "Supplier", labelAr: "المورد", type: "select", options: supplierOptions },
    { name: "quotationId", label: "Quotation", labelAr: "عرض السعر", type: "select", options: quotationOptions },
    { name: "requestId", label: "Purchase Request", labelAr: "طلب الشراء", type: "select", options: requestOptions },
    { name: "orderDate", label: "Order Date", labelAr: "تاريخ الأمر", type: "date" },
    { name: "expectedDate", label: "Expected Date", labelAr: "التاريخ المتوقع", type: "date" },
    { name: "totalAmount", label: "Total Amount", labelAr: "المبلغ الإجمالي", type: "money" },
    { name: "deliveryTerms", label: "Delivery Terms", labelAr: "شروط التسليم" },
    { name: "paymentTerms", label: "Payment Terms", labelAr: "شروط الدفع" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft", "approved", "issued", "received", "completed", "cancelled"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<PurchaseOrder>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Total Amount", headerAr: "المبلغ الإجمالي", render: (r) => r.totalAmount ?? "-" },
  ];

  return (
    <ResourceManager
      title="Purchase Orders"
      titleAr="أوامر الشراء"
      columns={columns}
      fields={fields}
      useList={useListPurchaseOrders}
      useCreate={useCreatePurchaseOrder}
      useUpdate={useUpdatePurchaseOrder}
      useDelete={useDeletePurchaseOrder}
      getListQueryKey={getListPurchaseOrdersQueryKey}
      companyId={companyId}
    />
  );
}
