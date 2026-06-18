import {
  useListInsuranceForms,
  useCreateInsuranceForm,
  useUpdateInsuranceForm,
  useDeleteInsuranceForm,
  getListInsuranceFormsQueryKey,
  useListCompanies,
  type InsuranceForm,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function InsuranceFormsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "formType", label: "Form Type", labelAr: "نوع النموذج", type: "select", options: enumOptions(["addition","exclusion","amendment"]) },
    { name: "formNumber", label: "Form Number", labelAr: "رقم النموذج" },
    { name: "employeeInsuranceId", label: "Employee Insurance ID", labelAr: "معرّف تأمين الموظف" },
    { name: "employeeId", label: "Employee ID", labelAr: "معرّف الموظف" },
    { name: "submissionDate", label: "Submission Date", labelAr: "تاريخ التقديم", type: "date" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft","pending","submitted","approved","rejected"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<InsuranceForm>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Type", headerAr: "النوع", render: (r) => <Badge variant="secondary">{enumLabel(r.formType, language)}</Badge> },
    { header: "Form Number", headerAr: "رقم النموذج", render: (r) => r.formNumber ?? "-" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Insurance Forms"
      titleAr="نماذج التأمينات"
      columns={columns}
      fields={fields}
      useList={useListInsuranceForms}
      useCreate={useCreateInsuranceForm}
      useUpdate={useUpdateInsuranceForm}
      useDelete={useDeleteInsuranceForm}
      getListQueryKey={getListInsuranceFormsQueryKey}
      companyId={companyId}
    />
  );
}
