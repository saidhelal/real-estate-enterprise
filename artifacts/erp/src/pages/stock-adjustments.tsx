import {
  useListStockAdjustments,
  useCreateStockAdjustment,
  useUpdateStockAdjustment,
  useDeleteStockAdjustment,
  getListStockAdjustmentsQueryKey,
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
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function StockAdjustmentsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: warehouseData } = useListWarehouses({ pageSize: 200 });
  const warehouseOptions = (warehouseData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "adjustmentDate", label: "Adjustment Date", labelAr: "تاريخ التسوية", type: "date" },
    { name: "warehouseId", label: "Warehouse", labelAr: "المستودع", type: "select", options: warehouseOptions },
    { name: "adjustmentType", label: "Adjustment Type", labelAr: "نوع التسوية", type: "select", options: enumOptions(["increase", "decrease", "revaluation", "damage", "loss", "expiry"]) },
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
      companyId={companyId}
    />
  );
}
