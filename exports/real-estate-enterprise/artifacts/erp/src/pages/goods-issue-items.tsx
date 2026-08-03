import {
  useListGoodsIssueItems,
  useCreateGoodsIssueItem,
  useUpdateGoodsIssueItem,
  useDeleteGoodsIssueItem,
  getListGoodsIssueItemsQueryKey,
  useListGoodsIssues,
  useListInventoryItems,
  useListWarehouseLocations,
  useListCompanies,
  type GoodsIssueItem,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function GoodsIssueItemsPage() {
  useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: issueData } = useListGoodsIssues({ pageSize: 200 });
  const issueOptions = (issueData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));
  const { data: itemData } = useListInventoryItems({ pageSize: 200 });
  const itemOptions = (itemData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: locationData } = useListWarehouseLocations({ pageSize: 200 });
  const locationOptions = (locationData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    { name: "issueId", label: "Goods Issue", labelAr: "إذن الصرف", type: "select", options: issueOptions },
    { name: "itemId", label: "Item", labelAr: "الصنف", type: "select", options: itemOptions },
    { name: "locationId", label: "Location", labelAr: "الموقع", type: "select", options: locationOptions },
    { name: "quantity", label: "Quantity", labelAr: "الكمية", type: "number" },
    { name: "unitCost", label: "Unit Cost", labelAr: "تكلفة الوحدة", type: "money" },
    { name: "totalCost", label: "Total Cost", labelAr: "التكلفة الإجمالية", type: "money" },
    { name: "batchNumber", label: "Batch Number", labelAr: "رقم الدفعة" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<GoodsIssueItem>[] = [
    { header: "Goods Issue", headerAr: "إذن الصرف", render: (r) => <span className="font-medium">{r.issueId ?? "-"}</span> },
    { header: "Unit Cost", headerAr: "تكلفة الوحدة", render: (r) => r.unitCost ?? "-" },
  ];

  return (
    <ResourceManager
      title="Goods Issue Items"
      titleAr="بنود إذن الصرف"
      columns={columns}
      fields={fields}
      useList={useListGoodsIssueItems}
      useCreate={useCreateGoodsIssueItem}
      useUpdate={useUpdateGoodsIssueItem}
      useDelete={useDeleteGoodsIssueItem}
      getListQueryKey={getListGoodsIssueItemsQueryKey}
      companyId={companyId}
    />
  );
}
