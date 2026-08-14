import {
  useListWorkOrders,
  useCreateWorkOrder,
  useUpdateWorkOrder,
  useDeleteWorkOrder,
  getListWorkOrdersQueryKey,
  useListCompanies,
  type WorkOrder,
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

export default function WorkOrdersPage() {
  // Domain owned by the lookup engine. The literal is the fallback used
  // until the registry is seeded, so behaviour is unchanged either way.
  const { options: lk_priority_level } = useLookupOptions("priority_level", ["low", "medium", "high", "critical"]);
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence engine on save; shown in the form
      // before saving and never typed in.
      generated: true,
      generatorKey: "workOrder",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "customerId", label: "Customer ID", labelAr: "معرّف العميل" },
    { name: "unitId", label: "Unit ID", labelAr: "معرّف الوحدة" },
    { name: "sourceType", label: "Source Type", labelAr: "نوع المصدر", type: "select", options: enumOptions(["manual", "complaint", "maintenance", "handover"]) },
    { name: "sourceId", label: "Source ID", labelAr: "معرّف المصدر" },
    { name: "title", label: "Title", labelAr: "العنوان", required: true },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
    { name: "priority", label: "Priority", labelAr: "الأولوية", type: "select", options: lk_priority_level },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["open", "in_progress", "on_hold", "done", "cancelled"]) },
    { name: "assignedToUserId", label: "Assigned To (User ID)", labelAr: "مُسند إلى (معرّف المستخدم)" },
    { name: "scheduledDate", label: "Scheduled Date", labelAr: "تاريخ الجدولة", type: "date" },
    { name: "completedDate", label: "Completed Date", labelAr: "تاريخ الإنجاز", type: "date" },
    { name: "progressPercent", label: "Progress %", labelAr: "نسبة الإنجاز %", type: "money" },
    { name: "estimatedCost", label: "Estimated Cost", labelAr: "التكلفة المقدّرة", type: "money" },
    { name: "actualCost", label: "Actual Cost", labelAr: "التكلفة الفعلية", type: "money" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<WorkOrder>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Title", headerAr: "العنوان", render: (r) => r.title },
    { header: "Priority", headerAr: "الأولوية", render: (r) => <Badge variant="secondary">{enumLabel(r.priority, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Progress %", headerAr: "نسبة الإنجاز %", render: (r) => `${r.progressPercent ?? "0"}%` },
  ];

  return (
    <ResourceManager
      title="Work Orders"
      titleAr="أوامر العمل"
      columns={columns}
      fields={fields}
      useList={useListWorkOrders}
      useCreate={useCreateWorkOrder}
      useUpdate={useUpdateWorkOrder}
      useDelete={useDeleteWorkOrder}
      getListQueryKey={getListWorkOrdersQueryKey}
      companyId={companyId}
    />
  );
}
