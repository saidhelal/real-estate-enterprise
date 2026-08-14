import {
  useListVehicles,
  useCreateVehicle,
  useUpdateVehicle,
  useDeleteVehicle,
  getListVehiclesQueryKey,
  useListCompanies,
  type Vehicle,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function VehiclesPage() {
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
      generatorKey: "vehicle",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "plateNumber", label: "Plate Number", labelAr: "رقم اللوحة", required: true },
    { name: "make", label: "Make", labelAr: "الصانع" },
    { name: "model", label: "Model", labelAr: "الطراز" },
    { name: "modelYear", label: "Model Year", labelAr: "سنة الصنع", type: "money" },
    { name: "color", label: "Color", labelAr: "اللون" },
    { name: "vehicleType", label: "Vehicle Type", labelAr: "نوع المركبة", type: "select", options: enumOptions(["sedan", "suv", "pickup", "van", "bus", "truck"]) },
    { name: "ownershipType", label: "Ownership", labelAr: "الملكية", type: "select", options: enumOptions(["owned", "leased", "rented"]) },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["available", "in_use", "under_maintenance", "out_of_service"]) },
    { name: "assignedDriverId", label: "Assigned Driver ID", labelAr: "السائق المُكلّف (المعرّف)" },
    { name: "currentOdometer", label: "Odometer", labelAr: "عداد المسافة", type: "money" },
    { name: "registrationExpiry", label: "Registration Expiry", labelAr: "انتهاء الترخيص", type: "date" },
    { name: "insuranceExpiry", label: "Insurance Expiry", labelAr: "انتهاء التأمين", type: "date" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<Vehicle>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Plate", headerAr: "اللوحة", render: (r) => r.plateNumber },
    { header: "Type", headerAr: "النوع", render: (r) => <Badge variant="secondary">{enumLabel(r.vehicleType, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Vehicles"
      titleAr="المركبات"
      columns={columns}
      fields={fields}
      useList={useListVehicles}
      useCreate={useCreateVehicle}
      useUpdate={useUpdateVehicle}
      useDelete={useDeleteVehicle}
      getListQueryKey={getListVehiclesQueryKey}
      companyId={companyId}
    />
  );
}
