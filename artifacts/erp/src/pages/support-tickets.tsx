import {
  useListCsSupportTickets,
  useCreateCsSupportTicket,
  useUpdateCsSupportTicket,
  useDeleteCsSupportTicket,
  getListCsSupportTicketsQueryKey,
  useListCompanies,
  type CsSupportTicket,
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

export default function SupportTicketsPage() {
  // Domain owned by the lookup engine. The literal is the fallback used
  // until the registry is seeded, so behaviour is unchanged either way.
  const { options: lk_priority_level } = useLookupOptions("priority_level", ["low", "medium", "high", "critical"]);
  // Domain owned by the lookup engine. The literal is the fallback used
  // until the registry is seeded, so behaviour is unchanged either way.
  const { options: lk_work_item_status } = useLookupOptions("work_item_status", ["open", "in_progress", "resolved", "closed"]);
  const { language } = useLanguage();
  const { options: CATEGORY } = useLookupOptions("support_ticket_category", ["general", "billing", "technical", "account"]);
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
      generatorKey: "supportTicket",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "customerId", label: "Customer ID", labelAr: "معرّف العميل", required: true },
    { name: "category", label: "Category", labelAr: "الفئة", type: "select", options: CATEGORY },
    { name: "priority", label: "Priority", labelAr: "الأولوية", type: "select", options: lk_priority_level },
    { name: "subject", label: "Subject", labelAr: "الموضوع", required: true },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: lk_work_item_status },
    { name: "assignedToUserId", label: "Assigned To (User ID)", labelAr: "مُسند إلى (معرّف المستخدم)" },
    { name: "escalationLevel", label: "Escalation Level", labelAr: "مستوى التصعيد", type: "money" },
  ];

  const columns: ResourceColumn<CsSupportTicket>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Subject", headerAr: "الموضوع", render: (r) => r.subject },
    { header: "Priority", headerAr: "الأولوية", render: (r) => <Badge variant="secondary">{enumLabel(r.priority, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Customer Requests"
      titleAr="طلبات العملاء"
      columns={columns}
      fields={fields}
      useList={useListCsSupportTickets}
      useCreate={useCreateCsSupportTicket}
      useUpdate={useUpdateCsSupportTicket}
      useDelete={useDeleteCsSupportTicket}
      getListQueryKey={getListCsSupportTicketsQueryKey}
      companyId={companyId}
    />
  );
}
