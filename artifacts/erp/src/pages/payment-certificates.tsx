import {
  useListPaymentCertificates,
  useCreatePaymentCertificate,
  useUpdatePaymentCertificate,
  useDeletePaymentCertificate,
  getListPaymentCertificatesQueryKey,
  useListContractorContracts,
  useListCompanies,
  type PaymentCertificate,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function PaymentCertificatesPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: contractData } = useListContractorContracts({ pageSize: 200 });
  const contractOptions = (contractData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "contractId", label: "Contract", labelAr: "العقد", type: "select", options: contractOptions },
    { name: "certificateNumber", label: "Certificate Number", labelAr: "رقم الشهادة" },
    { name: "periodFrom", label: "Period From", labelAr: "الفترة من", type: "date" },
    { name: "periodTo", label: "Period To", labelAr: "الفترة إلى", type: "date" },
    { name: "grossAmount", label: "Gross Amount", labelAr: "المبلغ الإجمالي", type: "money" },
    { name: "previousAmount", label: "Previous Amount", labelAr: "المبلغ السابق", type: "money" },
    { name: "currentAmount", label: "Current Amount", labelAr: "المبلغ الحالي", type: "money" },
    { name: "retentionAmount", label: "Retention Amount", labelAr: "مبلغ المحتجز", type: "money" },
    { name: "advanceRecovery", label: "Advance Recovery", labelAr: "استرداد الدفعة المقدمة", type: "money" },
    { name: "deductionsAmount", label: "Deductions Amount", labelAr: "مبلغ الخصومات", type: "money" },
    { name: "additionsAmount", label: "Additions Amount", labelAr: "مبلغ الإضافات", type: "money" },
    { name: "netAmount", label: "Net Amount", labelAr: "المبلغ الصافي", type: "money" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft", "submitted", "verified", "approved", "paid"]) },
    { name: "certificateDate", label: "Certificate Date", labelAr: "تاريخ الشهادة", type: "date" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<PaymentCertificate>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Gross Amount", headerAr: "المبلغ الإجمالي", render: (r) => r.grossAmount ?? "-" },
  ];

  return (
    <ResourceManager
      title="Payment Certificates"
      titleAr="شهادات الدفع"
      columns={columns}
      fields={fields}
      useList={useListPaymentCertificates}
      useCreate={useCreatePaymentCertificate}
      useUpdate={useUpdatePaymentCertificate}
      useDelete={useDeletePaymentCertificate}
      getListQueryKey={getListPaymentCertificatesQueryKey}
      companyId={companyId}
    />
  );
}
