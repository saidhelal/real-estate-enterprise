import {
  useListBoqItems,
  useCreateBoqItem,
  useUpdateBoqItem,
  useDeleteBoqItem,
  getListBoqItemsQueryKey,
  useListBoqs,
  useListCompanies,
  type BoqItem,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function BoqItemsPage() {
  useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: boqData } = useListBoqs({ pageSize: 200 });
  const boqOptions = (boqData?.data ?? []).map((o) => ({ value: o.id, label: o.title }));

  const fields: ResourceField[] = [
    { name: "boqId", label: "BOQ", labelAr: "جدول الكميات", type: "select", required: true, options: boqOptions },
    { name: "itemCode", label: "Item Code", labelAr: "رمز البند", required: true },
    { name: "description", label: "Description", labelAr: "الوصف", required: true },
    { name: "descriptionAr", label: "Description (Arabic)", labelAr: "الوصف بالعربية", rtl: true },
    { name: "unit", label: "Unit", labelAr: "الوحدة" },
    { name: "quantity", label: "Quantity", labelAr: "الكمية", type: "money" },
    { name: "unitPrice", label: "Unit Price", labelAr: "سعر الوحدة", type: "money" },
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money" },
  ];

  const columns: ResourceColumn<BoqItem>[] = [
    { header: "Item Code", headerAr: "رمز البند", render: (r) => <span className="font-medium">{r.itemCode ?? "-"}</span> },
  ];

  return (
    <ResourceManager
      title="BOQ Items"
      titleAr="بنود الكميات"
      columns={columns}
      fields={fields}
      useList={useListBoqItems}
      useCreate={useCreateBoqItem}
      useUpdate={useUpdateBoqItem}
      useDelete={useDeleteBoqItem}
      getListQueryKey={getListBoqItemsQueryKey}
      companyId={companyId}
    />
  );
}
