import {
  useListRisks,
  useCreateRisk,
  useUpdateRisk,
  useDeleteRisk,
  getListRisksQueryKey,
  useListCompanies,
  type Risk,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

/**
 * Risk Register.
 *
 * The risks the organisation is carrying.
 *
 * Likelihood and impact are the inputs; the score and the level are computed
 * by the server on every write and are not editable here. A level someone
 * could type would make the register a collection of opinions rather than
 * something comparable across departments.
 *
 * Built on the shared ResourceManager, like every other register in the
 * system — the list, the form, the filters and the delete confirmation are
 * the same component, so this file describes the fields and nothing else.
 */
export default function RisksPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Code",
      labelAr: "الرمز",
      // Issued by the central sequence engine on save; the input is locked
      // and labelled so nobody types a number the system owns.
      generated: true,
      // Names the server-side sequence, so the form can show the number
      // before it is issued.
      generatorKey: "risk",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "title", label: "Risk", labelAr: "الخطر", required: true },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
    { name: "departmentId", label: "Department", labelAr: "الإدارة" },
    { name: "category", label: "Category", labelAr: "التصنيف", type: "select", options: enumOptions(["operational", "financial", "compliance", "strategic", "reputational", "safety", "it"]) },
    { name: "source", label: "Source", labelAr: "المصدر", type: "select", options: enumOptions(["audit", "incident", "assessment", "review", "external"]) },
    { name: "likelihood", label: "Likelihood (1-5)", labelAr: "الاحتمالية (١-٥)", type: "number", required: true },
    { name: "impact", label: "Impact (1-5)", labelAr: "الأثر (١-٥)", type: "number", required: true },
    { name: "ownerEmployeeId", label: "Owner (Employee ID)", labelAr: "المالك (معرّف الموظف)" },
    { name: "treatmentStrategy", label: "Strategy", labelAr: "استراتيجية المعالجة", type: "select", options: enumOptions(["avoid", "reduce", "transfer", "accept"]) },
    { name: "treatmentPlan", label: "Treatment Plan", labelAr: "خطة المعالجة", type: "textarea" },
    { name: "treatmentDueDate", label: "Treatment Due", labelAr: "موعد المعالجة", type: "date" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["identified", "assessed", "treating", "monitoring", "closed", "accepted"]) },
    { name: "nextReviewDate", label: "Next Review", labelAr: "المراجعة القادمة", type: "date" },
    { name: "exposureAmount", label: "Exposure", labelAr: "قيمة التعرض", type: "money" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<Risk>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Risk", headerAr: "الخطر", render: (r) => r.title },
    { header: "L x I", headerAr: "الاحتمالية × الأثر", render: (r) => `${r.likelihood} × ${r.impact} = ${r.riskScore}` },
    { header: "Level", headerAr: "مستوى الخطر", render: (r) => <Badge variant={r.riskLevel === "critical" || r.riskLevel === "high" ? "destructive" : "secondary"}>{enumLabel(r.riskLevel, language)}</Badge> },
    { header: "Reviewed", headerAr: "آخر مراجعة", render: (r) => (r.lastReviewedAt ? new Date(r.lastReviewedAt).toLocaleDateString() : "—") },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Risk Register"
      titleAr="سجل المخاطر"
      columns={columns}
      fields={fields}
      useList={useListRisks}
      useCreate={useCreateRisk}
      useUpdate={useUpdateRisk}
      useDelete={useDeleteRisk}
      getListQueryKey={getListRisksQueryKey}
      companyId={companyId}
    />
  );
}
