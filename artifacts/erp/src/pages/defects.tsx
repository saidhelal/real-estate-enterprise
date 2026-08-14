import {
  useListDefects,
  useCreateDefect,
  useUpdateDefect,
  useDeleteDefect,
  getListDefectsQueryKey,
  useListInspectionReports,
  useListProjects,
  useListCompanies,
  type Defect,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { Badge } from "@/components/ui/badge";

export default function DefectsPage() {
  // Domain owned by the lookup engine. The literal is the fallback used
  // until the registry is seeded, so behaviour is unchanged either way.
  const { options: lk_priority_level } = useLookupOptions("priority_level", ["low", "medium", "high", "critical"]);
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: inspectionReportData } = useListInspectionReports({ pageSize: 200 });
  const inspectionReportOptions = (inspectionReportData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));
  const { data: projectData } = useListProjects({ pageSize: 200 });
  const projectOptions = (projectData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence on save; shown here beforehand.
      generated: true,
      generatorKey: "defect",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "inspectionReportId", label: "Inspection Report", labelAr: "تقرير الفحص", type: "select", options: inspectionReportOptions },
    { name: "projectId", label: "Project", labelAr: "المشروع", type: "select", options: projectOptions },
    { name: "description", label: "Description", labelAr: "الوصف", required: true },
    { name: "severity", label: "Severity", labelAr: "الخطورة", type: "select", options: lk_priority_level },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["open", "in_progress", "closed"]) },
    { name: "reportedDate", label: "Reported Date", labelAr: "تاريخ الإبلاغ", type: "date" },
  ];

  const columns: ResourceColumn<Defect>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Severity", headerAr: "الخطورة", render: (r) => <Badge variant="secondary">{enumLabel(r.severity, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Reported Date", headerAr: "تاريخ الإبلاغ", render: (r) => r.reportedDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="Defects"
      titleAr="العيوب"
      columns={columns}
      fields={fields}
      useList={useListDefects}
      useCreate={useCreateDefect}
      useUpdate={useUpdateDefect}
      useDelete={useDeleteDefect}
      getListQueryKey={getListDefectsQueryKey}
      companyId={companyId}
    />
  );
}
