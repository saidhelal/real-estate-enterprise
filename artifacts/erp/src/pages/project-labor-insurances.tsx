import {
  useListProjectLaborInsurances,
  useCreateProjectLaborInsurance,
  useUpdateProjectLaborInsurance,
  useDeleteProjectLaborInsurance,
  getListProjectLaborInsurancesQueryKey,
  useListCompanies,
  type ProjectLaborInsurance,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function ProjectLaborInsurancesPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "laborName", label: "Worker Name", labelAr: "اسم العامل", required: true },
    { name: "projectId", label: "Project ID", labelAr: "معرّف المشروع" },
    { name: "subcontractorInsuranceId", label: "Subcontractor Insurance ID", labelAr: "معرّف تأمين المقاول" },
    { name: "insuranceNumber", label: "Insurance Number", labelAr: "رقم التأمين" },
    { name: "workerCount", label: "Workers", labelAr: "عدد العمال", type: "number" },
    { name: "startDate", label: "Start Date", labelAr: "تاريخ البدء", type: "date" },
    { name: "endDate", label: "End Date", labelAr: "تاريخ الانتهاء", type: "date" },
    { name: "insuranceStatus", label: "Status", labelAr: "الموقف التأميني", type: "select", options: enumOptions(["active","suspended","expired","terminated"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<ProjectLaborInsurance>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Worker Name", headerAr: "اسم العامل", render: (r) => r.laborName ?? "-" },
    { header: "Workers", headerAr: "عدد العمال", render: (r) => r.workerCount ?? "-" },
    { header: "Status", headerAr: "الموقف", render: (r) => <Badge variant="secondary">{enumLabel(r.insuranceStatus, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Project Labor Insurances"
      titleAr="تأمينات عمالة المشروعات"
      columns={columns}
      fields={fields}
      useList={useListProjectLaborInsurances}
      useCreate={useCreateProjectLaborInsurance}
      useUpdate={useUpdateProjectLaborInsurance}
      useDelete={useDeleteProjectLaborInsurance}
      getListQueryKey={getListProjectLaborInsurancesQueryKey}
      companyId={companyId}
    />
  );
}
