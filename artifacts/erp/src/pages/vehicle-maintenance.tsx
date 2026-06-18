import {
  useListVehicleMaintenance,
  useCreateVehicleMaintenance,
  useUpdateVehicleMaintenance,
  useDeleteVehicleMaintenance,
  getListVehicleMaintenanceQueryKey,
  useListCompanies,
  type VehicleMaintenance,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function VehicleMaintenancePage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "vehicleId", label: "Vehicle ID", labelAr: "معرّف المركبة" },
    { name: "logType", label: "Log Type", labelAr: "نوع السجل", type: "select", options: enumOptions(["fuel", "maintenance", "repair", "inspection"]) },
    { name: "serviceDate", label: "Service Date", labelAr: "تاريخ الخدمة", type: "date" },
    { name: "odometer", label: "Odometer", labelAr: "عداد المسافة", type: "money" },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
    { name: "vendorName", label: "Vendor", labelAr: "المورّد" },
    { name: "fuelLiters", label: "Fuel (Liters)", labelAr: "الوقود (لتر)", type: "money" },
    { name: "cost", label: "Cost", labelAr: "التكلفة", type: "money" },
    { name: "nextServiceDate", label: "Next Service Date", labelAr: "موعد الخدمة القادمة", type: "date" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["scheduled", "in_progress", "completed", "cancelled"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<VehicleMaintenance>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Type", headerAr: "النوع", render: (r) => <Badge variant="secondary">{enumLabel(r.logType, language)}</Badge> },
    { header: "Vendor", headerAr: "المورّد", render: (r) => r.vendorName ?? "—" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Vehicle Maintenance"
      titleAr="صيانة المركبات"
      columns={columns}
      fields={fields}
      useList={useListVehicleMaintenance}
      useCreate={useCreateVehicleMaintenance}
      useUpdate={useUpdateVehicleMaintenance}
      useDelete={useDeleteVehicleMaintenance}
      getListQueryKey={getListVehicleMaintenanceQueryKey}
      companyId={companyId}
    />
  );
}
