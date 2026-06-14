import {
  useListCustomerDocuments,
  useCreateCustomerDocument,
  useUpdateCustomerDocument,
  useDeleteCustomerDocument,
  getListCustomerDocumentsQueryKey,
  useListCustomers,
  useListCompanies,
  type CustomerDocument,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function CustomerDocumentsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const { data: customers } = useListCustomers({ pageSize: 200 });
  const companyId = companies?.[0]?.id;
  const customerOptions = (customers?.data ?? []).map((c) => ({
    value: c.id,
    label: language === "ar" ? c.nameAr ?? c.fullName : c.fullName,
  }));

  const fields: ResourceField[] = [
    { name: "customerId", label: "Customer", labelAr: "العميل", type: "select", required: true, options: customerOptions },
    { name: "docType", label: "Document Type", labelAr: "نوع المستند", required: true },
    { name: "docNumber", label: "Document Number", labelAr: "رقم المستند" },
    { name: "fileName", label: "File Name", labelAr: "اسم الملف" },
    { name: "issueDate", label: "Issue Date", labelAr: "تاريخ الإصدار", type: "date" },
    { name: "expiryDate", label: "Expiry Date", labelAr: "تاريخ الانتهاء", type: "date" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<CustomerDocument>[] = [
    { header: "Document Type", headerAr: "نوع المستند", render: (r) => <span className="font-medium">{r.docType}</span> },
    { header: "Document Number", headerAr: "رقم المستند", render: (r) => r.docNumber ?? "-" },
    { header: "File Name", headerAr: "اسم الملف", render: (r) => r.fileName ?? "-" },
    { header: "Expiry Date", headerAr: "تاريخ الانتهاء", render: (r) => r.expiryDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="Customer Documents"
      titleAr="مستندات العملاء"
      columns={columns}
      fields={fields}
      useList={useListCustomerDocuments}
      useCreate={useCreateCustomerDocument}
      useUpdate={useUpdateCustomerDocument}
      useDelete={useDeleteCustomerDocument}
      getListQueryKey={getListCustomerDocumentsQueryKey}
      companyId={companyId}
    />
  );
}
