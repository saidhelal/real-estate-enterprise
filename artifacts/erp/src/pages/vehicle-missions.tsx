import {
  useListVehicleMissions,
  useCreateVehicleMission,
  useUpdateVehicleMission,
  useDeleteVehicleMission,
  getListVehicleMissionsQueryKey,
  useListCompanies,
  type VehicleMission,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function VehicleMissionsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "purpose", label: "Purpose", labelAr: "الغرض", required: true },
    { name: "vehicleId", label: "Vehicle ID", labelAr: "معرّف المركبة" },
    { name: "driverId", label: "Driver ID", labelAr: "معرّف السائق" },
    { name: "destination", label: "Destination", labelAr: "الوجهة" },
    { name: "requestedByEmployeeId", label: "Requested By (Employee ID)", labelAr: "مقدم الطلب (معرّف الموظف)" },
    { name: "startAt", label: "Start At", labelAr: "وقت البدء", type: "date" },
    { name: "endAt", label: "End At", labelAr: "وقت الانتهاء", type: "date" },
    { name: "startOdometer", label: "Start Odometer", labelAr: "عداد البداية", type: "money" },
    { name: "endOdometer", label: "End Odometer", labelAr: "عداد النهاية", type: "money" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["planned", "in_progress", "completed", "cancelled"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<VehicleMission>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Purpose", headerAr: "الغرض", render: (r) => r.purpose },
    { header: "Destination", headerAr: "الوجهة", render: (r) => r.destination ?? "—" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Vehicle Missions"
      titleAr="مأموريات المركبات"
      columns={columns}
      fields={fields}
      useList={useListVehicleMissions}
      useCreate={useCreateVehicleMission}
      useUpdate={useUpdateVehicleMission}
      useDelete={useDeleteVehicleMission}
      getListQueryKey={getListVehicleMissionsQueryKey}
      companyId={companyId}
    />
  );
}
