import {
  useListInspectionReports,
  useCreateInspectionReport,
  useUpdateInspectionReport,
  useDeleteInspectionReport,
  getListInspectionReportsQueryKey,
  useListInspectionRequests,
  useListCompanies,
  type InspectionReport,
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

export default function InspectionReportsPage() {
  const { language } = useLanguage();
  const { options: RESULT } = useLookupOptions("inspection_result", ["pass", "fail", "conditional"]);
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: inspectionRequestData } = useListInspectionRequests({ pageSize: 200 });
  const inspectionRequestOptions = (inspectionRequestData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "inspectionRequestId", label: "Inspection Request", labelAr: "طلب الفحص", type: "select", options: inspectionRequestOptions },
    { name: "reportDate", label: "Report Date", labelAr: "تاريخ التقرير", type: "date" },
    { name: "inspector", label: "Inspector", labelAr: "المفتش" },
    { name: "result", label: "Result", labelAr: "النتيجة", type: "select", options: RESULT },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<InspectionReport>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Result", headerAr: "النتيجة", render: (r) => <Badge variant="secondary">{enumLabel(r.result, language)}</Badge> },
    { header: "Report Date", headerAr: "تاريخ التقرير", render: (r) => r.reportDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="Inspection Reports"
      titleAr="تقارير الفحص"
      columns={columns}
      fields={fields}
      useList={useListInspectionReports}
      useCreate={useCreateInspectionReport}
      useUpdate={useUpdateInspectionReport}
      useDelete={useDeleteInspectionReport}
      getListQueryKey={getListInspectionReportsQueryKey}
      companyId={companyId}
    />
  );
}
