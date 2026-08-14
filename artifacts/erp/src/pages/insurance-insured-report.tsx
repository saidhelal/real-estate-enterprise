import {
  useListEmployeeInsurances,
  useCreateEmployeeInsurance,
  useUpdateEmployeeInsurance,
  useDeleteEmployeeInsurance,
  getListEmployeeInsurancesQueryKey,
  useListCompanies,
  type EmployeeInsurance,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function InsuranceInsuredReportPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Code",
      labelAr: "الرمز",
      // Issued by the central sequence engine on save; shown in the form
      // before saving and never typed in.
      generated: true,
      generatorKey: "employeeInsurance",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "employeeId", label: "Employee ID", labelAr: "معرّف الموظف", required: true },
    { name: "insuranceNumber", label: "Insurance Number", labelAr: "رقم التأمين" },
    { name: "insuranceAuthority", label: "Insurance Authority", labelAr: "جهة التأمين" },
    { name: "insuranceType", label: "Insurance Type", labelAr: "نوع التأمين", type: "select", options: enumOptions(["comprehensive","social_insurance","medical_insurance"]) },
    { name: "insuranceSalary", label: "Insurance Salary", labelAr: "راتب التأمين", type: "money" },
    { name: "basicSalary", label: "Basic Salary", labelAr: "الراتب الأساسي", type: "money" },
    { name: "subscriptionDate", label: "Subscription Date", labelAr: "تاريخ الاشتراك", type: "date" },
    { name: "insuranceOffice", label: "Insurance Office", labelAr: "مكتب التأمين" },
    { name: "insuranceStatus", label: "Status", labelAr: "الموقف التأميني", type: "select", options: enumOptions(["active","suspended","terminated","expired"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<EmployeeInsurance>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Employee ID", headerAr: "معرّف الموظف", render: (r) => r.employeeId ?? "-" },
    { header: "Insurance Number", headerAr: "رقم التأمين", render: (r) => r.insuranceNumber ?? "-" },
    { header: "Type", headerAr: "النوع", render: (r) => <Badge variant="secondary">{enumLabel(r.insuranceType, language)}</Badge> },
    { header: "Status", headerAr: "الموقف", render: (r) => <Badge variant="secondary">{enumLabel(r.insuranceStatus, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Insured Employees Report"
      titleAr="تقرير الموظفين المؤمن عليهم"
      columns={columns}
      fields={fields}
      useList={useListEmployeeInsurances}
      useCreate={useCreateEmployeeInsurance}
      useUpdate={useUpdateEmployeeInsurance}
      useDelete={useDeleteEmployeeInsurance}
      getListQueryKey={getListEmployeeInsurancesQueryKey}
      companyId={companyId}
      canCreate={false}
      canEdit={false}
      canDelete={false}
    />
  );
}
