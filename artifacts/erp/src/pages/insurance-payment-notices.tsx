import {
  useListInsurancePaymentNotices,
  useCreateInsurancePaymentNotice,
  useUpdateInsurancePaymentNotice,
  useDeleteInsurancePaymentNotice,
  getListInsurancePaymentNoticesQueryKey,
  useListCompanies,
  type InsurancePaymentNotice,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function InsurancePaymentNoticesPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "noticeNumber", label: "Notice Number", labelAr: "رقم الإشعار" },
    { name: "subscriptionId", label: "Subscription ID", labelAr: "معرّف الاشتراك" },
    { name: "period", label: "Period", labelAr: "الفترة" },
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money" },
    { name: "noticeDate", label: "Notice Date", labelAr: "تاريخ الإشعار", type: "date" },
    { name: "dueDate", label: "Due Date", labelAr: "تاريخ الاستحقاق", type: "date" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["open","paid","overdue"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<InsurancePaymentNotice>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Notice Number", headerAr: "رقم الإشعار", render: (r) => r.noticeNumber ?? "-" },
    { header: "Amount", headerAr: "المبلغ", render: (r) => r.amount ?? "-" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Insurance Payment Notices"
      titleAr="إشعارات السداد"
      columns={columns}
      fields={fields}
      useList={useListInsurancePaymentNotices}
      useCreate={useCreateInsurancePaymentNotice}
      useUpdate={useUpdateInsurancePaymentNotice}
      useDelete={useDeleteInsurancePaymentNotice}
      getListQueryKey={getListInsurancePaymentNoticesQueryKey}
      companyId={companyId}
    />
  );
}
