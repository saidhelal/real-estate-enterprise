import {
  useListDrawings,
  useCreateDrawing,
  useUpdateDrawing,
  useDeleteDrawing,
  getListDrawingsQueryKey,
  useListEngineeringDisciplines,
  useListDrawingCategorys,
  useListConsultants,
  useListProjects,
  useListPhases,
  useListBuildings,
  useListFloors,
  useListCompanies,
  type Drawing,
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

export default function DrawingsPage() {
  const { language } = useLanguage();
  const { options: DRAWING_TYPE } = useLookupOptions("engineering_discipline", ["architectural", "structural", "mep"]);
  const { options: APPROVAL_STATUS } = useLookupOptions("submittal_status", ["draft", "submitted", "approved", "approved_with_comments", "rejected", "superseded"]);
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: disciplineData } = useListEngineeringDisciplines({ pageSize: 200 });
  const disciplineOptions = (disciplineData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: categoryData } = useListDrawingCategorys({ pageSize: 200 });
  const categoryOptions = (categoryData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: consultantData } = useListConsultants({ pageSize: 200 });
  const consultantOptions = (consultantData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: projectData } = useListProjects({ pageSize: 200 });
  const projectOptions = (projectData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: phaseData } = useListPhases({ pageSize: 200 });
  const phaseOptions = (phaseData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: buildingData } = useListBuildings({ pageSize: 200 });
  const buildingOptions = (buildingData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: floorData } = useListFloors({ pageSize: 200 });
  const floorOptions = (floorData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "title", label: "Title", labelAr: "العنوان", required: true },
    { name: "titleAr", label: "Title (Arabic)", labelAr: "العنوان بالعربية", required: true, rtl: true },
    { name: "drawingType", label: "Drawing Type", labelAr: "نوع الرسم", type: "select", options: DRAWING_TYPE },
    { name: "disciplineId", label: "Discipline", labelAr: "التخصص", type: "select", options: disciplineOptions },
    { name: "categoryId", label: "Category", labelAr: "الفئة", type: "select", options: categoryOptions },
    { name: "consultantId", label: "Consultant", labelAr: "الاستشاري", type: "select", options: consultantOptions },
    { name: "projectId", label: "Project", labelAr: "المشروع", type: "select", options: projectOptions },
    { name: "phaseId", label: "Phase", labelAr: "المرحلة", type: "select", options: phaseOptions },
    { name: "buildingId", label: "Building", labelAr: "المبنى", type: "select", options: buildingOptions },
    { name: "floorId", label: "Floor", labelAr: "الطابق", type: "select", options: floorOptions },
    { name: "currentVersion", label: "Current Version", labelAr: "الإصدار الحالي" },
    { name: "approvalStatus", label: "Approval Status", labelAr: "حالة الاعتماد", type: "select", options: APPROVAL_STATUS },
    { name: "drawingDate", label: "Drawing Date", labelAr: "تاريخ الرسم", type: "date" },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
  ];

  const columns: ResourceColumn<Drawing>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Title", headerAr: "العنوان", render: (r) => (language === "ar" ? r.titleAr : r.title) },
    { header: "Drawing Type", headerAr: "نوع الرسم", render: (r) => <Badge variant="secondary">{enumLabel(r.drawingType, language)}</Badge> },
    { header: "Approval Status", headerAr: "حالة الاعتماد", render: (r) => <Badge variant="secondary">{enumLabel(r.approvalStatus, language)}</Badge> },
    { header: "Drawing Date", headerAr: "تاريخ الرسم", render: (r) => r.drawingDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="Drawings"
      titleAr="الرسومات"
      columns={columns}
      fields={fields}
      useList={useListDrawings}
      useCreate={useCreateDrawing}
      useUpdate={useUpdateDrawing}
      useDelete={useDeleteDrawing}
      getListQueryKey={getListDrawingsQueryKey}
      companyId={companyId}
    />
  );
}
