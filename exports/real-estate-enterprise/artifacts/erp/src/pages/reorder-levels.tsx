import {
  useListReorderLevels,
  useCreateReorderLevel,
  useUpdateReorderLevel,
  useDeleteReorderLevel,
  getListReorderLevelsQueryKey,
  useListInventoryItems,
  useListWarehouses,
  useListCompanies,
  type ReorderLevel,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function ReorderLevelsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: itemData } = useListInventoryItems({ pageSize: 200 });
  const itemOptions = (itemData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: warehouseData } = useListWarehouses({ pageSize: 200 });
  const warehouseOptions = (warehouseData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    { name: "itemId", label: "Item", labelAr: "الصنف", type: "select", options: itemOptions },
    { name: "warehouseId", label: "Warehouse", labelAr: "المستودع", type: "select", options: warehouseOptions },
    { name: "minQuantity", label: "Min Quantity", labelAr: "الحد الأدنى للكمية", type: "number" },
    { name: "maxQuantity", label: "Max Quantity", labelAr: "الحد الأقصى للكمية", type: "number" },
    { name: "reorderQuantity", label: "Reorder Quantity", labelAr: "كمية إعادة الطلب", type: "number" },
    { name: "reorderPoint", label: "Reorder Point", labelAr: "نقطة إعادة الطلب", type: "number" },
    { name: "leadTimeDays", label: "Lead Time (Days)", labelAr: "مدة التوريد (أيام)", type: "number" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["active", "inactive"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<ReorderLevel>[] = [
    { header: "Item", headerAr: "الصنف", render: (r) => <span className="font-medium">{r.itemId ?? "-"}</span> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Min Quantity", headerAr: "الحد الأدنى للكمية", render: (r) => r.minQuantity ?? "-" },
  ];

  return (
    <ResourceManager
      title="Reorder Levels"
      titleAr="مستويات إعادة الطلب"
      columns={columns}
      fields={fields}
      useList={useListReorderLevels}
      useCreate={useCreateReorderLevel}
      useUpdate={useUpdateReorderLevel}
      useDelete={useDeleteReorderLevel}
      getListQueryKey={getListReorderLevelsQueryKey}
      companyId={companyId}
    />
  );
}
