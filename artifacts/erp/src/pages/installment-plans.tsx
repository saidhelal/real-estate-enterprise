import {
  useListInstallmentPlans,
  useCreateInstallmentPlan,
  useUpdateInstallmentPlan,
  useDeleteInstallmentPlan,
  getListInstallmentPlansQueryKey,
  useListContracts,
  useListCompanies,
  type InstallmentPlan,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";

const FREQUENCY = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semi_annual", label: "Semi Annual" },
  { value: "annual", label: "Annual" },
];

const STATUS = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function InstallmentPlansPage() {
  const { data: companies } = useListCompanies();
  const { data: contracts } = useListContracts({ pageSize: 200 });
  const companyId = companies?.[0]?.id;
  const contractOptions = (contracts?.data ?? []).map((c) => ({ value: c.id, label: c.code }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "contractId", label: "Contract", labelAr: "العقد", type: "select", required: true, options: contractOptions },
    { name: "totalAmount", label: "Total Amount", labelAr: "المبلغ الإجمالي", type: "money" },
    { name: "downPayment", label: "Down Payment", labelAr: "الدفعة المقدمة", type: "money" },
    { name: "numberOfInstallments", label: "Number of Installments", labelAr: "عدد الأقساط", type: "number" },
    { name: "frequency", label: "Frequency", labelAr: "التكرار", type: "select", required: true, options: FREQUENCY },
    { name: "startDate", label: "Start Date", labelAr: "تاريخ البدء", type: "date", required: true },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", required: true, options: STATUS },
  ];

  const columns: ResourceColumn<InstallmentPlan>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Total Amount", headerAr: "المبلغ الإجمالي", render: (r) => r.totalAmount },
    { header: "Installments", headerAr: "الأقساط", render: (r) => r.numberOfInstallments },
    { header: "Frequency", headerAr: "التكرار", render: (r) => r.frequency },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{r.status}</Badge> },
  ];

  return (
    <ResourceManager
      title="Installment Plans"
      titleAr="خطط الأقساط"
      columns={columns}
      fields={fields}
      useList={useListInstallmentPlans}
      useCreate={useCreateInstallmentPlan}
      useUpdate={useUpdateInstallmentPlan}
      useDelete={useDeleteInstallmentPlan}
      getListQueryKey={getListInstallmentPlansQueryKey}
      companyId={companyId}
    />
  );
}
