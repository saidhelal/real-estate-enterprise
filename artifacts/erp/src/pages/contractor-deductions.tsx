import {
  useListContractorDeductions,
  useCreateContractorDeduction,
  useUpdateContractorDeduction,
  useDeleteContractorDeduction,
  getListContractorDeductionsQueryKey,
  useListContractorContracts,
  useListPaymentCertificates,
  useListCompanies,
  type ContractorDeduction,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function ContractorDeductionsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: contractData } = useListContractorContracts({ pageSize: 200 });
  const contractOptions = (contractData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));
  const { data: certificateData } = useListPaymentCertificates({ pageSize: 200 });
  const certificateOptions = (certificateData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence on save; shown here beforehand.
      generated: true,
      generatorKey: "contractorDeduction",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "contractId", label: "Contract", labelAr: "العقد", type: "select", options: contractOptions },
    { name: "certificateId", label: "Certificate", labelAr: "المستخلص", type: "select", options: certificateOptions },
    { name: "deductionType", label: "Deduction Type", labelAr: "نوع الخصم", type: "select", options: enumOptions(["penalty", "delay_penalty", "quality_penalty", "other"]) },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money" },
    { name: "deductionDate", label: "Deduction Date", labelAr: "تاريخ الخصم", type: "date" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft", "applied"]) },
  ];

  const columns: ResourceColumn<ContractorDeduction>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Deduction Type", headerAr: "نوع الخصم", render: (r) => <Badge variant="secondary">{enumLabel(r.deductionType, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Amount", headerAr: "المبلغ", render: (r) => r.amount ?? "-" },
  ];

  return (
    <ResourceManager
      title="Contractor Deductions"
      titleAr="خصومات المقاول"
      columns={columns}
      fields={fields}
      useList={useListContractorDeductions}
      useCreate={useCreateContractorDeduction}
      useUpdate={useUpdateContractorDeduction}
      useDelete={useDeleteContractorDeduction}
      getListQueryKey={getListContractorDeductionsQueryKey}
      companyId={companyId}
    />
  );
}
