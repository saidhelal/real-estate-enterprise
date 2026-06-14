import {
  useListCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  getListCustomersQueryKey,
  useListBranches,
  useListCompanies,
  type Customer,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

const TYPE = [
  { value: "individual", label: "Individual" },
  { value: "company", label: "Company" },
];

export default function CustomersPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const { data: branches } = useListBranches();
  const companyId = companies?.[0]?.id;
  const branchOptions = (branches ?? []).map((b) => ({ value: b.id, label: b.name }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "fullName", label: "Full Name", labelAr: "الاسم الكامل", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", rtl: true },
    { name: "type", label: "Type", labelAr: "النوع", type: "select", required: true, options: TYPE },
    { name: "branchId", label: "Branch", labelAr: "الفرع", type: "select", options: branchOptions },
    { name: "nationalId", label: "National ID", labelAr: "الرقم الوطني" },
    { name: "phone", label: "Phone", labelAr: "الهاتف" },
    { name: "email", label: "Email", labelAr: "البريد الإلكتروني" },
    { name: "address", label: "Address", labelAr: "العنوان", type: "textarea" },
  ];

  const columns: ResourceColumn<Customer>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr ?? r.fullName : r.fullName) },
    { header: "Type", headerAr: "النوع", render: (r) => <Badge variant="secondary">{r.type}</Badge> },
    { header: "Phone", headerAr: "الهاتف", render: (r) => r.phone ?? "-" },
    { header: "Email", headerAr: "البريد الإلكتروني", render: (r) => r.email ?? "-" },
  ];

  return (
    <ResourceManager
      title="Customers"
      titleAr="العملاء"
      columns={columns}
      fields={fields}
      useList={useListCustomers}
      useCreate={useCreateCustomer}
      useUpdate={useUpdateCustomer}
      useDelete={useDeleteCustomer}
      getListQueryKey={getListCustomersQueryKey}
      companyId={companyId}
    />
  );
}
