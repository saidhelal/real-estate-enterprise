import {
  useListStockCounts,
  useCreateStockCount,
  useUpdateStockCount,
  useDeleteStockCount,
  getListStockCountsQueryKey,
  useListWarehouses,
  useListCompanies,
  type StockCount,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function StockCountsPage() {
  const { language } = useLanguage();
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
      generatorKey: "stockCount",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "countDate", label: "Count Date", labelAr: "تاريخ الجرد", type: "date" },
    { name: "warehouseId", label: "Warehouse", labelAr: "المستودع", type: "select", options: warehouseOptions },
    { name: "countType", label: "Count Type", labelAr: "نوع الجرد", type: "select", options: enumOptions(["full", "cycle", "spot"]) },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft", "in_progress", "completed", "cancelled"]) },
    { name: "countedBy", label: "Counted By", labelAr: "جُرد بواسطة" },
    { name: "supervisedBy", label: "Supervised By", labelAr: "أشرف عليه" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<StockCount>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Count Type", headerAr: "نوع الجرد", render: (r) => <Badge variant="secondary">{enumLabel(r.countType, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Count Date", headerAr: "تاريخ الجرد", render: (r) => r.countDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="Stock Counts"
      titleAr="عمليات الجرد"
      columns={columns}
      fields={fields}
      useList={useListStockCounts}
      useCreate={useCreateStockCount}
      useUpdate={useUpdateStockCount}
      useDelete={useDeleteStockCount}
      getListQueryKey={getListStockCountsQueryKey}
      companyId={companyId}
    />
  );
}
