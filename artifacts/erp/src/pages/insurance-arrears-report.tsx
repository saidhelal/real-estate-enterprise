import {
  useListInsuranceArrears,
  useCreateInsuranceArrear,
  useUpdateInsuranceArrear,
  useDeleteInsuranceArrear,
  getListInsuranceArrearsQueryKey,
  useListCompanies,
  type InsuranceArrear,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function InsuranceArrearsReportPage() {
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
      generatorKey: "insuranceArrear",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "period", label: "Period", labelAr: "الفترة" },
    { name: "subscriptionId", label: "Subscription ID", labelAr: "معرّف الاشتراك" },
    { name: "amount", label: "Amount", labelAr: "المبلغ", required: true, type: "money" },
    { name: "dueDate", label: "Due Date", labelAr: "تاريخ الاستحقاق", type: "date" },
    { name: "daysOverdue", label: "Days Overdue", labelAr: "أيام التأخير", type: "number" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["outstanding","partially_paid","paid"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<InsuranceArrear>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Period", headerAr: "الفترة", render: (r) => r.period ?? "-" },
    { header: "Amount", headerAr: "المبلغ", render: (r) => r.amount ?? "-" },
    { header: "Days Overdue", headerAr: "أيام التأخير", render: (r) => r.daysOverdue ?? "-" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Arrears Report"
      titleAr="تقرير المتأخرات"
      columns={columns}
      fields={fields}
      useList={useListInsuranceArrears}
      useCreate={useCreateInsuranceArrear}
      useUpdate={useUpdateInsuranceArrear}
      useDelete={useDeleteInsuranceArrear}
      getListQueryKey={getListInsuranceArrearsQueryKey}
      companyId={companyId}
      canCreate={false}
      canEdit={false}
      canDelete={false}
    />
  );
}
