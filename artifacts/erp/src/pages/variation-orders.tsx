import {
  useListVariationOrders,
  useCreateVariationOrder,
  useUpdateVariationOrder,
  useDeleteVariationOrder,
  getListVariationOrdersQueryKey,
  useListContractorContracts,
  useListCompanies,
  type VariationOrder,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function VariationOrdersPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: contractData } = useListContractorContracts({ pageSize: 200 });
  const contractOptions = (contractData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence on save; shown here beforehand.
      generated: true,
      generatorKey: "variationOrder",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "contractId", label: "Contract", labelAr: "العقد", type: "select", options: contractOptions },
    { name: "title", label: "Title", labelAr: "العنوان", required: true },
    { name: "titleAr", label: "Title (Arabic)", labelAr: "العنوان بالعربية", rtl: true },
    { name: "variationType", label: "Variation Type", labelAr: "نوع التغيير", type: "select", options: enumOptions(["addition", "deduction"]) },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft", "submitted", "approved", "rejected"]) },
    { name: "requestDate", label: "Request Date", labelAr: "تاريخ الطلب", type: "date" },
    { name: "approvedDate", label: "Approved Date", labelAr: "تاريخ الاعتماد", type: "date" },
  ];

  const columns: ResourceColumn<VariationOrder>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Title", headerAr: "العنوان", render: (r) => (language === "ar" ? r.titleAr : r.title) },
    { header: "Variation Type", headerAr: "نوع التغيير", render: (r) => <Badge variant="secondary">{enumLabel(r.variationType, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Amount", headerAr: "المبلغ", render: (r) => r.amount ?? "-" },
  ];

  return (
    <ResourceManager
      title="Variation Orders"
      titleAr="أوامر التغيير"
      columns={columns}
      fields={fields}
      useList={useListVariationOrders}
      useCreate={useCreateVariationOrder}
      useUpdate={useUpdateVariationOrder}
      useDelete={useDeleteVariationOrder}
      getListQueryKey={getListVariationOrdersQueryKey}
      companyId={companyId}
    />
  );
}
