import {
  useListLeadAssignments,
  useCreateLeadAssignment,
  useUpdateLeadAssignment,
  useDeleteLeadAssignment,
  getListLeadAssignmentsQueryKey,
  useListLeads,
  useListUsers,
  useListCompanies,
  type LeadAssignment,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";

export default function LeadAssignmentsPage() {
  const { data: companies } = useListCompanies();
  const { data: leads } = useListLeads({ pageSize: 200 });
  const { data: users } = useListUsers();
  const companyId = companies?.[0]?.id;

  const leadOptions = (leads?.data ?? []).map((l) => ({ value: l.id, label: l.fullName }));
  const userOptions = (users ?? []).map((u) => ({ value: u.id, label: u.fullName ?? u.username }));

  const fields: ResourceField[] = [
    { name: "leadId", label: "Lead", labelAr: "العميل المحتمل", type: "select", required: true, options: leadOptions },
    { name: "assignedToUserId", label: "Assigned To", labelAr: "معين إلى", type: "select", required: true, options: userOptions },
    { name: "assignedByUserId", label: "Assigned By", labelAr: "معين بواسطة", type: "select", options: userOptions },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<LeadAssignment>[] = [
    { header: "Lead", headerAr: "العميل المحتمل", render: (r) => r.leadId },
    { header: "Assigned To", headerAr: "معين إلى", render: (r) => r.assignedToUserId },
    { header: "Notes", headerAr: "ملاحظات", render: (r) => r.notes ?? "-" },
  ];

  return (
    <ResourceManager
      title="Lead Assignments"
      titleAr="تعيينات العملاء المحتملين"
      columns={columns}
      fields={fields}
      useList={useListLeadAssignments}
      useCreate={useCreateLeadAssignment}
      useUpdate={useUpdateLeadAssignment}
      useDelete={useDeleteLeadAssignment}
      getListQueryKey={getListLeadAssignmentsQueryKey}
      companyId={companyId}
    />
  );
}
