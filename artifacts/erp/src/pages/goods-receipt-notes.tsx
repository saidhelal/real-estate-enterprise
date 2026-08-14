import {
  useListGoodsReceiptNotes,
  useCreateGoodsReceiptNote,
  useUpdateGoodsReceiptNote,
  useDeleteGoodsReceiptNote,
  getListGoodsReceiptNotesQueryKey,
  useListPurchaseOrders,
  useListSuppliers,
  useListCompanies,
  type GoodsReceiptNote,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function GoodsReceiptNotesPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: poData } = useListPurchaseOrders({ pageSize: 200 });
  const poOptions = (poData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));
  const { data: supplierData } = useListSuppliers({ pageSize: 200 });
  const supplierOptions = (supplierData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence on save; shown here beforehand.
      generated: true,
      generatorKey: "goodsReceiptNote",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "poId", label: "Purchase Order", labelAr: "أمر الشراء", type: "select", options: poOptions },
    { name: "supplierId", label: "Supplier", labelAr: "المورد", type: "select", options: supplierOptions },
    { name: "receiptDate", label: "Receipt Date", labelAr: "تاريخ الاستلام", type: "date" },
    { name: "receiptType", label: "Receipt Type", labelAr: "نوع الاستلام", type: "select", options: enumOptions(["full", "partial"]) },
    { name: "warehouse", label: "Warehouse", labelAr: "المستودع" },
    { name: "totalAmount", label: "Total Amount", labelAr: "المبلغ الإجمالي", type: "money" },
    { name: "inspectionStatus", label: "Inspection Status", labelAr: "حالة الفحص", type: "select", options: enumOptions(["pending", "passed", "failed"]) },
    { name: "inspectedBy", label: "Inspected By", labelAr: "فُحص بواسطة" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft", "received", "completed", "cancelled"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<GoodsReceiptNote>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Receipt Type", headerAr: "نوع الاستلام", render: (r) => <Badge variant="secondary">{enumLabel(r.receiptType, language)}</Badge> },
    { header: "Inspection Status", headerAr: "حالة الفحص", render: (r) => <Badge variant="secondary">{enumLabel(r.inspectionStatus, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Total Amount", headerAr: "المبلغ الإجمالي", render: (r) => r.totalAmount ?? "-" },
  ];

  return (
    <ResourceManager
      title="Goods Receipt Notes"
      titleAr="أذون استلام البضائع"
      columns={columns}
      fields={fields}
      useList={useListGoodsReceiptNotes}
      useCreate={useCreateGoodsReceiptNote}
      useUpdate={useUpdateGoodsReceiptNote}
      useDelete={useDeleteGoodsReceiptNote}
      getListQueryKey={getListGoodsReceiptNotesQueryKey}
      companyId={companyId}
    />
  );
}
