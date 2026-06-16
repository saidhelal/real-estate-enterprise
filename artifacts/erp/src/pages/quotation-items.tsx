import {
  useListQuotationItems,
  useCreateQuotationItem,
  useUpdateQuotationItem,
  useDeleteQuotationItem,
  getListQuotationItemsQueryKey,
  useListSupplierQuotations,
  useListCompanies,
  type QuotationItem,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function QuotationItemsPage() {
  useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: quotationData } = useListSupplierQuotations({ pageSize: 200 });
  const quotationOptions = (quotationData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));

  const fields: ResourceField[] = [
    { name: "quotationId", label: "Quotation", labelAr: "عرض السعر", type: "select", options: quotationOptions },
    { name: "description", label: "Description", labelAr: "الوصف", required: true },
    { name: "unit", label: "Unit", labelAr: "الوحدة" },
    { name: "quantity", label: "Quantity", labelAr: "الكمية", type: "money" },
    { name: "unitPrice", label: "Unit Price", labelAr: "سعر الوحدة", type: "money" },
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<QuotationItem>[] = [
    { header: "Description", headerAr: "الوصف", render: (r) => <span className="font-medium">{r.description ?? "-"}</span> },
    { header: "Quantity", headerAr: "الكمية", render: (r) => r.quantity ?? "-" },
  ];

  return (
    <ResourceManager
      title="Quotation Items"
      titleAr="بنود عرض السعر"
      columns={columns}
      fields={fields}
      useList={useListQuotationItems}
      useCreate={useCreateQuotationItem}
      useUpdate={useUpdateQuotationItem}
      useDelete={useDeleteQuotationItem}
      getListQueryKey={getListQuotationItemsQueryKey}
      companyId={companyId}
    />
  );
}
