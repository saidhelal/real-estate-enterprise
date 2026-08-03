import {
  useListCustomerContacts,
  useCreateCustomerContact,
  useUpdateCustomerContact,
  useDeleteCustomerContact,
  getListCustomerContactsQueryKey,
  useListCustomers,
  useListCompanies,
  type CustomerContact,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function CustomerContactsPage() {
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
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "relation", label: "Relation", labelAr: "العلاقة" },
    { name: "phone", label: "Phone", labelAr: "الهاتف" },
    { name: "email", label: "Email", labelAr: "البريد الإلكتروني" },
  ];

  const columns: ResourceColumn<CustomerContact>[] = [
    { header: "Name", headerAr: "الاسم", render: (r) => <span className="font-medium">{r.name}</span> },
    { header: "Relation", headerAr: "العلاقة", render: (r) => r.relation ?? "-" },
    { header: "Phone", headerAr: "الهاتف", render: (r) => r.phone ?? "-" },
    { header: "Email", headerAr: "البريد الإلكتروني", render: (r) => r.email ?? "-" },
  ];

  return (
    <ResourceManager
      title="Customer Contacts"
      titleAr="جهات اتصال العملاء"
      columns={columns}
      fields={fields}
      useList={useListCustomerContacts}
      useCreate={useCreateCustomerContact}
      useUpdate={useUpdateCustomerContact}
      useDelete={useDeleteCustomerContact}
      getListQueryKey={getListCustomerContactsQueryKey}
      companyId={companyId}
    />
  );
}
