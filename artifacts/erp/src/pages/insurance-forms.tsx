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
import { useLookupOptions } from "@/lib/lookups";
import { useLanguage } from "@/lib/language-provider";

export default function InsuranceFormsPage() {
  // Domain owned by the lookup engine. The literal is the fallback used
  // until the registry is seeded, so behaviour is unchanged either way.
  const { options: lk_approval_flow_status } = useLookupOptions("approval_flow_status", ["draft", "pending", "submitted", "approved", "rejected"]);
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
      generatorKey: "insuranceForm",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "formType", label: "Form Type", labelAr: "نوع النموذج", type: "select", options: enumOptions(["addition","exclusion","amendment"]) },
    { name: "formNumber", label: "Form Number", labelAr: "رقم النموذج" },
    { name: "employeeInsuranceId", label: "Employee Insurance ID", labelAr: "معرّف تأمين الموظف" },
    { name: "employeeId", label: "Employee ID", labelAr: "معرّف الموظف" },
    { name: "submissionDate", label: "Submission Date", labelAr: "تاريخ التقديم", type: "date" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: lk_approval_flow_status },
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
