import {
  useListCostEstimates,
  useCreateCostEstimate,
  useUpdateCostEstimate,
  useDeleteCostEstimate,
  getListCostEstimatesQueryKey,
  useListProjects,
  useListBoqs,
  useListCompanies,
  type CostEstimate,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { Badge } from "@/components/ui/badge";

export default function CostEstimatesPage() {
  const { language } = useLanguage();
  const { options: STATUS } = useLookupOptions("submittal_status", ["draft", "submitted", "approved", "rejected"]);
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: projectData } = useListProjects({ pageSize: 200 });
  const projectOptions = (projectData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: boqData } = useListBoqs({ pageSize: 200 });
  const boqOptions = (boqData?.data ?? []).map((o) => ({ value: o.id, label: o.title }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "title", label: "Title", labelAr: "العنوان", required: true },
    { name: "titleAr", label: "Title (Arabic)", labelAr: "العنوان بالعربية", rtl: true },
    { name: "projectId", label: "Project", labelAr: "المشروع", type: "select", options: projectOptions },
    { name: "boqId", label: "BOQ", labelAr: "جدول الكميات", type: "select", options: boqOptions },
    { name: "estimatedCost", label: "Estimated Cost", labelAr: "التكلفة التقديرية", type: "money" },
    { name: "estimateDate", label: "Estimate Date", labelAr: "تاريخ التقدير", type: "date" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: STATUS },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<CostEstimate>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Title", headerAr: "العنوان", render: (r) => (language === "ar" ? r.titleAr : r.title) },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Estimate Date", headerAr: "تاريخ التقدير", render: (r) => r.estimateDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="Cost Estimates"
      titleAr="تقديرات التكلفة"
      columns={columns}
      fields={fields}
      useList={useListCostEstimates}
      useCreate={useCreateCostEstimate}
      useUpdate={useUpdateCostEstimate}
      useDelete={useDeleteCostEstimate}
      getListQueryKey={getListCostEstimatesQueryKey}
      companyId={companyId}
    />
  );
}
