import {
  useListLeadActivities,
  useCreateLeadActivity,
  useUpdateLeadActivity,
  useDeleteLeadActivity,
  getListLeadActivitiesQueryKey,
  useListLeads,
  useListUsers,
  useListCompanies,
  type LeadActivity,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumLabel } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { useLanguage } from "@/lib/language-provider";

export default function LeadActivitiesPage() {
  const { language } = useLanguage();
  const { options: ACTIVITY_TYPE } = useLookupOptions("lead_activity_type", ["note", "call", "meeting", "email", "visit"]);
  const { data: companies } = useListCompanies();
  const { data: leads } = useListLeads({ pageSize: 200 });
  const { data: users } = useListUsers();
  const companyId = companies?.[0]?.id;

  const leadOptions = (leads?.data ?? []).map((l) => ({ value: l.id, label: l.fullName }));
  const userOptions = (users ?? []).map((u) => ({ value: u.id, label: u.fullName ?? u.username }));

  const fields: ResourceField[] = [
    { name: "leadId", label: "Lead", labelAr: "العميل المحتمل", type: "select", required: true, options: leadOptions },
    { name: "userId", label: "User", labelAr: "المستخدم", type: "select", options: userOptions },
    { name: "activityType", label: "Activity Type", labelAr: "نوع النشاط", type: "select", required: true, options: ACTIVITY_TYPE },
    { name: "subject", label: "Subject", labelAr: "الموضوع" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
    { name: "activityDate", label: "Activity Date", labelAr: "تاريخ النشاط", type: "date", required: true },
  ];

  const columns: ResourceColumn<LeadActivity>[] = [
    { header: "Type", headerAr: "النوع", render: (r) => <Badge variant="secondary">{enumLabel(r.activityType, language)}</Badge> },
    { header: "Subject", headerAr: "الموضوع", render: (r) => r.subject ?? "-" },
    { header: "Date", headerAr: "التاريخ", render: (r) => r.activityDate },
  ];

  return (
    <ResourceManager
      title="Lead Activities"
      titleAr="أنشطة العملاء المحتملين"
      columns={columns}
      fields={fields}
      useList={useListLeadActivities}
      useCreate={useCreateLeadActivity}
      useUpdate={useUpdateLeadActivity}
      useDelete={useDeleteLeadActivity}
      getListQueryKey={getListLeadActivitiesQueryKey}
      companyId={companyId}
    />
  );
}
