import {
  useListPenaltyRules,
  useCreatePenaltyRule,
  useUpdatePenaltyRule,
  useDeletePenaltyRule,
  getListPenaltyRulesQueryKey,
  useListCompanies,
  type PenaltyRule,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

const PENALTY_TYPE = enumOptions(["fixed", "percentage"]);

export default function PenaltyRulesPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "daysAfterDue", label: "Days After Due", labelAr: "الأيام بعد الاستحقاق", type: "number" },
    { name: "penaltyType", label: "Penalty Type", labelAr: "نوع الغرامة", type: "select", required: true, options: PENALTY_TYPE },
    { name: "penaltyValue", label: "Penalty Value", labelAr: "قيمة الغرامة", type: "money" },
  ];

  const columns: ResourceColumn<PenaltyRule>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: "Days After Due", headerAr: "الأيام بعد الاستحقاق", render: (r) => r.daysAfterDue },
    { header: "Type", headerAr: "النوع", render: (r) => <Badge variant="secondary">{enumLabel(r.penaltyType, language)}</Badge> },
    { header: "Value", headerAr: "القيمة", render: (r) => r.penaltyValue },
  ];

  return (
    <ResourceManager
      title="Penalty Rules"
      titleAr="قواعد الغرامات"
      columns={columns}
      fields={fields}
      useList={useListPenaltyRules}
      useCreate={useCreatePenaltyRule}
      useUpdate={useUpdatePenaltyRule}
      useDelete={useDeletePenaltyRule}
      getListQueryKey={getListPenaltyRulesQueryKey}
      companyId={companyId}
    />
  );
}
