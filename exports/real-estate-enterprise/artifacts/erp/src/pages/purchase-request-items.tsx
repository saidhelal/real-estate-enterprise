import {
  useListPurchaseRequestItems,
  useCreatePurchaseRequestItem,
  useUpdatePurchaseRequestItem,
  useDeletePurchaseRequestItem,
  getListPurchaseRequestItemsQueryKey,
  useListPurchaseRequests,
  useListCompanies,
  type PurchaseRequestItem,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function PurchaseRequestItemsPage() {
  useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: requestData } = useListPurchaseRequests({ pageSize: 200 });
  const requestOptions = (requestData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));

  const fields: ResourceField[] = [
    { name: "requestId", label: "Purchase Request", labelAr: "طلب الشراء", type: "select", options: requestOptions },
    { name: "itemCode", label: "Item Code", labelAr: "رمز الصنف" },
    { name: "description", label: "Description", labelAr: "الوصف", required: true },
    { name: "descriptionAr", label: "Description (Arabic)", labelAr: "الوصف بالعربية", rtl: true },
    { name: "unit", label: "Unit", labelAr: "الوحدة" },
    { name: "quantity", label: "Quantity", labelAr: "الكمية", type: "money" },
    { name: "estimatedPrice", label: "Estimated Price", labelAr: "السعر التقديري", type: "money" },
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<PurchaseRequestItem>[] = [
    { header: "Description", headerAr: "الوصف", render: (r) => <span className="font-medium">{r.description ?? "-"}</span> },
    { header: "Quantity", headerAr: "الكمية", render: (r) => r.quantity ?? "-" },
  ];

  return (
    <ResourceManager
      title="Purchase Request Items"
      titleAr="بنود طلب الشراء"
      columns={columns}
      fields={fields}
      useList={useListPurchaseRequestItems}
      useCreate={useCreatePurchaseRequestItem}
      useUpdate={useUpdatePurchaseRequestItem}
      useDelete={useDeletePurchaseRequestItem}
      getListQueryKey={getListPurchaseRequestItemsQueryKey}
      companyId={companyId}
    />
  );
}
