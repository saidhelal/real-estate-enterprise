import {
  useListGeneralServices,
  useCreateGeneralService,
  useUpdateGeneralService,
  useDeleteGeneralService,
  getListGeneralServicesQueryKey,
  useListCompanies,
  type GeneralService,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function GeneralServicesPage() {
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
      generatorKey: "generalService",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "title", label: "Title", labelAr: "العنوان", required: true },
    { name: "serviceType", label: "Service Type", labelAr: "نوع الخدمة", type: "select", options: enumOptions(["cleaning", "buffet", "security", "maintenance", "catering"]) },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
    { name: "location", label: "Location", labelAr: "المكان" },
    { name: "requestedByEmployeeId", label: "Requested By (Employee ID)", labelAr: "مقدم الطلب (معرّف الموظف)" },
    { name: "assignedToEmployeeId", label: "Assigned To (Employee ID)", labelAr: "مُسند إلى (معرّف الموظف)" },
    { name: "priority", label: "Priority", labelAr: "الأولوية", type: "select", options: enumOptions(["low", "medium", "high", "urgent"]) },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["requested", "in_progress", "completed", "cancelled"]) },
    { name: "serviceDate", label: "Service Date", labelAr: "تاريخ الخدمة", type: "date" },
    // Hospitality detail. The register serves cleaning and maintenance too, so
    // these stay optional — a cleaning request has no head-count.
    { name: "serviceTime", label: "Service Time", labelAr: "وقت الخدمة" },
    { name: "attendeesCount", label: "Attendees", labelAr: "عدد الأشخاص", type: "number" },
    { name: "requiredItems", label: "Required Items", labelAr: "المستلزمات المطلوبة", type: "textarea" },
    { name: "departmentId", label: "Requesting Department", labelAr: "الإدارة الطالبة" },
    { name: "meetingId", label: "Related Meeting", labelAr: "الاجتماع المرتبط" },
    { name: "cost", label: "Cost", labelAr: "التكلفة", type: "money" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<GeneralService>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Title", headerAr: "العنوان", render: (r) => r.title },
    { header: "Service Type", headerAr: "نوع الخدمة", render: (r) => <Badge variant="secondary">{enumLabel(r.serviceType, language)}</Badge> },
    { header: "When", headerAr: "الموعد", render: (r) => [r.serviceDate, r.serviceTime].filter(Boolean).join(" ") || "—" },
    { header: "Attendees", headerAr: "العدد", render: (r) => r.attendeesCount ?? "—" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="General Services"
      titleAr="الخدمات العامة"
      columns={columns}
      fields={fields}
      useList={useListGeneralServices}
      useCreate={useCreateGeneralService}
      useUpdate={useUpdateGeneralService}
      useDelete={useDeleteGeneralService}
      getListQueryKey={getListGeneralServicesQueryKey}
      companyId={companyId}
    />
  );
}
