import {
  useListBoqQuantityRevisions,
  useCreateBoqQuantityRevision,
  useUpdateBoqQuantityRevision,
  useDeleteBoqQuantityRevision,
  getListBoqQuantityRevisionsQueryKey,
  useListBoqItems,
  useListCompanies,
  type BoqQuantityRevision,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function BoqQuantityRevisionsPage() {
  useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: boqItemData } = useListBoqItems({ pageSize: 200 });
  const boqItemOptions = (boqItemData?.data ?? []).map((o) => ({ value: o.id, label: o.itemCode }));

  const fields: ResourceField[] = [
    { name: "boqItemId", label: "BOQ Item", labelAr: "بند الجدول", type: "select", required: true, options: boqItemOptions },
    { name: "previousQuantity", label: "Previous Quantity", labelAr: "الكمية السابقة", type: "money" },
    { name: "newQuantity", label: "New Quantity", labelAr: "الكمية الجديدة", type: "money" },
    { name: "reason", label: "Reason", labelAr: "السبب", type: "textarea" },
    { name: "revisionDate", label: "Revision Date", labelAr: "تاريخ المراجعة", type: "date" },
  ];

  const columns: ResourceColumn<BoqQuantityRevision>[] = [
    { header: "BOQ Item", headerAr: "بند الجدول", render: (r) => <span className="font-medium">{r.boqItemId ?? "-"}</span> },
    { header: "Revision Date", headerAr: "تاريخ المراجعة", render: (r) => r.revisionDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="BOQ Quantity Revisions"
      titleAr="مراجعات كميات الجدول"
      columns={columns}
      fields={fields}
      useList={useListBoqQuantityRevisions}
      useCreate={useCreateBoqQuantityRevision}
      useUpdate={useUpdateBoqQuantityRevision}
      useDelete={useDeleteBoqQuantityRevision}
      getListQueryKey={getListBoqQuantityRevisionsQueryKey}
      companyId={companyId}
    />
  );
}
