import {
  useListHandoverSnags,
  useCreateHandoverSnag,
  useUpdateHandoverSnag,
  useDeleteHandoverSnag,
  getListHandoverSnagsQueryKey,
  useListCompanies,
  useListHandoverRequests,
  type HandoverSnag,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { useLanguage } from "@/lib/language-provider";

export default function HandoverSnagsPage() {
  // Domain owned by the lookup engine. The literal is the fallback used
  // until the registry is seeded, so behaviour is unchanged either way.
  const { options: lk_priority_level } = useLookupOptions("priority_level", ["low", "medium", "high", "critical"]);
  // Domain owned by the lookup engine. The literal is the fallback used
  // until the registry is seeded, so behaviour is unchanged either way.
  const { options: lk_work_item_status } = useLookupOptions("work_item_status", ["open", "in_progress", "resolved", "closed"]);
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: requestIdData } = useListHandoverRequests({ pageSize: 200 });
  const requestIdOptions = (requestIdData?.data ?? []).map((x) => ({ value: x.id, label: x.code, labelAr: x.code }));

  const fields: ResourceField[] = [
    { name: "requestId", label: "Handover Request", labelAr: "طلب التسليم", type: "select", required: true, options: requestIdOptions },
    { name: "title", label: "Title", labelAr: "العنوان", required: true },
    { name: "titleAr", label: "Title (Arabic)", labelAr: "العنوان بالعربية", rtl: true },
    { name: "severity", label: "Severity", labelAr: "الخطورة", type: "select", options: lk_priority_level },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: lk_work_item_status },
    { name: "location", label: "Location", labelAr: "الموقع" },
    { name: "assignedToUserId", label: "Assigned To (User ID)", labelAr: "مُسند إلى (معرّف المستخدم)" },
    { name: "dueDate", label: "Due Date", labelAr: "تاريخ الاستحقاق", type: "date" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<HandoverSnag>[] = [
    { header: "Title", headerAr: "العنوان", render: (r) => language === "ar" ? (r.titleAr ?? r.title) : r.title },
    { header: "Severity", headerAr: "الخطورة", render: (r) => <Badge variant="secondary">{enumLabel(r.severity, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Due Date", headerAr: "تاريخ الاستحقاق", render: (r) => r.dueDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="Handover Snags"
      titleAr="ملاحظات التسليم"
      columns={columns}
      fields={fields}
      useList={useListHandoverSnags}
      useCreate={useCreateHandoverSnag}
      useUpdate={useUpdateHandoverSnag}
      useDelete={useDeleteHandoverSnag}
      getListQueryKey={getListHandoverSnagsQueryKey}
      companyId={companyId}
    />
  );
}
