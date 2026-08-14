import {
  useListServiceTerminations,
  useCreateServiceTermination,
  useUpdateServiceTermination,
  useDeleteServiceTermination,
  getListServiceTerminationsQueryKey,
  useListCompanies,
  type ServiceTermination,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function ServiceTerminationsPage() {
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
      generatorKey: "serviceTermination",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "employeeId", label: "Employee ID", labelAr: "معرّف الموظف", required: true },
    { name: "employeeInsuranceId", label: "Employee Insurance ID", labelAr: "معرّف تأمين الموظف" },
    { name: "terminationDate", label: "Termination Date", labelAr: "تاريخ إنهاء الخدمة", type: "date" },
    { name: "reason", label: "Reason", labelAr: "السبب", type: "select", options: enumOptions(["resignation","termination","retirement","death"]) },
    { name: "lastWorkingDay", label: "Last Working Day", labelAr: "آخر يوم عمل", type: "date" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["open","pending","completed","closed"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<ServiceTermination>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Employee ID", headerAr: "معرّف الموظف", render: (r) => r.employeeId ?? "-" },
    { header: "Termination Date", headerAr: "تاريخ إنهاء الخدمة", render: (r) => r.terminationDate ?? "-" },
    { header: "Reason", headerAr: "السبب", render: (r) => <Badge variant="secondary">{enumLabel(r.reason, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Service Terminations"
      titleAr="إنهاء الخدمة"
      columns={columns}
      fields={fields}
      useList={useListServiceTerminations}
      useCreate={useCreateServiceTermination}
      useUpdate={useUpdateServiceTermination}
      useDelete={useDeleteServiceTermination}
      getListQueryKey={getListServiceTerminationsQueryKey}
      companyId={companyId}
    />
  );
}
