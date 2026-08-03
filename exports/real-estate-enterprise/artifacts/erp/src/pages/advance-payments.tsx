import {
  useListAdvancePayments,
  useCreateAdvancePayment,
  useUpdateAdvancePayment,
  useDeleteAdvancePayment,
  getListAdvancePaymentsQueryKey,
  useListContractorContracts,
  useListCompanies,
  type AdvancePayment,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function AdvancePaymentsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: contractData } = useListContractorContracts({ pageSize: 200 });
  const contractOptions = (contractData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "contractId", label: "Contract", labelAr: "العقد", type: "select", options: contractOptions },
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money" },
    { name: "paymentDate", label: "Payment Date", labelAr: "تاريخ الدفع", type: "date" },
    { name: "recoveryPercent", label: "Recovery %", labelAr: "نسبة الاسترداد", type: "money" },
    { name: "recoveredAmount", label: "Recovered Amount", labelAr: "المبلغ المُسترَد", type: "money" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["pending", "paid", "recovered"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<AdvancePayment>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Amount", headerAr: "المبلغ", render: (r) => r.amount ?? "-" },
  ];

  return (
    <ResourceManager
      title="Advance Payments"
      titleAr="الدفعات المقدمة"
      columns={columns}
      fields={fields}
      useList={useListAdvancePayments}
      useCreate={useCreateAdvancePayment}
      useUpdate={useUpdateAdvancePayment}
      useDelete={useDeleteAdvancePayment}
      getListQueryKey={getListAdvancePaymentsQueryKey}
      companyId={companyId}
    />
  );
}
