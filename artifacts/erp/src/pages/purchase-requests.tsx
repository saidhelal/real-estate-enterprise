import {
  useListPurchaseRequests,
  useCreatePurchaseRequest,
  useUpdatePurchaseRequest,
  useDeletePurchaseRequest,
  getListPurchaseRequestsQueryKey,
  useListCompanies,
  type PurchaseRequest,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { Badge } from "@/components/ui/badge";

export default function PurchaseRequestsPage() {
  const { language } = useLanguage();
  const REQUEST_TYPE = enumOptions(["item", "service"]);
  const { options: PRIORITY } = useLookupOptions("service_priority", ["low", "medium", "high", "urgent"]);
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence on save; shown here beforehand.
      generated: true,
      generatorKey: "purchaseRequest",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "title", label: "Title", labelAr: "العنوان", required: true },
    { name: "titleAr", label: "Title (Arabic)", labelAr: "العنوان بالعربية", required: true, rtl: true },
    { name: "department", label: "Department", labelAr: "القسم" },
    { name: "requestType", label: "Request Type", labelAr: "نوع الطلب", type: "select", options: REQUEST_TYPE },
    { name: "requestDate", label: "Request Date", labelAr: "تاريخ الطلب", type: "date" },
    { name: "requiredDate", label: "Required Date", labelAr: "التاريخ المطلوب", type: "date" },
    { name: "priority", label: "Priority", labelAr: "الأولوية", type: "select", options: PRIORITY },
    { name: "budgetAmount", label: "Budget Amount", labelAr: "مبلغ الميزانية", type: "money" },
    { name: "estimatedAmount", label: "Estimated Amount", labelAr: "المبلغ التقديري", type: "money" },
    { name: "requestedBy", label: "Requested By", labelAr: "طلب بواسطة" },
    { name: "justification", label: "Justification", labelAr: "المبرر", type: "textarea" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft", "submitted", "approved", "rejected", "cancelled"]) },
  ];

  const columns: ResourceColumn<PurchaseRequest>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Title", headerAr: "العنوان", render: (r) => (language === "ar" ? r.titleAr : r.title) },
    { header: "Request Type", headerAr: "نوع الطلب", render: (r) => <Badge variant="secondary">{enumLabel(r.requestType, language)}</Badge> },
    { header: "Priority", headerAr: "الأولوية", render: (r) => <Badge variant="secondary">{enumLabel(r.priority, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Budget Amount", headerAr: "مبلغ الميزانية", render: (r) => r.budgetAmount ?? "-" },
  ];

  return (
    <ResourceManager
      title="Purchase Requests"
      titleAr="طلبات الشراء"
      columns={columns}
      fields={fields}
      useList={useListPurchaseRequests}
      useCreate={useCreatePurchaseRequest}
      useUpdate={useUpdatePurchaseRequest}
      useDelete={useDeletePurchaseRequest}
      getListQueryKey={getListPurchaseRequestsQueryKey}
      companyId={companyId}
    />
  );
}
