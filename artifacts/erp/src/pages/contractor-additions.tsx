import {
  useListContractorAdditions,
  useCreateContractorAddition,
  useUpdateContractorAddition,
  useDeleteContractorAddition,
  getListContractorAdditionsQueryKey,
  useListContractorContracts,
  useListPaymentCertificates,
  useListCompanies,
  type ContractorAddition,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function ContractorAdditionsPage() {
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
      generatorKey: "contractorAddition",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "contractId", label: "Contract", labelAr: "العقد", type: "select", options: contractOptions },
    { name: "certificateId", label: "Certificate", labelAr: "المستخلص", type: "select", options: certificateOptions },
    { name: "additionType", label: "Addition Type", labelAr: "نوع الإضافة", type: "select", options: enumOptions(["extra_work", "compensation", "claim", "other"]) },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money" },
    { name: "additionDate", label: "Addition Date", labelAr: "تاريخ الإضافة", type: "date" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft", "applied"]) },
  ];

  const columns: ResourceColumn<ContractorAddition>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Addition Type", headerAr: "نوع الإضافة", render: (r) => <Badge variant="secondary">{enumLabel(r.additionType, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Amount", headerAr: "المبلغ", render: (r) => r.amount ?? "-" },
  ];

  return (
    <ResourceManager
      title="Contractor Additions"
      titleAr="إضافات المقاول"
      columns={columns}
      fields={fields}
      useList={useListContractorAdditions}
      useCreate={useCreateContractorAddition}
      useUpdate={useUpdateContractorAddition}
      useDelete={useDeleteContractorAddition}
      getListQueryKey={getListContractorAdditionsQueryKey}
      companyId={companyId}
    />
  );
}
