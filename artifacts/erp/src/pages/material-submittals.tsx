import {
  useListMaterialSubmittals,
  useCreateMaterialSubmittal,
  useUpdateMaterialSubmittal,
  useDeleteMaterialSubmittal,
  getListMaterialSubmittalsQueryKey,
  useListProjects,
  useListConsultants,
  useListCompanies,
  type MaterialSubmittal,
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

export default function MaterialSubmittalsPage() {
  const { language } = useLanguage();
  const { options: STATUS } = useLookupOptions("submittal_status", ["submitted", "under_review", "approved", "approved_with_comments", "rejected"]);
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: projectData } = useListProjects({ pageSize: 200 });
  const projectOptions = (projectData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: consultantData } = useListConsultants({ pageSize: 200 });
  const consultantOptions = (consultantData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence on save; shown here beforehand.
      generated: true,
      generatorKey: "materialSubmittal",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "projectId", label: "Project", labelAr: "المشروع", type: "select", options: projectOptions },
    { name: "materialName", label: "Material Name", labelAr: "اسم المادة", required: true },
    { name: "manufacturer", label: "Manufacturer", labelAr: "الشركة المصنعة" },
    { name: "consultantId", label: "Consultant", labelAr: "الاستشاري", type: "select", options: consultantOptions },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: STATUS },
    { name: "submittedDate", label: "Submitted Date", labelAr: "تاريخ التقديم", type: "date" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<MaterialSubmittal>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Submitted Date", headerAr: "تاريخ التقديم", render: (r) => r.submittedDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="Material Submittals"
      titleAr="تقديمات المواد"
      columns={columns}
      fields={fields}
      useList={useListMaterialSubmittals}
      useCreate={useCreateMaterialSubmittal}
      useUpdate={useUpdateMaterialSubmittal}
      useDelete={useDeleteMaterialSubmittal}
      getListQueryKey={getListMaterialSubmittalsQueryKey}
      companyId={companyId}
    />
  );
}
