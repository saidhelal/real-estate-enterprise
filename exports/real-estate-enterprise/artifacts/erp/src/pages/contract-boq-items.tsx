import {
  useListContractBoqItems,
  useCreateContractBoqItem,
  useUpdateContractBoqItem,
  useDeleteContractBoqItem,
  getListContractBoqItemsQueryKey,
  useListContractorContracts,
  useListBoqItems,
  useListCompanies,
  type ContractBoqItem,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function ContractBoqItemsPage() {
  useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: contractData } = useListContractorContracts({ pageSize: 200 });
  const contractOptions = (contractData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));
  const { data: boqItemData } = useListBoqItems({ pageSize: 200 });
  const boqItemOptions = (boqItemData?.data ?? []).map((o) => ({ value: o.id, label: o.itemCode }));

  const fields: ResourceField[] = [
    { name: "contractId", label: "Contract", labelAr: "العقد", type: "select", options: contractOptions },
    { name: "boqItemId", label: "BOQ Item", labelAr: "بند الجدول", type: "select", options: boqItemOptions },
    { name: "description", label: "Description", labelAr: "الوصف", required: true },
    { name: "descriptionAr", label: "Description (Arabic)", labelAr: "الوصف بالعربية", rtl: true },
    { name: "unit", label: "Unit", labelAr: "الوحدة" },
    { name: "contractQuantity", label: "Contract Quantity", labelAr: "الكمية التعاقدية", type: "money" },
    { name: "contractRate", label: "Contract Rate", labelAr: "السعر التعاقدي", type: "money" },
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money" },
  ];

  const columns: ResourceColumn<ContractBoqItem>[] = [
    { header: "Description", headerAr: "الوصف", render: (r) => <span className="font-medium">{r.description ?? "-"}</span> },
    { header: "Contract Quantity", headerAr: "الكمية التعاقدية", render: (r) => r.contractQuantity ?? "-" },
  ];

  return (
    <ResourceManager
      title="Contract BOQ Items"
      titleAr="بنود كميات العقد"
      columns={columns}
      fields={fields}
      useList={useListContractBoqItems}
      useCreate={useCreateContractBoqItem}
      useUpdate={useUpdateContractBoqItem}
      useDelete={useDeleteContractBoqItem}
      getListQueryKey={getListContractBoqItemsQueryKey}
      companyId={companyId}
    />
  );
}
