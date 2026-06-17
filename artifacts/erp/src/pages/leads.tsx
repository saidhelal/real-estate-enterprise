import {
  useListLeads,
  useCreateLead,
  useUpdateLead,
  useDeleteLead,
  getListLeadsQueryKey,
  useListBranches,
  useListLeadSources,
  useListUsers,
  useListCompanies,
  type Lead,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumLabel } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

export default function LeadsPage() {
  const { language } = useLanguage();
  const { options: STATUS } = useLookupOptions("lead_status", [
    "new",
    "contacted",
    "qualified",
    "proposal",
    "won",
    "lost",
  ]);
  const { data: companies } = useListCompanies();
  const { data: branches } = useListBranches();
  const { data: sources } = useListLeadSources({ pageSize: 200 });
  const { data: users } = useListUsers();
  const companyId = companies?.[0]?.id;

  const branchOptions = (branches ?? []).map((b) => ({ value: b.id, label: b.name }));
  const sourceOptions = (sources?.data ?? []).map((s) => ({ value: s.id, label: s.name }));
  const userOptions = (users ?? []).map((u) => ({ value: u.id, label: u.fullName ?? u.username }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "fullName", label: "Full Name", labelAr: "الاسم الكامل", required: true },
    { name: "phone", label: "Phone", labelAr: "الهاتف" },
    { name: "email", label: "Email", labelAr: "البريد الإلكتروني" },
    { name: "branchId", label: "Branch", labelAr: "الفرع", type: "select", options: branchOptions },
    { name: "sourceId", label: "Source", labelAr: "المصدر", type: "select", options: sourceOptions },
    { name: "assignedToUserId", label: "Assigned To", labelAr: "معين إلى", type: "select", options: userOptions },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", required: true, options: STATUS },
    { name: "budget", label: "Budget", labelAr: "الميزانية", type: "money" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<Lead>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Full Name", headerAr: "الاسم الكامل", render: (r) => r.fullName },
    { header: "Phone", headerAr: "الهاتف", render: (r) => r.phone ?? "-" },
    { header: "Budget", headerAr: "الميزانية", render: (r) => r.budget ?? "-" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Leads"
      titleAr="العملاء المحتملون"
      columns={columns}
      fields={fields}
      useList={useListLeads}
      useCreate={useCreateLead}
      useUpdate={useUpdateLead}
      useDelete={useDeleteLead}
      getListQueryKey={getListLeadsQueryKey}
      companyId={companyId}
    />
  );
}
