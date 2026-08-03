import {
  useListDrawingCategorys,
  useCreateDrawingCategory,
  useUpdateDrawingCategory,
  useDeleteDrawingCategory,
  getListDrawingCategorysQueryKey,
  useListEngineeringDisciplines,
  useListCompanies,
  type DrawingCategory,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function DrawingCategorysPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: disciplineData } = useListEngineeringDisciplines({ pageSize: 200 });
  const disciplineOptions = (disciplineData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "disciplineId", label: "Discipline", labelAr: "التخصص", type: "select", options: disciplineOptions },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
  ];

  const columns: ResourceColumn<DrawingCategory>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr : r.name) },
  ];

  return (
    <ResourceManager
      title="Drawing Categories"
      titleAr="فئات الرسومات"
      columns={columns}
      fields={fields}
      useList={useListDrawingCategorys}
      useCreate={useCreateDrawingCategory}
      useUpdate={useUpdateDrawingCategory}
      useDelete={useDeleteDrawingCategory}
      getListQueryKey={getListDrawingCategorysQueryKey}
      companyId={companyId}
    />
  );
}
