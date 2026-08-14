import {
  useListContractorContracts,
  useCreateContractorContract,
  useUpdateContractorContract,
  useDeleteContractorContract,
  getListContractorContractsQueryKey,
  useListContractors,
  useListProjects,
  useListPhases,
  useListBoqs,
  useListCompanies,
  type ContractorContract,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function ContractorContractsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: contractorData } = useListContractors({ pageSize: 200 });
  const contractorOptions = (contractorData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: projectData } = useListProjects({ pageSize: 200 });
  const projectOptions = (projectData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: phaseData } = useListPhases({ pageSize: 200 });
  const phaseOptions = (phaseData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));
  const { data: boqData } = useListBoqs({ pageSize: 200 });
  const boqOptions = (boqData?.data ?? []).map((o) => ({ value: o.id, label: o.title }));

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence on save; shown here beforehand.
      generated: true,
      generatorKey: "contractorContract",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "title", label: "Title", labelAr: "العنوان", required: true },
    { name: "titleAr", label: "Title (Arabic)", labelAr: "العنوان بالعربية", required: true, rtl: true },
    { name: "contractorId", label: "Contractor", labelAr: "المقاول", type: "select", options: contractorOptions },
    { name: "projectId", label: "Project", labelAr: "المشروع", type: "select", options: projectOptions },
    { name: "phaseId", label: "Phase", labelAr: "المرحلة", type: "select", options: phaseOptions },
    { name: "boqId", label: "BOQ", labelAr: "جدول الكميات", type: "select", options: boqOptions },
    { name: "contractValue", label: "Contract Value", labelAr: "قيمة العقد", type: "money" },
    { name: "startDate", label: "Start Date", labelAr: "تاريخ البدء", type: "date" },
    { name: "endDate", label: "End Date", labelAr: "تاريخ الانتهاء", type: "date" },
    { name: "durationDays", label: "Duration (Days)", labelAr: "المدة (أيام)", type: "number" },
    { name: "retentionPercent", label: "Retention %", labelAr: "نسبة المحتجز", type: "money" },
    { name: "advancePercent", label: "Advance %", labelAr: "نسبة الدفعة المقدمة", type: "money" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft", "active", "completed", "suspended", "terminated"]) },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
  ];

  const columns: ResourceColumn<ContractorContract>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Title", headerAr: "العنوان", render: (r) => (language === "ar" ? r.titleAr : r.title) },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Contract Value", headerAr: "قيمة العقد", render: (r) => r.contractValue ?? "-" },
  ];

  return (
    <ResourceManager
      title="Contractor Contracts"
      titleAr="عقود المقاولين"
      columns={columns}
      fields={fields}
      useList={useListContractorContracts}
      useCreate={useCreateContractorContract}
      useUpdate={useUpdateContractorContract}
      useDelete={useDeleteContractorContract}
      getListQueryKey={getListContractorContractsQueryKey}
      companyId={companyId}
    />
  );
}
