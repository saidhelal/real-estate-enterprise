import {
  useListAdministrativeTasks,
  useCreateAdministrativeTask,
  useUpdateAdministrativeTask,
  useDeleteAdministrativeTask,
  getListAdministrativeTasksQueryKey,
  useListCompanies,
  type AdministrativeTask,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";
import { useDeclareScreenContext } from "@/lib/screen-context";

export default function AdministrativeTasksPage() {
  // The register itself is printable: the header offers the directive template,
  // and a directive raised from here is about administrative work.
  useDeclareScreenContext({ moduleKey: "generalAdmin", documentType: "administrative_task" });

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
      generatorKey: "administrativeTask",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "title", label: "Title", labelAr: "العنوان", required: true },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
    { name: "assignedToEmployeeId", label: "Assigned To (Employee ID)", labelAr: "مُسند إلى (معرّف الموظف)" },
    { name: "assignedByUserId", label: "Assigned By (User ID)", labelAr: "أسند بواسطة (معرّف المستخدم)" },
    { name: "priority", label: "Priority", labelAr: "الأولوية", type: "select", options: enumOptions(["low", "medium", "high", "urgent"]) },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["open", "in_progress", "completed", "on_hold", "cancelled"]) },
    { name: "progressPercent", label: "Progress %", labelAr: "نسبة الإنجاز %", type: "money" },
    { name: "startDate", label: "Start Date", labelAr: "تاريخ البدء", type: "date" },
    { name: "dueDate", label: "Due Date", labelAr: "تاريخ الاستحقاق", type: "date" },
    { name: "completedDate", label: "Completed Date", labelAr: "تاريخ الإنجاز", type: "date" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<AdministrativeTask>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Title", headerAr: "العنوان", render: (r) => r.title },
    { header: "Priority", headerAr: "الأولوية", render: (r) => <Badge variant="secondary">{enumLabel(r.priority, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Administrative Tasks"
      titleAr="المهام الإدارية"
      columns={columns}
      fields={fields}
      useList={useListAdministrativeTasks}
      useCreate={useCreateAdministrativeTask}
      useUpdate={useUpdateAdministrativeTask}
      useDelete={useDeleteAdministrativeTask}
      getListQueryKey={getListAdministrativeTasksQueryKey}
      companyId={companyId}
    />
  );
}
