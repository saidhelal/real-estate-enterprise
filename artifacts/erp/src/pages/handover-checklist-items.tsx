import {
  useListHandoverChecklistItems,
  useCreateHandoverChecklistItem,
  useUpdateHandoverChecklistItem,
  useDeleteHandoverChecklistItem,
  getListHandoverChecklistItemsQueryKey,
  useListCompanies,
  useListHandoverRequests,
  type HandoverChecklistItem,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function HandoverChecklistItemsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: requestIdData } = useListHandoverRequests({ pageSize: 200 });
  const requestIdOptions = (requestIdData?.data ?? []).map((x) => ({ value: x.id, label: x.code, labelAr: x.code }));

  const fields: ResourceField[] = [
    { name: "requestId", label: "Handover Request", labelAr: "طلب التسليم", type: "select", required: true, options: requestIdOptions },
    { name: "item", label: "Item", labelAr: "البند", required: true },
    { name: "itemAr", label: "Item (Arabic)", labelAr: "البند بالعربية", rtl: true },
    { name: "category", label: "Category", labelAr: "الفئة" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["pending", "passed", "failed", "na"]) },
    { name: "remarks", label: "Remarks", labelAr: "ملاحظات" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات إضافية", type: "textarea" },
  ];

  const columns: ResourceColumn<HandoverChecklistItem>[] = [
    { header: "Item", headerAr: "البند", render: (r) => language === "ar" ? (r.itemAr ?? r.item) : r.item },
    { header: "Category", headerAr: "الفئة", render: (r) => r.category ?? "-" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Handover Checklist"
      titleAr="قائمة فحص التسليم"
      columns={columns}
      fields={fields}
      useList={useListHandoverChecklistItems}
      useCreate={useCreateHandoverChecklistItem}
      useUpdate={useUpdateHandoverChecklistItem}
      useDelete={useDeleteHandoverChecklistItem}
      getListQueryKey={getListHandoverChecklistItemsQueryKey}
      companyId={companyId}
    />
  );
}
