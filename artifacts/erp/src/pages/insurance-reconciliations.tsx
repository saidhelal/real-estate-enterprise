import {
  useListInsuranceReconciliations,
  useCreateInsuranceReconciliation,
  useUpdateInsuranceReconciliation,
  useDeleteInsuranceReconciliation,
  getListInsuranceReconciliationsQueryKey,
  useListCompanies,
  type InsuranceReconciliation,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function InsuranceReconciliationsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence engine on save; shown in the form
      // before saving and never typed in.
      generated: true,
      generatorKey: "insuranceReconciliation",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "period", label: "Period", labelAr: "الفترة", required: true },
    { name: "expectedAmount", label: "Expected Amount", labelAr: "المبلغ المتوقع", type: "money" },
    { name: "actualAmount", label: "Actual Amount", labelAr: "المبلغ الفعلي", type: "money" },
    { name: "difference", label: "Difference", labelAr: "الفرق", type: "money" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["pending","matched","unmatched","reconciled","closed"]) },
    { name: "reconciliationDate", label: "Reconciliation Date", labelAr: "تاريخ المطابقة", type: "date" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<InsuranceReconciliation>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Period", headerAr: "الفترة", render: (r) => r.period ?? "-" },
    { header: "Difference", headerAr: "الفرق", render: (r) => r.difference ?? "-" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Insurance Reconciliations"
      titleAr="المطابقات الشهرية"
      columns={columns}
      fields={fields}
      useList={useListInsuranceReconciliations}
      useCreate={useCreateInsuranceReconciliation}
      useUpdate={useUpdateInsuranceReconciliation}
      useDelete={useDeleteInsuranceReconciliation}
      getListQueryKey={getListInsuranceReconciliationsQueryKey}
      companyId={companyId}
    />
  );
}
