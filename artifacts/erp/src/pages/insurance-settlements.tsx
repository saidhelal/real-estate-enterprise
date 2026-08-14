import {
  useListInsuranceSettlements,
  useCreateInsuranceSettlement,
  useUpdateInsuranceSettlement,
  useDeleteInsuranceSettlement,
  getListInsuranceSettlementsQueryKey,
  useListCompanies,
  type InsuranceSettlement,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function InsuranceSettlementsPage() {
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
      generatorKey: "insuranceSettlement",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "serviceTerminationId", label: "Service Termination ID", labelAr: "معرّف إنهاء الخدمة" },
    { name: "employeeId", label: "Employee ID", labelAr: "معرّف الموظف", required: true },
    { name: "settlementAmount", label: "Settlement Amount", labelAr: "مبلغ التسوية", type: "money" },
    { name: "settlementDate", label: "Settlement Date", labelAr: "تاريخ التسوية", type: "date" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["pending","approved","paid","completed"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<InsuranceSettlement>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Employee ID", headerAr: "معرّف الموظف", render: (r) => r.employeeId ?? "-" },
    { header: "Amount", headerAr: "المبلغ", render: (r) => r.settlementAmount ?? "-" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Insurance Settlements"
      titleAr="التسويات التأمينية"
      columns={columns}
      fields={fields}
      useList={useListInsuranceSettlements}
      useCreate={useCreateInsuranceSettlement}
      useUpdate={useUpdateInsuranceSettlement}
      useDelete={useDeleteInsuranceSettlement}
      getListQueryKey={getListInsuranceSettlementsQueryKey}
      companyId={companyId}
    />
  );
}
