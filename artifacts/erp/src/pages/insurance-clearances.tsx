import {
  useListInsuranceClearances,
  useCreateInsuranceClearance,
  useUpdateInsuranceClearance,
  useDeleteInsuranceClearance,
  getListInsuranceClearancesQueryKey,
  useListCompanies,
  type InsuranceClearance,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function InsuranceClearancesPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "employeeId", label: "Employee ID", labelAr: "معرّف الموظف", required: true },
    { name: "serviceTerminationId", label: "Service Termination ID", labelAr: "معرّف إنهاء الخدمة" },
    { name: "clearanceDate", label: "Clearance Date", labelAr: "تاريخ المخالصة", type: "date" },
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["pending","approved","cleared","completed"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<InsuranceClearance>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Employee ID", headerAr: "معرّف الموظف", render: (r) => r.employeeId ?? "-" },
    { header: "Clearance Date", headerAr: "تاريخ المخالصة", render: (r) => r.clearanceDate ?? "-" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Insurance Clearances"
      titleAr="المخالصات"
      columns={columns}
      fields={fields}
      useList={useListInsuranceClearances}
      useCreate={useCreateInsuranceClearance}
      useUpdate={useUpdateInsuranceClearance}
      useDelete={useDeleteInsuranceClearance}
      getListQueryKey={getListInsuranceClearancesQueryKey}
      companyId={companyId}
    />
  );
}
