import {
  useListInsuranceSubscriptions,
  useCreateInsuranceSubscription,
  useUpdateInsuranceSubscription,
  useDeleteInsuranceSubscription,
  getListInsuranceSubscriptionsQueryKey,
  useListCompanies,
  type InsuranceSubscription,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function InsuranceSubscriptionsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "period", label: "Period", labelAr: "الفترة", required: true },
    { name: "branchId", label: "Branch ID", labelAr: "معرّف الفرع" },
    { name: "dueDate", label: "Due Date", labelAr: "تاريخ الاستحقاق", type: "date" },
    { name: "employerShare", label: "Employer Share", labelAr: "حصة صاحب العمل", type: "money" },
    { name: "employeeShare", label: "Employee Share", labelAr: "حصة الموظف", type: "money" },
    { name: "totalAmount", label: "Total Amount", labelAr: "إجمالي المبلغ", required: true, type: "money" },
    { name: "employeeCount", label: "Employees", labelAr: "عدد الموظفين", type: "number" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["pending","paid","cancelled"]) },
    { name: "paymentDate", label: "Payment Date", labelAr: "تاريخ السداد", type: "date" },
    { name: "paymentMethod", label: "Payment Method", labelAr: "طريقة السداد" },
    { name: "reference", label: "Reference", labelAr: "المرجع" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<InsuranceSubscription>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Period", headerAr: "الفترة", render: (r) => r.period ?? "-" },
    { header: "Total", headerAr: "الإجمالي", render: (r) => r.totalAmount ?? "-" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Insurance Subscriptions"
      titleAr="الاشتراكات الشهرية"
      columns={columns}
      fields={fields}
      useList={useListInsuranceSubscriptions}
      useCreate={useCreateInsuranceSubscription}
      useUpdate={useUpdateInsuranceSubscription}
      useDelete={useDeleteInsuranceSubscription}
      getListQueryKey={getListInsuranceSubscriptionsQueryKey}
      companyId={companyId}
    />
  );
}
