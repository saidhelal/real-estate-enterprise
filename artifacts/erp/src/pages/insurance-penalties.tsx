import {
  useListInsurancePenalties,
  useCreateInsurancePenalty,
  useUpdateInsurancePenalty,
  useDeleteInsurancePenalty,
  getListInsurancePenaltiesQueryKey,
  useListCompanies,
  type InsurancePenalty,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function InsurancePenaltiesPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "penaltyType", label: "Penalty Type", labelAr: "نوع الغرامة", type: "select", options: enumOptions(["late_payment","underpayment","other"]) },
    { name: "branchId", label: "Branch ID", labelAr: "معرّف الفرع" },
    { name: "subscriptionId", label: "Subscription ID", labelAr: "معرّف الاشتراك" },
    { name: "amount", label: "Amount", labelAr: "المبلغ", required: true, type: "money" },
    { name: "penaltyDate", label: "Penalty Date", labelAr: "تاريخ الغرامة", type: "date" },
    { name: "reason", label: "Reason", labelAr: "السبب" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["pending","paid","cancelled"]) },
    { name: "paymentDate", label: "Payment Date", labelAr: "تاريخ السداد", type: "date" },
    { name: "reference", label: "Reference", labelAr: "المرجع" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<InsurancePenalty>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Type", headerAr: "النوع", render: (r) => <Badge variant="secondary">{enumLabel(r.penaltyType, language)}</Badge> },
    { header: "Amount", headerAr: "المبلغ", render: (r) => r.amount ?? "-" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Insurance Penalties"
      titleAr="الغرامات"
      columns={columns}
      fields={fields}
      useList={useListInsurancePenalties}
      useCreate={useCreateInsurancePenalty}
      useUpdate={useUpdateInsurancePenalty}
      useDelete={useDeleteInsurancePenalty}
      getListQueryKey={getListInsurancePenaltiesQueryKey}
      companyId={companyId}
    />
  );
}
