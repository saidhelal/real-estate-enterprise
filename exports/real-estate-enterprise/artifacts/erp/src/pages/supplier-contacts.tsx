import {
  useListSupplierContacts,
  useCreateSupplierContact,
  useUpdateSupplierContact,
  useDeleteSupplierContact,
  getListSupplierContactsQueryKey,
  useListSuppliers,
  useListCompanies,
  type SupplierContact,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function SupplierContactsPage() {
  useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: supplierData } = useListSuppliers({ pageSize: 200 });
  const supplierOptions = (supplierData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    { name: "supplierId", label: "Supplier", labelAr: "المورد", type: "select", options: supplierOptions },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "position", label: "Position", labelAr: "المنصب" },
    { name: "email", label: "Email", labelAr: "البريد الإلكتروني" },
    { name: "phone", label: "Phone", labelAr: "الهاتف" },
    { name: "isPrimary", label: "Primary", labelAr: "أساسي", type: "boolean" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<SupplierContact>[] = [
    { header: "Supplier", headerAr: "المورد", render: (r) => <span className="font-medium">{r.supplierId ?? "-"}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => r.name },
  ];

  return (
    <ResourceManager
      title="Supplier Contacts"
      titleAr="جهات اتصال الموردين"
      columns={columns}
      fields={fields}
      useList={useListSupplierContacts}
      useCreate={useCreateSupplierContact}
      useUpdate={useUpdateSupplierContact}
      useDelete={useDeleteSupplierContact}
      getListQueryKey={getListSupplierContactsQueryKey}
      companyId={companyId}
    />
  );
}
