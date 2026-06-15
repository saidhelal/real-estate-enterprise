import {
  useListPhases,
  useCreatePhase,
  useUpdatePhase,
  useDeletePhase,
  getListPhasesQueryKey,
  useListProjects,
  useListCompanies,
  type Phase,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

const STATUS = enumOptions(["planning", "active", "completed", "on_hold", "cancelled"]);

export default function PhasesPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const { data: projects } = useListProjects({ pageSize: 200 });
  const companyId = companies?.[0]?.id;
  const projectOptions = (projects?.data ?? []).map((p) => ({ value: p.id, label: p.name }));

  const fields: ResourceField[] = [
    { name: "projectId", label: "Project", labelAr: "المشروع", type: "select", required: true, options: projectOptions },
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "startDate", label: "Start Date", labelAr: "تاريخ البدء", type: "date" },
    { name: "endDate", label: "End Date", labelAr: "تاريخ الانتهاء", type: "date" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", required: true, options: STATUS },
  ];

  const columns: ResourceColumn<Phase>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: "Start Date", headerAr: "تاريخ البدء", render: (r) => r.startDate ?? "-" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Phases"
      titleAr="المراحل"
      columns={columns}
      fields={fields}
      useList={useListPhases}
      useCreate={useCreatePhase}
      useUpdate={useUpdatePhase}
      useDelete={useDeletePhase}
      getListQueryKey={getListPhasesQueryKey}
      companyId={companyId}
    />
  );
}
