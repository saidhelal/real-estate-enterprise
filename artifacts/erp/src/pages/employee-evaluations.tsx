import {
  useListEmployeeEvaluations,
  useCreateEmployeeEvaluation,
  useUpdateEmployeeEvaluation,
  useDeleteEmployeeEvaluation,
  getListEmployeeEvaluationsQueryKey,
  useListEmployees,
  useListCompanies,
  type EmployeeEvaluation,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

const STATUS = enumOptions(["draft", "submitted", "approved", "completed"]);

export default function EmployeeEvaluationsPage() {
  const { language, t } = useLanguage();
  const { options: RATING } = useLookupOptions("evaluation_rating", ["excellent", "good", "average", "poor"]);
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: employees } = useListEmployees({ pageSize: 200 });

  const employeeOptions = (employees?.data ?? []).map((e) => ({
    value: e.id,
    label: `${e.code} - ${e.firstName} ${e.lastName}`,
    labelAr: `${e.code} - ${e.firstNameAr ?? e.firstName} ${e.lastNameAr ?? e.lastName}`,
  }));
  const employeeName = (id: string | null | undefined) => {
    const e = (employees?.data ?? []).find((x) => x.id === id);
    return e ? `${e.firstName} ${e.lastName}` : "-";
  };

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence on save; shown here beforehand.
      generated: true,
      generatorKey: "employeeEvaluation",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "employeeId", label: t("nav.employees"), type: "select", options: employeeOptions, required: true },
    { name: "evaluatorEmployeeId", label: t("hr.evaluator"), type: "select", options: employeeOptions },
    { name: "evaluationPeriod", label: t("hr.evaluation_period") },
    { name: "evaluationDate", label: t("hr.evaluation_date"), type: "date" },
    {
      name: "totalScore",
      label: t("hr.total_score"),
      type: "number",
      // Derived from the evaluation lines and the weights the company set on
      // its own KPIs. Typed by hand it was an opinion about an appraisal.
      generated: true,
      description: "Weighted average of the evaluation lines.",
      descriptionAr: "المتوسط المرجّح لبنود التقييم.",
    },
    { name: "rating", label: t("hr.rating"), type: "select", options: RATING },
    { name: "strengths", label: t("hr.strengths"), type: "textarea" },
    { name: "weaknesses", label: t("hr.weaknesses"), type: "textarea" },
    { name: "recommendations", label: t("hr.recommendations"), type: "textarea" },
    { name: "status", label: t("common.status"), type: "select", options: STATUS },
  ];

  const columns: ResourceColumn<EmployeeEvaluation>[] = [
    { header: t("common.code"), render: (r) => r.code },
    { header: t("nav.employees"), render: (r) => employeeName(r.employeeId) },
    { header: t("hr.evaluation_period"), render: (r) => r.evaluationPeriod ?? "-" },
    { header: t("hr.total_score"), render: (r) => r.totalScore },
    { header: t("hr.rating"), render: (r) => (r.rating ? enumLabel(r.rating, language) : "-") },
    {
      header: t("common.status"),
      render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge>,
    },
  ];

  return (
    <ResourceManager
      title={t("nav.employee_evaluations")}
      columns={columns}
      fields={fields}
      useList={useListEmployeeEvaluations}
      useCreate={useCreateEmployeeEvaluation}
      useUpdate={useUpdateEmployeeEvaluation}
      useDelete={useDeleteEmployeeEvaluation}
      getListQueryKey={getListEmployeeEvaluationsQueryKey}
      companyId={companyId}
    />
  );
}
