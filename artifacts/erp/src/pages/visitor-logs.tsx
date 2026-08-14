import {
  useListVisitorLogs,
  useCreateVisitorLog,
  useUpdateVisitorLog,
  useDeleteVisitorLog,
  getListVisitorLogsQueryKey,
  useListCompanies,
  type VisitorLog,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function VisitorLogsPage() {
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
      generatorKey: "visitorLog",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "visitorName", label: "Visitor Name", labelAr: "اسم الزائر", required: true },
    { name: "idNumber", label: "ID Number", labelAr: "رقم الهوية" },
    { name: "visitorCompany", label: "Visitor Company", labelAr: "جهة الزائر" },
    { name: "phone", label: "Phone", labelAr: "الهاتف" },
    { name: "hostEmployeeId", label: "Host (Employee ID)", labelAr: "المضيف (معرّف الموظف)" },
    { name: "purpose", label: "Purpose", labelAr: "الغرض", type: "textarea" },
    { name: "permitNumber", label: "Permit Number", labelAr: "رقم التصريح" },
    { name: "permitStatus", label: "Permit Status", labelAr: "حالة التصريح", type: "select", options: enumOptions(["pending", "approved", "rejected", "expired"]) },
    { name: "badgeNumber", label: "Badge Number", labelAr: "رقم البطاقة" },
    { name: "checkInAt", label: "Check-in At", labelAr: "وقت الدخول", type: "date" },
    { name: "checkOutAt", label: "Check-out At", labelAr: "وقت الخروج", type: "date" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["registered", "checked_in", "checked_out", "cancelled"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<VisitorLog>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Visitor", headerAr: "الزائر", render: (r) => r.visitorName },
    { header: "Permit", headerAr: "التصريح", render: (r) => <Badge variant="secondary">{enumLabel(r.permitStatus, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Visitor Logs"
      titleAr="سجل الزوار"
      columns={columns}
      fields={fields}
      useList={useListVisitorLogs}
      useCreate={useCreateVisitorLog}
      useUpdate={useUpdateVisitorLog}
      useDelete={useDeleteVisitorLog}
      getListQueryKey={getListVisitorLogsQueryKey}
      companyId={companyId}
    />
  );
}
