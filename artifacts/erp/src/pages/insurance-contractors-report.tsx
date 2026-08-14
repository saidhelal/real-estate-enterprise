import {
  useListSubcontractorInsurances,
  useCreateSubcontractorInsurance,
  useUpdateSubcontractorInsurance,
  useDeleteSubcontractorInsurance,
  getListSubcontractorInsurancesQueryKey,
  useListCompanies,
  type SubcontractorInsurance,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function InsuranceContractorsReportPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Code",
      labelAr: "الرمز",
      // Issued by the central sequence engine on save; shown in the form
      // before saving and never typed in.
      generated: true,
      generatorKey: "subcontractorInsurance",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "contractorName", label: "Contractor Name", labelAr: "اسم المقاول", required: true },
    { name: "contractorType", label: "Contractor Type", labelAr: "نوع المقاول", type: "select", options: enumOptions(["subcontractor","supplier_contractor"]) },
    { name: "insuranceNumber", label: "Insurance Number", labelAr: "رقم التأمين" },
    { name: "projectId", label: "Project ID", labelAr: "معرّف المشروع" },
    { name: "startDate", label: "Start Date", labelAr: "تاريخ البدء", type: "date" },
    { name: "endDate", label: "End Date", labelAr: "تاريخ الانتهاء", type: "date" },
    { name: "coverageAmount", label: "Coverage Amount", labelAr: "مبلغ التغطية", type: "money" },
    { name: "insuranceStatus", label: "Status", labelAr: "الموقف التأميني", type: "select", options: enumOptions(["active","suspended","expired","terminated"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<SubcontractorInsurance>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Contractor Name", headerAr: "اسم المقاول", render: (r) => r.contractorName ?? "-" },
    { header: "Type", headerAr: "النوع", render: (r) => <Badge variant="secondary">{enumLabel(r.contractorType, language)}</Badge> },
    { header: "Status", headerAr: "الموقف", render: (r) => <Badge variant="secondary">{enumLabel(r.insuranceStatus, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Contractor Insurance Report"
      titleAr="تقرير تأمينات المقاولين"
      columns={columns}
      fields={fields}
      useList={useListSubcontractorInsurances}
      useCreate={useCreateSubcontractorInsurance}
      useUpdate={useUpdateSubcontractorInsurance}
      useDelete={useDeleteSubcontractorInsurance}
      getListQueryKey={getListSubcontractorInsurancesQueryKey}
      companyId={companyId}
      canCreate={false}
      canEdit={false}
      canDelete={false}
    />
  );
}
