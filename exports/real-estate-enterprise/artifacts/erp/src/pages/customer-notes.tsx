import {
  useListCustomerNotes,
  useCreateCustomerNote,
  useUpdateCustomerNote,
  useDeleteCustomerNote,
  getListCustomerNotesQueryKey,
  useListCustomers,
  useListUsers,
  useListCompanies,
  type CustomerNote,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function CustomerNotesPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const { data: customers } = useListCustomers({ pageSize: 200 });
  const { data: users } = useListUsers();
  const companyId = companies?.[0]?.id;
  const customerOptions = (customers?.data ?? []).map((c) => ({
    value: c.id,
    label: language === "ar" ? c.nameAr ?? c.fullName : c.fullName,
  }));
  const userOptions = (users ?? []).map((u) => ({ value: u.id, label: u.fullName ?? u.username }));

  const fields: ResourceField[] = [
    { name: "customerId", label: "Customer", labelAr: "العميل", type: "select", required: true, options: customerOptions },
    { name: "userId", label: "User", labelAr: "المستخدم", type: "select", options: userOptions },
    { name: "note", label: "Note", labelAr: "ملاحظة", type: "textarea", required: true },
  ];

  const columns: ResourceColumn<CustomerNote>[] = [
    { header: "Note", headerAr: "ملاحظة", render: (r) => <span className="font-medium">{r.note}</span> },
  ];

  return (
    <ResourceManager
      title="Customer Notes"
      titleAr="ملاحظات العملاء"
      columns={columns}
      fields={fields}
      useList={useListCustomerNotes}
      useCreate={useCreateCustomerNote}
      useUpdate={useUpdateCustomerNote}
      useDelete={useDeleteCustomerNote}
      getListQueryKey={getListCustomerNotesQueryKey}
      companyId={companyId}
    />
  );
}
