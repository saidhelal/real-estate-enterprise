import {
  useListSupplierEvaluations,
  useCreateSupplierEvaluation,
  useUpdateSupplierEvaluation,
  useDeleteSupplierEvaluation,
  getListSupplierEvaluationsQueryKey,
  useListSuppliers,
  useListCompanies,
  type SupplierEvaluation,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function SupplierEvaluationsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: supplierData } = useListSuppliers({ pageSize: 200 });
  const supplierOptions = (supplierData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "supplierId", label: "Supplier", labelAr: "المورد", type: "select", options: supplierOptions },
    { name: "evaluationDate", label: "Evaluation Date", labelAr: "تاريخ التقييم", type: "date" },
    { name: "period", label: "Period", labelAr: "الفترة" },
    { name: "qualityScore", label: "Quality Score", labelAr: "درجة الجودة", type: "number" },
    { name: "deliveryScore", label: "Delivery Score", labelAr: "درجة التسليم", type: "number" },
    { name: "priceScore", label: "Price Score", labelAr: "درجة السعر", type: "number" },
    { name: "serviceScore", label: "Service Score", labelAr: "درجة الخدمة", type: "number" },
    { name: "overallScore", label: "Overall Score", labelAr: "الدرجة الإجمالية", type: "number" },
    { name: "evaluatedBy", label: "Evaluated By", labelAr: "قيّم بواسطة" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft", "submitted", "approved"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<SupplierEvaluation>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Quality Score", headerAr: "درجة الجودة", render: (r) => r.qualityScore ?? "-" },
  ];

  return (
    <ResourceManager
      title="Supplier Evaluations"
      titleAr="تقييمات الموردين"
      columns={columns}
      fields={fields}
      useList={useListSupplierEvaluations}
      useCreate={useCreateSupplierEvaluation}
      useUpdate={useUpdateSupplierEvaluation}
      useDelete={useDeleteSupplierEvaluation}
      getListQueryKey={getListSupplierEvaluationsQueryKey}
      companyId={companyId}
    />
  );
}
