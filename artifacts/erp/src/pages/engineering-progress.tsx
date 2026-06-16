import {
  useListEngineeringProgresss,
  useCreateEngineeringProgress,
  useUpdateEngineeringProgress,
  useDeleteEngineeringProgress,
  getListEngineeringProgresssQueryKey,
  useListProjects,
  useListPhases,
  useListBuildings,
  useListFloors,
  useListDesignPackages,
  useListCompanies,
  type EngineeringProgress,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function EngineeringProgresssPage() {
  useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: projectData } = useListProjects({ pageSize: 200 });
  const projectOptions = (projectData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: phaseData } = useListPhases({ pageSize: 200 });
  const phaseOptions = (phaseData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: buildingData } = useListBuildings({ pageSize: 200 });
  const buildingOptions = (buildingData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: floorData } = useListFloors({ pageSize: 200 });
  const floorOptions = (floorData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: designPackageData } = useListDesignPackages({ pageSize: 200 });
  const designPackageOptions = (designPackageData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "projectId", label: "Project", labelAr: "المشروع", type: "select", options: projectOptions },
    { name: "phaseId", label: "Phase", labelAr: "المرحلة", type: "select", options: phaseOptions },
    { name: "buildingId", label: "Building", labelAr: "المبنى", type: "select", options: buildingOptions },
    { name: "floorId", label: "Floor", labelAr: "الطابق", type: "select", options: floorOptions },
    { name: "designPackageId", label: "Design Package", labelAr: "حزمة التصميم", type: "select", options: designPackageOptions },
    { name: "progressPercent", label: "Progress %", labelAr: "نسبة الإنجاز", type: "number" },
    { name: "asOfDate", label: "As Of Date", labelAr: "حتى تاريخ", type: "date" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<EngineeringProgress>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Progress %", headerAr: "نسبة الإنجاز", render: (r) => r.progressPercent ?? "-" },
  ];

  return (
    <ResourceManager
      title="Engineering Progress"
      titleAr="التقدم الهندسي"
      columns={columns}
      fields={fields}
      useList={useListEngineeringProgresss}
      useCreate={useCreateEngineeringProgress}
      useUpdate={useUpdateEngineeringProgress}
      useDelete={useDeleteEngineeringProgress}
      getListQueryKey={getListEngineeringProgresssQueryKey}
      companyId={companyId}
    />
  );
}
