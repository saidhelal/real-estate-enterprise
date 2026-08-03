import {
  useListInsuranceAdditions,
  useCreateInsuranceAddition,
  useUpdateInsuranceAddition,
  useDeleteInsuranceAddition,
  getListInsuranceAdditionsQueryKey,
  useListCompanies,
  type InsuranceAddition,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function InsuranceAdditionsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "employeeId", label: "Employee ID", labelAr: "معرّف الموظف", required: true },
    { name: "employeeInsuranceId", label: "Employee Insurance ID", labelAr: "معرّف تأمين الموظف" },
    { name: "additionDate", label: "Addition Date", labelAr: "تاريخ الإضافة", type: "date" },
    { name: "insuranceSalary", label: "Insurance Salary", labelAr: "راتب التأمين", type: "money" },
    { name: "formNumber", label: "Form Number", labelAr: "رقم النموذج" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft","pending","submitted","approved","rejected"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<InsuranceAddition>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Employee ID", headerAr: "معرّف الموظف", render: (r) => r.employeeId ?? "-" },
    { header: "Addition Date", headerAr: "تاريخ الإضافة", render: (r) => r.additionDate ?? "-" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Insurance Additions"
      titleAr="إضافات الموظفين"
      columns={columns}
      fields={fields}
      useList={useListInsuranceAdditions}
      useCreate={useCreateInsuranceAddition}
      useUpdate={useUpdateInsuranceAddition}
      useDelete={useDeleteInsuranceAddition}
      getListQueryKey={getListInsuranceAdditionsQueryKey}
      companyId={companyId}
    />
  );
}
