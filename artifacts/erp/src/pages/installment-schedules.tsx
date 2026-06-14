import {
  useListInstallmentSchedules,
  useCreateInstallmentSchedule,
  useUpdateInstallmentSchedule,
  useDeleteInstallmentSchedule,
  getListInstallmentSchedulesQueryKey,
  useListInstallmentPlans,
  useListCompanies,
  type InstallmentSchedule,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";

const STATUS = [
  { value: "pending", label: "Pending" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

export default function InstallmentSchedulesPage() {
  const { data: companies } = useListCompanies();
  const { data: plans } = useListInstallmentPlans({ pageSize: 200 });
  const companyId = companies?.[0]?.id;
  const planOptions = (plans?.data ?? []).map((p) => ({ value: p.id, label: p.code }));

  const fields: ResourceField[] = [
    { name: "planId", label: "Plan", labelAr: "الخطة", type: "select", required: true, options: planOptions },
    { name: "installmentNumber", label: "Installment Number", labelAr: "رقم القسط", type: "number" },
    { name: "dueDate", label: "Due Date", labelAr: "تاريخ الاستحقاق", type: "date", required: true },
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money" },
    { name: "paidAmount", label: "Paid Amount", labelAr: "المبلغ المدفوع", type: "money" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", required: true, options: STATUS },
  ];

  const columns: ResourceColumn<InstallmentSchedule>[] = [
    { header: "Installment #", headerAr: "رقم القسط", render: (r) => <span className="font-medium">{r.installmentNumber}</span> },
    { header: "Due Date", headerAr: "تاريخ الاستحقاق", render: (r) => r.dueDate },
    { header: "Amount", headerAr: "المبلغ", render: (r) => r.amount },
    { header: "Paid Amount", headerAr: "المبلغ المدفوع", render: (r) => r.paidAmount },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{r.status}</Badge> },
  ];

  return (
    <ResourceManager
      title="Installment Schedules"
      titleAr="جداول الأقساط"
      columns={columns}
      fields={fields}
      useList={useListInstallmentSchedules}
      useCreate={useCreateInstallmentSchedule}
      useUpdate={useUpdateInstallmentSchedule}
      useDelete={useDeleteInstallmentSchedule}
      getListQueryKey={getListInstallmentSchedulesQueryKey}
      companyId={companyId}
    />
  );
}
