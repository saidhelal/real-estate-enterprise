import {
  useListLeadConversions,
  useCreateLeadConversion,
  useUpdateLeadConversion,
  useDeleteLeadConversion,
  getListLeadConversionsQueryKey,
  useListLeads,
  useListCustomers,
  useListUsers,
  useListCompanies,
  type LeadConversion,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";

export default function LeadConversionsPage() {
  const { data: companies } = useListCompanies();
  const { data: leads } = useListLeads({ pageSize: 200 });
  const { data: customers } = useListCustomers({ pageSize: 200 });
  const { data: users } = useListUsers();
  const companyId = companies?.[0]?.id;

  const leadOptions = (leads?.data ?? []).map((l) => ({ value: l.id, label: l.fullName }));
  const customerOptions = (customers?.data ?? []).map((c) => ({ value: c.id, label: c.fullName }));
  const userOptions = (users ?? []).map((u) => ({ value: u.id, label: u.fullName ?? u.username }));

  const fields: ResourceField[] = [
    { name: "leadId", label: "Lead", labelAr: "العميل المحتمل", type: "select", required: true, options: leadOptions },
    { name: "customerId", label: "Customer", labelAr: "العميل", type: "select", required: true, options: customerOptions },
    { name: "convertedByUserId", label: "Converted By", labelAr: "حول بواسطة", type: "select", options: userOptions },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<LeadConversion>[] = [
    { header: "Lead", headerAr: "العميل المحتمل", render: (r) => r.leadId },
    { header: "Customer", headerAr: "العميل", render: (r) => r.customerId },
    { header: "Notes", headerAr: "ملاحظات", render: (r) => r.notes ?? "-" },
  ];

  return (
    <ResourceManager
      title="Lead Conversions"
      titleAr="تحويلات العملاء المحتملين"
      columns={columns}
      fields={fields}
      useList={useListLeadConversions}
      useCreate={useCreateLeadConversion}
      useUpdate={useUpdateLeadConversion}
      useDelete={useDeleteLeadConversion}
      getListQueryKey={getListLeadConversionsQueryKey}
      companyId={companyId}
    />
  );
}
