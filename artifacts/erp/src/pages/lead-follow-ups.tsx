import {
  useListLeadFollowUps,
  useCreateLeadFollowUp,
  useUpdateLeadFollowUp,
  useDeleteLeadFollowUp,
  getListLeadFollowUpsQueryKey,
  useListLeads,
  useListUsers,
  useListCompanies,
  type LeadFollowUp,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

const STATUS = enumOptions(["pending", "done", "cancelled"]);

export default function LeadFollowUpsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const { data: leads } = useListLeads({ pageSize: 200 });
  const { data: users } = useListUsers();
  const companyId = companies?.[0]?.id;

  const leadOptions = (leads?.data ?? []).map((l) => ({ value: l.id, label: l.fullName }));
  const userOptions = (users ?? []).map((u) => ({ value: u.id, label: u.fullName ?? u.username }));

  const fields: ResourceField[] = [
    { name: "leadId", label: "Lead", labelAr: "العميل المحتمل", type: "select", required: true, options: leadOptions },
    { name: "userId", label: "User", labelAr: "المستخدم", type: "select", options: userOptions },
    { name: "dueDate", label: "Due Date", labelAr: "تاريخ الاستحقاق", type: "date", required: true },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", required: true, options: STATUS },
  ];

  const columns: ResourceColumn<LeadFollowUp>[] = [
    { header: "Due Date", headerAr: "تاريخ الاستحقاق", render: (r) => r.dueDate },
    { header: "Notes", headerAr: "ملاحظات", render: (r) => r.notes ?? "-" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Lead Follow-Ups"
      titleAr="متابعات العملاء المحتملين"
      columns={columns}
      fields={fields}
      useList={useListLeadFollowUps}
      useCreate={useCreateLeadFollowUp}
      useUpdate={useUpdateLeadFollowUp}
      useDelete={useDeleteLeadFollowUp}
      getListQueryKey={getListLeadFollowUpsQueryKey}
      companyId={companyId}
    />
  );
}
