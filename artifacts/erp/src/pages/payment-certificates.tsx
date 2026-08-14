import {
  useListPaymentCertificates,
  useCreatePaymentCertificate,
  useUpdatePaymentCertificate,
  useDeletePaymentCertificate,
  getListPaymentCertificatesQueryKey,
  useListContractorContracts,
  useListProjects,
  useListBoqItems,
  useListWorkProgressUpdates,
  useListVariationOrders,
  useListRetentions,
  useListAdvanceRecoverys,
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
  const { data: projectData } = useListProjects({ pageSize: 200 });
  const projectOptions = (projectData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: boqItemData } = useListBoqItems({ pageSize: 200 });
  const boqItemOptions = (boqItemData?.data ?? []).map((o) => ({ value: o.id, label: o.itemCode }));
  const { data: progressUpdateData } = useListWorkProgressUpdates({ pageSize: 200 });
  const progressUpdateOptions = (progressUpdateData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));
  const { data: variationOrderData } = useListVariationOrders({ pageSize: 200 });
  const variationOrderOptions = (variationOrderData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));
  const { data: retentionData } = useListRetentions({ pageSize: 200 });
  const retentionOptions = (retentionData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));
  const { data: advanceRecoveryData } = useListAdvanceRecoverys({ pageSize: 200 });
  const advanceRecoveryOptions = (advanceRecoveryData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence on save; shown here beforehand.
      generated: true,
      generatorKey: "paymentCertificate",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "contractId", label: "Contract", labelAr: "العقد", type: "select", options: contractOptions },
    { name: "projectId", label: "Project", labelAr: "المشروع", type: "select", options: projectOptions },
    { name: "boqItemId", label: "BOQ Item", labelAr: "بند الجدول", type: "select", options: boqItemOptions },
    { name: "progressUpdateId", label: "Progress Update", labelAr: "تحديث التقدم", type: "select", options: progressUpdateOptions },
    { name: "variationOrderId", label: "Change Order", labelAr: "أمر التغيير", type: "select", options: variationOrderOptions },
    { name: "retentionId", label: "Retention", labelAr: "المحتجز", type: "select", options: retentionOptions },
    { name: "advanceRecoveryId", label: "Advance Recovery", labelAr: "استرداد الدفعة المقدمة", type: "select", options: advanceRecoveryOptions },
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
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft", "submitted", "reviewed", "approved", "posted", "paid", "closed"]) },
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
      titleAr="مستخلصات المقاولين"
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
