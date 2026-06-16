import {
  useListRetentions,
  useCreateRetention,
  useUpdateRetention,
  useDeleteRetention,
  getListRetentionsQueryKey,
  useListContractorContracts,
  useListPaymentCertificates,
  useListCompanies,
  type Retention,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function RetentionsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: contractData } = useListContractorContracts({ pageSize: 200 });
  const contractOptions = (contractData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));
  const { data: certificateData } = useListPaymentCertificates({ pageSize: 200 });
  const certificateOptions = (certificateData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "contractId", label: "Contract", labelAr: "العقد", type: "select", options: contractOptions },
    { name: "certificateId", label: "Certificate", labelAr: "الشهادة", type: "select", options: certificateOptions },
    { name: "retentionPercent", label: "Retention %", labelAr: "نسبة المحتجز", type: "money" },
    { name: "retainedAmount", label: "Retained Amount", labelAr: "المبلغ المحتجز", type: "money" },
    { name: "releasedAmount", label: "Released Amount", labelAr: "المبلغ المُفرَج عنه", type: "money" },
    { name: "releaseDate", label: "Release Date", labelAr: "تاريخ الإفراج", type: "date" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["held", "partially_released", "released"]) },
  ];

  const columns: ResourceColumn<Retention>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Retention %", headerAr: "نسبة المحتجز", render: (r) => r.retentionPercent ?? "-" },
  ];

  return (
    <ResourceManager
      title="Retentions"
      titleAr="المحتجزات"
      columns={columns}
      fields={fields}
      useList={useListRetentions}
      useCreate={useCreateRetention}
      useUpdate={useUpdateRetention}
      useDelete={useDeleteRetention}
      getListQueryKey={getListRetentionsQueryKey}
      companyId={companyId}
    />
  );
}
