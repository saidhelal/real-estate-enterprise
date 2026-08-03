import {
  useListFloors,
  useCreateFloor,
  useUpdateFloor,
  useDeleteFloor,
  getListFloorsQueryKey,
  useListProjects,
  useListPhases,
  useListBuildings,
  useListCompanies,
  type Floor,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function FloorsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const { data: projects } = useListProjects({ pageSize: 200 });
  const { data: phases } = useListPhases({ pageSize: 200 });
  const { data: buildings } = useListBuildings({ pageSize: 200 });
  const companyId = companies?.[0]?.id;
  const projectOptions = (projects?.data ?? []).map((p) => ({ value: p.id, label: p.name }));
  const phaseOptions = (phases?.data ?? []).map((p) => ({ value: p.id, label: p.name, parentValue: p.projectId }));
  const buildingOptions = (buildings?.data ?? []).map((b) => ({ value: b.id, label: b.name, parentValue: b.projectId, parentValues: { projectId: b.projectId, phaseId: b.phaseId ?? null } }));

  const fields: ResourceField[] = [
    { name: "projectId", label: "Project", labelAr: "المشروع", type: "select", required: true, searchable: true, options: projectOptions },
    { name: "phaseId", label: "Phase", labelAr: "المرحلة", type: "select", searchable: true, dependsOn: "projectId", options: phaseOptions },
    { name: "buildingId", label: "Building", labelAr: "المبنى", type: "select", required: true, searchable: true, dependsOn: ["projectId", "phaseId"], options: buildingOptions },
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "floorNumber", label: "Floor Number", labelAr: "رقم الطابق", type: "number" },
  ];

  const columns: ResourceColumn<Floor>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: "Floor Number", headerAr: "رقم الطابق", render: (r) => r.floorNumber ?? "-" },
  ];

  return (
    <ResourceManager
      title="Floors"
      titleAr="الطوابق"
      columns={columns}
      fields={fields}
      useList={useListFloors}
      useCreate={useCreateFloor}
      useUpdate={useUpdateFloor}
      useDelete={useDeleteFloor}
      getListQueryKey={getListFloorsQueryKey}
      companyId={companyId}
    />
  );
}
