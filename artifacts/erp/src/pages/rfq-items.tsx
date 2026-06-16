import {
  useListRfqItems,
  useCreateRfqItem,
  useUpdateRfqItem,
  useDeleteRfqItem,
  getListRfqItemsQueryKey,
  useListRfqs,
  useListCompanies,
  type RfqItem,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function RfqItemsPage() {
  useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: rfqData } = useListRfqs({ pageSize: 200 });
  const rfqOptions = (rfqData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));

  const fields: ResourceField[] = [
    { name: "rfqId", label: "RFQ", labelAr: "طلب عرض السعر", type: "select", options: rfqOptions },
    { name: "description", label: "Description", labelAr: "الوصف", required: true },
    { name: "descriptionAr", label: "Description (Arabic)", labelAr: "الوصف بالعربية", rtl: true },
    { name: "unit", label: "Unit", labelAr: "الوحدة" },
    { name: "quantity", label: "Quantity", labelAr: "الكمية", type: "money" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<RfqItem>[] = [
    { header: "Description", headerAr: "الوصف", render: (r) => <span className="font-medium">{r.description ?? "-"}</span> },
    { header: "Quantity", headerAr: "الكمية", render: (r) => r.quantity ?? "-" },
  ];

  return (
    <ResourceManager
      title="RFQ Items"
      titleAr="بنود طلب عرض السعر"
      columns={columns}
      fields={fields}
      useList={useListRfqItems}
      useCreate={useCreateRfqItem}
      useUpdate={useUpdateRfqItem}
      useDelete={useDeleteRfqItem}
      getListQueryKey={getListRfqItemsQueryKey}
      companyId={companyId}
    />
  );
}
