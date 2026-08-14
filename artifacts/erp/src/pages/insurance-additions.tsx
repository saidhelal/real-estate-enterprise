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
import { useLookupOptions } from "@/lib/lookups";
import { useLanguage } from "@/lib/language-provider";

export default function InsuranceAdditionsPage() {
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
      generatorKey: "insuranceAddition",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "employeeId", label: "Employee ID", labelAr: "معرّف الموظف", required: true },
    { name: "employeeInsuranceId", label: "Employee Insurance ID", labelAr: "معرّف تأمين الموظف" },
    { name: "additionDate", label: "Addition Date", labelAr: "تاريخ الإضافة", type: "date" },
    { name: "insuranceSalary", label: "Insurance Salary", labelAr: "راتب التأمين", type: "money" },
    { name: "formNumber", label: "Form Number", labelAr: "رقم النموذج" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: lk_approval_flow_status },
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
