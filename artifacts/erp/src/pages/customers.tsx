import {
  useListCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  getListCustomersQueryKey,
  useListBranches,
  useListCompanies,
  useListUsers,
  type Customer,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { DocumentsRowAction } from "@/components/documents/documents-row-action";
import { Badge } from "@/components/ui/badge";
import { enumLabel, CRM_CLASSIFICATIONS } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { useLanguage } from "@/lib/language-provider";

export default function CustomersPage() {
  const { language } = useLanguage();
  const { options: TYPE } = useLookupOptions("customer_type", ["individual", "company"]);
  const { options: CLASSIFICATION } = useLookupOptions("customer_classification", [
    ...CRM_CLASSIFICATIONS,
  ]);
  const { data: companies } = useListCompanies();
  const { data: branches } = useListBranches();
  const { data: users } = useListUsers();
  const companyId = companies?.[0]?.id;
  const branchOptions = (branches ?? []).map((b) => ({ value: b.id, label: b.name }));
  const userOptions = (users ?? []).map((u) => ({ value: u.id, label: u.fullName }));
  const userName = (id: string | null | undefined): string =>
    id ? userOptions.find((u) => u.value === id)?.label ?? "-" : "-";

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "fullName", label: "Full Name", labelAr: "الاسم الكامل", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", rtl: true },
    { name: "type", label: "Type", labelAr: "النوع", type: "select", required: true, options: TYPE },
    { name: "branchId", label: "Branch", labelAr: "الفرع", type: "select", options: branchOptions },
    { name: "nationalId", label: "National ID", labelAr: "الرقم الوطني" },
    { name: "passport", label: "Passport", labelAr: "جواز السفر" },
    { name: "companyName", label: "Company Name", labelAr: "اسم الشركة" },
    { name: "taxNumber", label: "Tax Number", labelAr: "الرقم الضريبي" },
    { name: "commercialRegistration", label: "Commercial Registration", labelAr: "السجل التجاري" },
    { name: "phone", label: "Phone", labelAr: "الهاتف" },
    { name: "email", label: "Email", labelAr: "البريد الإلكتروني" },
    { name: "address", label: "Address", labelAr: "العنوان", type: "textarea" },
    { name: "classification", label: "Classification", labelAr: "التصنيف", type: "select", options: CLASSIFICATION },
    { name: "assignedToUserId", label: "Assigned Rep", labelAr: "المندوب المسؤول", type: "select", options: userOptions },
  ];

  const columns: ResourceColumn<Customer>[] = [
    {
      header: "Code",
      headerAr: "الرمز",
      render: (r) => <span className="font-medium">{r.code}</span>,
    },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr ?? r.fullName : r.fullName) },
    { header: "Type", headerAr: "النوع", render: (r) => <Badge variant="secondary">{enumLabel(r.type, language)}</Badge> },
    {
      header: "Classification",
      headerAr: "التصنيف",
      render: (r) =>
        r.classification ? <Badge variant="outline">{enumLabel(r.classification, language)}</Badge> : "-",
    },
    { header: "Assigned Rep", headerAr: "المندوب المسؤول", render: (r) => userName(r.assignedToUserId) },
    { header: "Phone", headerAr: "الهاتف", render: (r) => r.phone ?? "-" },
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
      rowActions={(r) => <DocumentsRowAction moduleKey="customers" sourceId={r.id} />}
    />
  );
}
