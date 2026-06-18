import {
  useListProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  getListProjectsQueryKey,
  useListBranches,
  useListCompanies,
  type Project,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { DocumentsRowAction } from "@/components/documents/documents-row-action";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

const STATUS = enumOptions(["planning", "active", "completed", "on_hold", "cancelled"]);

export default function ProjectsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const { data: branches } = useListBranches();
  const companyId = companies?.[0]?.id;
  const branchOptions = (branches ?? []).map((b) => ({ value: b.id, label: b.name }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "branchId", label: "Branch", labelAr: "الفرع", type: "select", options: branchOptions },
    { name: "location", label: "Location", labelAr: "الموقع" },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
    { name: "startDate", label: "Start Date", labelAr: "تاريخ البدء", type: "date" },
    { name: "endDate", label: "End Date", labelAr: "تاريخ الانتهاء", type: "date" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", required: true, options: STATUS },
  ];

  const columns: ResourceColumn<Project>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: "Location", headerAr: "الموقع", render: (r) => r.location ?? "-" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Projects"
      titleAr="المشاريع"
      columns={columns}
      fields={fields}
      useList={useListProjects}
      useCreate={useCreateProject}
      useUpdate={useUpdateProject}
      useDelete={useDeleteProject}
      getListQueryKey={getListProjectsQueryKey}
      companyId={companyId}
      rowActions={(r) => <DocumentsRowAction moduleKey="projects" sourceId={r.id} />}
    />
  );
}
