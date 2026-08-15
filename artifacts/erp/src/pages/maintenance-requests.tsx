import {
  useListCsMaintenanceRequests,
  useCreateCsMaintenanceRequest,
  useUpdateCsMaintenanceRequest,
  useDeleteCsMaintenanceRequest,
  getListCsMaintenanceRequestsQueryKey,
  useListCompanies,
  type CsMaintenanceRequest,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { SlaCell } from "@/components/customer-service/sla-cell";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { useLanguage } from "@/lib/language-provider";

export default function MaintenanceRequestsPage() {
  // Domain owned by the lookup engine. The literal is the fallback used
  // until the registry is seeded, so behaviour is unchanged either way.
  const { options: lk_priority_level } = useLookupOptions("priority_level", ["low", "medium", "high", "critical"]);
  // Domain owned by the lookup engine. The literal is the fallback used
  // until the registry is seeded, so behaviour is unchanged either way.
  const { options: lk_work_item_status } = useLookupOptions("work_item_status", ["open", "in_progress", "resolved", "closed"]);
  const { language } = useLanguage();
  const { options: CATEGORY } = useLookupOptions("maintenance_category", ["general", "electrical", "plumbing", "civil", "hvac"]);
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
      generatorKey: "maintenanceRequest",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "customerId", label: "Customer ID", labelAr: "معرّف العميل", required: true },
    { name: "unitId", label: "Unit ID", labelAr: "معرّف الوحدة" },
    { name: "contractId", label: "Contract ID", labelAr: "معرّف العقد" },
    { name: "category", label: "Category", labelAr: "الفئة", type: "select", options: CATEGORY },
    { name: "priority", label: "Priority", labelAr: "الأولوية", type: "select", options: lk_priority_level },
    { name: "subject", label: "Subject", labelAr: "الموضوع", required: true },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: lk_work_item_status },
    { name: "assignedToUserId", label: "Assigned To (User ID)", labelAr: "مُسند إلى (معرّف المستخدم)" },
    {
      name: "escalationLevel",
      label: "Escalation Level",
      labelAr: "مستوى التصعيد",
      // Raised by the SLA engine when a deadline passes, never typed: a level
      // someone entered by hand would claim an escalation that never happened.
      generated: true,
      description: "Raised automatically when the agreed response time passes.",
      descriptionAr: "يرتفع تلقائيًا عند تجاوز وقت الاستجابة المتفق عليه.",
    },
    { name: "attachmentUrl", label: "Attachment URL", labelAr: "رابط المرفق" },
  ];

  const columns: ResourceColumn<CsMaintenanceRequest>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Subject", headerAr: "الموضوع", render: (r) => r.subject },
    { header: "Priority", headerAr: "الأولوية", render: (r) => <Badge variant="secondary">{enumLabel(r.priority, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    {
      header: "SLA",
      headerAr: "مستوى الخدمة",
      render: (r) => (
        <SlaCell
          dueAt={r.dueAt}
          escalationLevel={r.escalationLevel}
          closed={["completed", "closed", "cancelled", "rejected"].includes(String(r.status))}
        />
      ),
    },
  ];

  return (
    <ResourceManager
      title="Maintenance Requests"
      titleAr="طلبات الصيانة"
      columns={columns}
      fields={fields}
      useList={useListCsMaintenanceRequests}
      useCreate={useCreateCsMaintenanceRequest}
      useUpdate={useUpdateCsMaintenanceRequest}
      useDelete={useDeleteCsMaintenanceRequest}
      getListQueryKey={getListCsMaintenanceRequestsQueryKey}
      companyId={companyId}
    />
  );
}
