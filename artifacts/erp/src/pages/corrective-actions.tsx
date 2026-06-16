import {
  useListCorrectiveActions,
  useCreateCorrectiveAction,
  useUpdateCorrectiveAction,
  useDeleteCorrectiveAction,
  getListCorrectiveActionsQueryKey,
  useListDefects,
  useListCompanies,
  type CorrectiveAction,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function CorrectiveActionsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: defectData } = useListDefects({ pageSize: 200 });
  const defectOptions = (defectData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "defectId", label: "Defect", labelAr: "العيب", type: "select", options: defectOptions },
    { name: "action", label: "Action", labelAr: "الإجراء", type: "textarea", required: true },
    { name: "assignedTo", label: "Assigned To", labelAr: "مُسند إلى" },
    { name: "dueDate", label: "Due Date", labelAr: "تاريخ الاستحقاق", type: "date" },
    { name: "completedDate", label: "Completed Date", labelAr: "تاريخ الإنجاز", type: "date" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["open", "in_progress", "completed", "closed"]) },
  ];

  const columns: ResourceColumn<CorrectiveAction>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Due Date", headerAr: "تاريخ الاستحقاق", render: (r) => r.dueDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="Corrective Actions"
      titleAr="الإجراءات التصحيحية"
      columns={columns}
      fields={fields}
      useList={useListCorrectiveActions}
      useCreate={useCreateCorrectiveAction}
      useUpdate={useUpdateCorrectiveAction}
      useDelete={useDeleteCorrectiveAction}
      getListQueryKey={getListCorrectiveActionsQueryKey}
      companyId={companyId}
    />
  );
}
