import {
  useListRfqs,
  useCreateRfq,
  useUpdateRfq,
  useDeleteRfq,
  getListRfqsQueryKey,
  useListPurchaseRequests,
  useListCompanies,
  type Rfq,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function RfqsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: requestData } = useListPurchaseRequests({ pageSize: 200 });
  const requestOptions = (requestData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "title", label: "Title", labelAr: "العنوان", required: true },
    { name: "titleAr", label: "Title (Arabic)", labelAr: "العنوان بالعربية", required: true, rtl: true },
    { name: "requestId", label: "Purchase Request", labelAr: "طلب الشراء", type: "select", options: requestOptions },
    { name: "issueDate", label: "Issue Date", labelAr: "تاريخ الإصدار", type: "date" },
    { name: "closeDate", label: "Close Date", labelAr: "تاريخ الإغلاق", type: "date" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft", "issued", "closed", "awarded", "cancelled"]) },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
  ];

  const columns: ResourceColumn<Rfq>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Title", headerAr: "العنوان", render: (r) => (language === "ar" ? r.titleAr : r.title) },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Issue Date", headerAr: "تاريخ الإصدار", render: (r) => r.issueDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="Requests for Quotation"
      titleAr="طلبات عروض الأسعار"
      columns={columns}
      fields={fields}
      useList={useListRfqs}
      useCreate={useCreateRfq}
      useUpdate={useUpdateRfq}
      useDelete={useDeleteRfq}
      getListQueryKey={getListRfqsQueryKey}
      companyId={companyId}
    />
  );
}
