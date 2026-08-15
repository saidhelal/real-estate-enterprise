import {
  useListCertificateItems,
  useCreateCertificateItem,
  useUpdateCertificateItem,
  useDeleteCertificateItem,
  getListCertificateItemsQueryKey,
  useListPaymentCertificates,
  useListBoqItems,
  useListCompanies,
  type CertificateItem,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function CertificateItemsPage() {
  useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: certificateData } = useListPaymentCertificates({ pageSize: 200 });
  const certificateOptions = (certificateData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));
  const { data: boqItemData } = useListBoqItems({ pageSize: 200 });
  const boqItemOptions = (boqItemData?.data ?? []).map((o) => ({ value: o.id, label: o.itemCode }));

  const fields: ResourceField[] = [
    { name: "certificateId", label: "Certificate", labelAr: "المستخلص", type: "select", options: certificateOptions },
    { name: "boqItemId", label: "BOQ Item", labelAr: "بند الجدول", type: "select", options: boqItemOptions },
    { name: "description", label: "Description", labelAr: "الوصف", required: true },
    { name: "unit", label: "Unit", labelAr: "الوحدة" },
    { name: "contractQuantity", label: "Contract Quantity", labelAr: "الكمية التعاقدية", type: "money" },
    { name: "previousQuantity", label: "Previous Quantity", labelAr: "الكمية السابقة", type: "money" },
    { name: "currentQuantity", label: "Current Quantity", labelAr: "الكمية الحالية", type: "money" },
    {
      name: "cumulativeQuantity",
      label: "Cumulative Quantity",
      labelAr: "الكمية التراكمية",
      type: "money",
      // Previous + current for this line, computed on save.
      generated: true,
      description: "Previous quantity plus this period's.",
      descriptionAr: "الكمية السابقة مضافًا إليها كمية هذه الفترة.",
    },
    { name: "rate", label: "Rate", labelAr: "السعر", type: "money" },
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money" },
  ];

  const columns: ResourceColumn<CertificateItem>[] = [
    { header: "Description", headerAr: "الوصف", render: (r) => <span className="font-medium">{r.description ?? "-"}</span> },
    { header: "Contract Quantity", headerAr: "الكمية التعاقدية", render: (r) => r.contractQuantity ?? "-" },
  ];

  return (
    <ResourceManager
      title="Certificate Items"
      titleAr="بنود المستخلص"
      columns={columns}
      fields={fields}
      useList={useListCertificateItems}
      useCreate={useCreateCertificateItem}
      useUpdate={useUpdateCertificateItem}
      useDelete={useDeleteCertificateItem}
      getListQueryKey={getListCertificateItemsQueryKey}
      companyId={companyId}
    />
  );
}
