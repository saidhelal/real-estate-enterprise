import {
  useListBoqs,
  useCreateBoq,
  useUpdateBoq,
  useDeleteBoq,
  getListBoqsQueryKey,
  useListProjects,
  useListPhases,
  useListCompanies,
  type Boq,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function BoqsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: projectData } = useListProjects({ pageSize: 200 });
  const projectOptions = (projectData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: phaseData } = useListPhases({ pageSize: 200 });
  const phaseOptions = (phaseData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence on save; shown here beforehand.
      generated: true,
      generatorKey: "boq",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "title", label: "Title", labelAr: "العنوان", required: true },
    { name: "titleAr", label: "Title (Arabic)", labelAr: "العنوان بالعربية", required: true, rtl: true },
    { name: "projectId", label: "Project", labelAr: "المشروع", type: "select", options: projectOptions },
    { name: "phaseId", label: "Phase", labelAr: "المرحلة", type: "select", options: phaseOptions },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft", "approved", "in_progress", "completed"]) },
    { name: "totalAmount", label: "Total Amount", labelAr: "المبلغ الإجمالي", type: "money" },
    { name: "boqDate", label: "BOQ Date", labelAr: "تاريخ الجدول", type: "date" },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
  ];

  const columns: ResourceColumn<Boq>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Title", headerAr: "العنوان", render: (r) => (language === "ar" ? r.titleAr : r.title) },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "BOQ Date", headerAr: "تاريخ الجدول", render: (r) => r.boqDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="Bills of Quantities"
      titleAr="جداول الكميات"
      columns={columns}
      fields={fields}
      useList={useListBoqs}
      useCreate={useCreateBoq}
      useUpdate={useUpdateBoq}
      useDelete={useDeleteBoq}
      getListQueryKey={getListBoqsQueryKey}
      companyId={companyId}
    />
  );
}
