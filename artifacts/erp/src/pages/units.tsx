import {
  useListUnits,
  useCreateUnit,
  useUpdateUnit,
  useDeleteUnit,
  getListUnitsQueryKey,
  useListProjects,
  useListPhases,
  useListBuildings,
  useListFloors,
  useListUnitTypes,
  useListUnitStatuses,
  useListBranches,
  useListCompanies,
  type Unit,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { DocumentsRowAction } from "@/components/documents/documents-row-action";
import { useLanguage } from "@/lib/language-provider";

export default function UnitsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const { data: projects } = useListProjects({ pageSize: 200 });
  const { data: phases } = useListPhases({ pageSize: 200 });
  const { data: buildings } = useListBuildings({ pageSize: 200 });
  const { data: floors } = useListFloors({ pageSize: 200 });
  const { data: unitTypes } = useListUnitTypes({ pageSize: 200 });
  const { data: unitStatuses } = useListUnitStatuses({ pageSize: 200 });
  const { data: branches } = useListBranches();
  const companyId = companies?.[0]?.id;
  const projectOptions = (projects?.data ?? []).map((p) => ({ value: p.id, label: p.name }));
  const phaseOptions = (phases?.data ?? []).map((p) => ({ value: p.id, label: p.name, parentValue: p.projectId }));
  const buildingOptions = (buildings?.data ?? []).map((b) => ({ value: b.id, label: b.name, parentValue: b.projectId, parentValues: { projectId: b.projectId, phaseId: b.phaseId ?? null } }));
  const floorOptions = (floors?.data ?? []).map((f) => ({ value: f.id, label: f.name, parentValue: f.buildingId }));
  const unitTypeOptions = (unitTypes?.data ?? []).map((u) => ({ value: u.id, label: u.name }));
  const unitStatusOptions = (unitStatuses?.data ?? []).map((u) => ({ value: u.id, label: u.name }));
  const branchOptions = (branches ?? []).map((b) => ({ value: b.id, label: b.name }));

  const fields: ResourceField[] = [
    { name: "projectId", label: "Project", labelAr: "المشروع", type: "select", required: true, searchable: true, options: projectOptions },
    { name: "phaseId", label: "Phase", labelAr: "المرحلة", type: "select", searchable: true, dependsOn: "projectId", options: phaseOptions },
    { name: "buildingId", label: "Building", labelAr: "المبنى", type: "select", required: true, searchable: true, dependsOn: ["projectId", "phaseId"], options: buildingOptions },
    { name: "floorId", label: "Floor", labelAr: "الطابق", type: "select", required: true, searchable: true, dependsOn: "buildingId", options: floorOptions },
    { name: "unitTypeId", label: "Unit Type", labelAr: "نوع الوحدة", type: "select", options: unitTypeOptions },
    { name: "unitStatusId", label: "Unit Status", labelAr: "حالة الوحدة", type: "select", options: unitStatusOptions },
    { name: "branchId", label: "Branch", labelAr: "الفرع", type: "select", options: branchOptions },
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "area", label: "Area", labelAr: "المساحة", type: "money" },
    { name: "bedrooms", label: "Bedrooms", labelAr: "غرف النوم", type: "number" },
    { name: "bathrooms", label: "Bathrooms", labelAr: "الحمامات", type: "number" },
    { name: "basePrice", label: "Base Price", labelAr: "السعر الأساسي", type: "money" },
  ];

  const columns: ResourceColumn<Unit>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: "Area", headerAr: "المساحة", render: (r) => r.area ?? "-" },
    { header: "Base Price", headerAr: "السعر الأساسي", render: (r) => r.basePrice ?? "-" },
  ];

  return (
    <ResourceManager
      title="Units"
      titleAr="الوحدات"
      columns={columns}
      fields={fields}
      useList={useListUnits}
      useCreate={useCreateUnit}
      useUpdate={useUpdateUnit}
      useDelete={useDeleteUnit}
      getListQueryKey={getListUnitsQueryKey}
      companyId={companyId}
      rowActions={(r) => <DocumentsRowAction moduleKey="units" sourceId={r.id} />}
    />
  );
}
