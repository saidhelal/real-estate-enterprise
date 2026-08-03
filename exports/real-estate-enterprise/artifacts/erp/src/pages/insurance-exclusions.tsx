import {
  useListInsuranceExclusions,
  useCreateInsuranceExclusion,
  useUpdateInsuranceExclusion,
  useDeleteInsuranceExclusion,
  getListInsuranceExclusionsQueryKey,
  useListCompanies,
  type InsuranceExclusion,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function InsuranceExclusionsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "employeeId", label: "Employee ID", labelAr: "معرّف الموظف", required: true },
    { name: "employeeInsuranceId", label: "Employee Insurance ID", labelAr: "معرّف تأمين الموظف" },
    { name: "exclusionDate", label: "Exclusion Date", labelAr: "تاريخ الاستبعاد", type: "date" },
    { name: "reason", label: "Reason", labelAr: "السبب", type: "select", options: enumOptions(["resignation","termination","retirement","death"]) },
    { name: "formNumber", label: "Form Number", labelAr: "رقم النموذج" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft","pending","submitted","approved","rejected"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<InsuranceExclusion>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Employee ID", headerAr: "معرّف الموظف", render: (r) => r.employeeId ?? "-" },
    { header: "Exclusion Date", headerAr: "تاريخ الاستبعاد", render: (r) => r.exclusionDate ?? "-" },
    { header: "Reason", headerAr: "السبب", render: (r) => <Badge variant="secondary">{enumLabel(r.reason, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Insurance Exclusions"
      titleAr="استبعادات الموظفين"
      columns={columns}
      fields={fields}
      useList={useListInsuranceExclusions}
      useCreate={useCreateInsuranceExclusion}
      useUpdate={useUpdateInsuranceExclusion}
      useDelete={useDeleteInsuranceExclusion}
      getListQueryKey={getListInsuranceExclusionsQueryKey}
      companyId={companyId}
    />
  );
}
