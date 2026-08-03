import {
  useListInspectionRequests,
  useCreateInspectionRequest,
  useUpdateInspectionRequest,
  useDeleteInspectionRequest,
  getListInspectionRequestsQueryKey,
  useListProjects,
  useListPhases,
  useListBuildings,
  useListCompanies,
  type InspectionRequest,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function InspectionRequestsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: projectData } = useListProjects({ pageSize: 200 });
  const projectOptions = (projectData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: phaseData } = useListPhases({ pageSize: 200 });
  const phaseOptions = (phaseData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: buildingData } = useListBuildings({ pageSize: 200 });
  const buildingOptions = (buildingData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "projectId", label: "Project", labelAr: "المشروع", type: "select", options: projectOptions },
    { name: "phaseId", label: "Phase", labelAr: "المرحلة", type: "select", options: phaseOptions },
    { name: "buildingId", label: "Building", labelAr: "المبنى", type: "select", options: buildingOptions },
    { name: "inspectionType", label: "Inspection Type", labelAr: "نوع الفحص" },
    { name: "requestedBy", label: "Requested By", labelAr: "مقدم الطلب" },
    { name: "requestDate", label: "Request Date", labelAr: "تاريخ الطلب", type: "date" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["pending", "in_progress", "completed", "cancelled"]) },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
  ];

  const columns: ResourceColumn<InspectionRequest>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Request Date", headerAr: "تاريخ الطلب", render: (r) => r.requestDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="Inspection Requests"
      titleAr="طلبات الفحص"
      columns={columns}
      fields={fields}
      useList={useListInspectionRequests}
      useCreate={useCreateInspectionRequest}
      useUpdate={useUpdateInspectionRequest}
      useDelete={useDeleteInspectionRequest}
      getListQueryKey={getListInspectionRequestsQueryKey}
      companyId={companyId}
    />
  );
}
