import {
  useListBuildings,
  useCreateBuilding,
  useUpdateBuilding,
  useDeleteBuilding,
  getListBuildingsQueryKey,
  useListProjects,
  useListPhases,
  useListCompanies,
  type Building,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function BuildingsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const { data: projects } = useListProjects({ pageSize: 200 });
  const { data: phases } = useListPhases({ pageSize: 200 });
  const companyId = companies?.[0]?.id;
  const projectOptions = (projects?.data ?? []).map((p) => ({ value: p.id, label: p.name }));
  const phaseOptions = (phases?.data ?? []).map((p) => ({ value: p.id, label: p.name, parentValue: p.projectId }));

  const fields: ResourceField[] = [
    { name: "projectId", label: "Project", labelAr: "المشروع", type: "select", required: true, searchable: true, options: projectOptions },
    { name: "phaseId", label: "Phase", labelAr: "المرحلة", type: "select", searchable: true, dependsOn: "projectId", options: phaseOptions },
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "floorsCount", label: "Floors Count", labelAr: "عدد الطوابق", type: "number" },
  ];

  const columns: ResourceColumn<Building>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: "Floors Count", headerAr: "عدد الطوابق", render: (r) => r.floorsCount ?? "-" },
  ];

  return (
    <ResourceManager
      title="Buildings"
      titleAr="المباني"
      columns={columns}
      fields={fields}
      useList={useListBuildings}
      useCreate={useCreateBuilding}
      useUpdate={useUpdateBuilding}
      useDelete={useDeleteBuilding}
      getListQueryKey={getListBuildingsQueryKey}
      companyId={companyId}
    />
  );
}
