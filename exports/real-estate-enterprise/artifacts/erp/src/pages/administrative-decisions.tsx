import {
  useListAdministrativeDecisions,
  useCreateAdministrativeDecision,
  useUpdateAdministrativeDecision,
  useDeleteAdministrativeDecision,
  getListAdministrativeDecisionsQueryKey,
  useListCompanies,
  type AdministrativeDecision,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function AdministrativeDecisionsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "title", label: "Title", labelAr: "العنوان", required: true },
    { name: "decisionType", label: "Type", labelAr: "النوع", type: "select", options: enumOptions(["management", "board", "committee"]) },
    { name: "decisionDate", label: "Decision Date", labelAr: "تاريخ القرار", type: "date" },
    { name: "meetingId", label: "Meeting ID", labelAr: "معرّف الاجتماع" },
    { name: "issuedByEmployeeId", label: "Issued By (Employee ID)", labelAr: "صادر عن (معرّف الموظف)" },
    { name: "assignedToEmployeeId", label: "Assigned To (Employee ID)", labelAr: "مُسند إلى (معرّف الموظف)" },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["open", "in_progress", "implemented", "closed", "cancelled"]) },
    { name: "dueDate", label: "Due Date", labelAr: "تاريخ الاستحقاق", type: "date" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<AdministrativeDecision>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Title", headerAr: "العنوان", render: (r) => r.title },
    { header: "Type", headerAr: "النوع", render: (r) => <Badge variant="secondary">{enumLabel(r.decisionType, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Administrative Decisions"
      titleAr="القرارات الإدارية"
      columns={columns}
      fields={fields}
      useList={useListAdministrativeDecisions}
      useCreate={useCreateAdministrativeDecision}
      useUpdate={useUpdateAdministrativeDecision}
      useDelete={useDeleteAdministrativeDecision}
      getListQueryKey={getListAdministrativeDecisionsQueryKey}
      companyId={companyId}
    />
  );
}
