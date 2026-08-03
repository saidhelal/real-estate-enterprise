import {
  useListContractDocuments,
  useCreateContractDocument,
  useUpdateContractDocument,
  useDeleteContractDocument,
  getListContractDocumentsQueryKey,
  useListContracts,
  useListCompanies,
  type ContractDocument,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";

export default function ContractDocumentsPage() {
  const { data: companies } = useListCompanies();
  const { data: contracts } = useListContracts({ pageSize: 200 });
  const companyId = companies?.[0]?.id;
  const contractOptions = (contracts?.data ?? []).map((c) => ({ value: c.id, label: c.code }));

  const fields: ResourceField[] = [
    { name: "contractId", label: "Contract", labelAr: "العقد", type: "select", required: true, options: contractOptions },
    { name: "docType", label: "Document Type", labelAr: "نوع المستند", required: true },
    { name: "docNumber", label: "Document Number", labelAr: "رقم المستند" },
    { name: "fileName", label: "File Name", labelAr: "اسم الملف" },
    { name: "issueDate", label: "Issue Date", labelAr: "تاريخ الإصدار", type: "date" },
    { name: "expiryDate", label: "Expiry Date", labelAr: "تاريخ الانتهاء", type: "date" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<ContractDocument>[] = [
    { header: "Document Type", headerAr: "نوع المستند", render: (r) => <span className="font-medium">{r.docType}</span> },
    { header: "Document Number", headerAr: "رقم المستند", render: (r) => r.docNumber ?? "-" },
    { header: "File Name", headerAr: "اسم الملف", render: (r) => r.fileName ?? "-" },
    { header: "Expiry Date", headerAr: "تاريخ الانتهاء", render: (r) => r.expiryDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="Contract Documents"
      titleAr="مستندات العقود"
      columns={columns}
      fields={fields}
      useList={useListContractDocuments}
      useCreate={useCreateContractDocument}
      useUpdate={useUpdateContractDocument}
      useDelete={useDeleteContractDocument}
      getListQueryKey={getListContractDocumentsQueryKey}
      companyId={companyId}
    />
  );
}
