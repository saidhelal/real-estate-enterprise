import {
  useListDesignPackages,
  useCreateDesignPackage,
  useUpdateDesignPackage,
  useDeleteDesignPackage,
  getListDesignPackagesQueryKey,
  useListProjects,
  useListEngineeringDisciplines,
  useListConsultants,
  useListCompanies,
  type DesignPackage,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function DesignPackagesPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: projectData } = useListProjects({ pageSize: 200 });
  const projectOptions = (projectData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: disciplineData } = useListEngineeringDisciplines({ pageSize: 200 });
  const disciplineOptions = (disciplineData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: consultantData } = useListConsultants({ pageSize: 200 });
  const consultantOptions = (consultantData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence on save; shown here beforehand.
      generated: true,
      generatorKey: "designPackage",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "projectId", label: "Project", labelAr: "المشروع", type: "select", options: projectOptions },
    { name: "disciplineId", label: "Discipline", labelAr: "التخصص", type: "select", options: disciplineOptions },
    { name: "consultantId", label: "Consultant", labelAr: "الاستشاري", type: "select", options: consultantOptions },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft", "in_progress", "completed", "on_hold"]) },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
  ];

  const columns: ResourceColumn<DesignPackage>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Design Packages"
      titleAr="حزم التصميم"
      columns={columns}
      fields={fields}
      useList={useListDesignPackages}
      useCreate={useCreateDesignPackage}
      useUpdate={useUpdateDesignPackage}
      useDelete={useDeleteDesignPackage}
      getListQueryKey={getListDesignPackagesQueryKey}
      companyId={companyId}
    />
  );
}
