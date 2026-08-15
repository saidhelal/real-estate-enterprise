import {
  useListInventoryTransfers,
  useCreateInventoryTransfer,
  useUpdateInventoryTransfer,
  useDeleteInventoryTransfer,
  getListInventoryTransfersQueryKey,
  usePostInventoryTransfer,
  useListWarehouses,
  useListCompanies,
  type InventoryTransfer,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { PostDocumentAction } from "@/components/inventory/post-document-action";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function InventoryTransfersPage() {
  const { language } = useLanguage();
  const postMutation = usePostInventoryTransfer();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: fromWarehouseData } = useListWarehouses({ pageSize: 200 });
  const fromWarehouseOptions = (fromWarehouseData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const toWarehouseOptions = (fromWarehouseData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence on save; shown here beforehand.
      generated: true,
      generatorKey: "inventoryTransfer",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "transferDate", label: "Transfer Date", labelAr: "تاريخ التحويل", type: "date" },
    { name: "fromWarehouseId", label: "From Warehouse", labelAr: "من مستودع", type: "select", options: fromWarehouseOptions },
    { name: "toWarehouseId", label: "To Warehouse", labelAr: "إلى مستودع", type: "select", options: toWarehouseOptions },
    { name: "transferType", label: "Transfer Type", labelAr: "نوع التحويل", type: "select", options: enumOptions(["warehouse", "location"]) },
    { name: "totalValue", label: "Total Value", labelAr: "القيمة الإجمالية", type: "money" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft", "in_transit", "received", "completed", "cancelled"]) },
    { name: "requestedBy", label: "Requested By", labelAr: "طلب بواسطة" },
    { name: "approvedBy", label: "Approved By", labelAr: "اعتمد بواسطة" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<InventoryTransfer>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Transfer Type", headerAr: "نوع التحويل", render: (r) => <Badge variant="secondary">{enumLabel(r.transferType, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Total Value", headerAr: "القيمة الإجمالية", render: (r) => r.totalValue ?? "-" },
  ];

  return (
    <ResourceManager
      title="Inventory Transfers"
      titleAr="تحويلات المخزون"
      columns={columns}
      fields={fields}
      useList={useListInventoryTransfers}
      useCreate={useCreateInventoryTransfer}
      useUpdate={useUpdateInventoryTransfer}
      useDelete={useDeleteInventoryTransfer}
      getListQueryKey={getListInventoryTransfersQueryKey}
      // Posting is what moves the stock; a draft that is never posted
      // changes nothing in the warehouse. Once posted the document is
      // locked, because the movements it wrote have already been read.
      rowActions={(r) =>
        r.status === "draft" ? (
          <PostDocumentAction mutation={postMutation} id={r.id} queryKey={getListInventoryTransfersQueryKey()} />
        ) : null
      }
      canEdit={(r) => r.status === "draft"}
      canDelete={(r) => r.status === "draft"}
      companyId={companyId}
    />
  );
}
