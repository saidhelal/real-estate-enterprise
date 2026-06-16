import {
  useListAdvanceRecoverys,
  useCreateAdvanceRecovery,
  useUpdateAdvanceRecovery,
  useDeleteAdvanceRecovery,
  getListAdvanceRecoverysQueryKey,
  useListAdvancePayments,
  useListPaymentCertificates,
  useListCompanies,
  type AdvanceRecovery,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function AdvanceRecoverysPage() {
  useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: advanceData } = useListAdvancePayments({ pageSize: 200 });
  const advanceOptions = (advanceData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));
  const { data: certificateData } = useListPaymentCertificates({ pageSize: 200 });
  const certificateOptions = (certificateData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "advanceId", label: "Advance Payment", labelAr: "الدفعة المقدمة", type: "select", options: advanceOptions },
    { name: "certificateId", label: "Certificate", labelAr: "الشهادة", type: "select", options: certificateOptions },
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money" },
    { name: "recoveryDate", label: "Recovery Date", labelAr: "تاريخ الاسترداد", type: "date" },
  ];

  const columns: ResourceColumn<AdvanceRecovery>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Amount", headerAr: "المبلغ", render: (r) => r.amount ?? "-" },
  ];

  return (
    <ResourceManager
      title="Advance Recoveries"
      titleAr="استردادات الدفعات المقدمة"
      columns={columns}
      fields={fields}
      useList={useListAdvanceRecoverys}
      useCreate={useCreateAdvanceRecovery}
      useUpdate={useUpdateAdvanceRecovery}
      useDelete={useDeleteAdvanceRecovery}
      getListQueryKey={getListAdvanceRecoverysQueryKey}
      companyId={companyId}
    />
  );
}
