import {
  useListStockAdjustments,
  useCreateStockAdjustment,
  useUpdateStockAdjustment,
  useDeleteStockAdjustment,
  getListStockAdjustmentsQueryKey,
  usePostStockAdjustment,
  useListWarehouses,
  useListCompanies,
  type StockAdjustment,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { PostDocumentAction } from "@/components/inventory/post-document-action";
import { enumLabel, enumOptions } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { Badge } from "@/components/ui/badge";

export default function StockAdjustmentsPage() {
  const { language } = useLanguage();
  const postMutation = usePostStockAdjustment();
  const { options: ADJUSTMENT_TYPE } = useLookupOptions("stock_adjustment_reason", ["increase", "decrease", "revaluation", "damage", "loss", "expiry"]);
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: warehouseData } = useListWarehouses({ pageSize: 200 });
  const warehouseOptions = (warehouseData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence on save; shown here beforehand.
      generated: true,
      generatorKey: "stockAdjustment",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "adjustmentDate", label: "Adjustment Date", labelAr: "تاريخ التسوية", type: "date" },
    { name: "warehouseId", label: "Warehouse", labelAr: "المستودع", type: "select", options: warehouseOptions },
    { name: "adjustmentType", label: "Adjustment Type", labelAr: "نوع التسوية", type: "select", options: ADJUSTMENT_TYPE },
    { name: "reason", label: "Reason", labelAr: "السبب" },
    { name: "totalValue", label: "Total Value", labelAr: "القيمة الإجمالية", type: "money" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft", "approved", "completed", "cancelled"]) },
    { name: "approvedBy", label: "Approved By", labelAr: "اعتمد بواسطة" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<StockAdjustment>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Adjustment Type", headerAr: "نوع التسوية", render: (r) => <Badge variant="secondary">{enumLabel(r.adjustmentType, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Total Value", headerAr: "القيمة الإجمالية", render: (r) => r.totalValue ?? "-" },
  ];

  return (
    <ResourceManager
      title="Stock Adjustments"
      titleAr="تسويات المخزون"
      columns={columns}
      fields={fields}
      useList={useListStockAdjustments}
      useCreate={useCreateStockAdjustment}
      useUpdate={useUpdateStockAdjustment}
      useDelete={useDeleteStockAdjustment}
      getListQueryKey={getListStockAdjustmentsQueryKey}
      // Posting is what moves the stock; a draft that is never posted
      // changes nothing in the warehouse. Once posted the document is
      // locked, because the movements it wrote have already been read.
      rowActions={(r) =>
        r.status === "draft" ? (
          <PostDocumentAction mutation={postMutation} id={r.id} queryKey={getListStockAdjustmentsQueryKey()} />
        ) : null
      }
      canEdit={(r) => r.status === "draft"}
      canDelete={(r) => r.status === "draft"}
      companyId={companyId}
    />
  );
}
