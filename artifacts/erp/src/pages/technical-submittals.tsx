import {
  useListTechnicalSubmittals,
  useCreateTechnicalSubmittal,
  useUpdateTechnicalSubmittal,
  useDeleteTechnicalSubmittal,
  getListTechnicalSubmittalsQueryKey,
  useListProjects,
  useListConsultants,
  useListCompanies,
  type TechnicalSubmittal,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function TechnicalSubmittalsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: projectData } = useListProjects({ pageSize: 200 });
  const projectOptions = (projectData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: consultantData } = useListConsultants({ pageSize: 200 });
  const consultantOptions = (consultantData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "projectId", label: "Project", labelAr: "المشروع", type: "select", options: projectOptions },
    { name: "title", label: "Title", labelAr: "العنوان", required: true },
    { name: "submittalType", label: "Submittal Type", labelAr: "نوع التقديم" },
    { name: "submittedBy", label: "Submitted By", labelAr: "مقدم من" },
    { name: "consultantId", label: "Consultant", labelAr: "الاستشاري", type: "select", options: consultantOptions },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["submitted", "under_review", "approved", "approved_with_comments", "rejected"]) },
    { name: "submittedDate", label: "Submitted Date", labelAr: "تاريخ التقديم", type: "date" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<TechnicalSubmittal>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Title", headerAr: "العنوان", render: (r) => r.title },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Submitted Date", headerAr: "تاريخ التقديم", render: (r) => r.submittedDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="Technical Submittals"
      titleAr="التقديمات الفنية"
      columns={columns}
      fields={fields}
      useList={useListTechnicalSubmittals}
      useCreate={useCreateTechnicalSubmittal}
      useUpdate={useUpdateTechnicalSubmittal}
      useDelete={useDeleteTechnicalSubmittal}
      getListQueryKey={getListTechnicalSubmittalsQueryKey}
      companyId={companyId}
    />
  );
}
