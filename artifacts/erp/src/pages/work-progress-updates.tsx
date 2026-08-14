import {
  useListWorkProgressUpdates,
  useCreateWorkProgressUpdate,
  useUpdateWorkProgressUpdate,
  useDeleteWorkProgressUpdate,
  getListWorkProgressUpdatesQueryKey,
  useListContractorContracts,
  useListCompanies,
  type WorkProgressUpdate,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function WorkProgressUpdatesPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: contractData } = useListContractorContracts({ pageSize: 200 });
  const contractOptions = (contractData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence on save; shown here beforehand.
      generated: true,
      generatorKey: "workProgressUpdate",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "contractId", label: "Contract", labelAr: "العقد", type: "select", options: contractOptions },
    { name: "asOfDate", label: "As Of Date", labelAr: "حتى تاريخ", type: "date" },
    { name: "progressPercent", label: "Progress %", labelAr: "نسبة الإنجاز", type: "number" },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft", "submitted", "approved"]) },
    { name: "approvedBy", label: "Approved By", labelAr: "اعتمد بواسطة" },
  ];

  const columns: ResourceColumn<WorkProgressUpdate>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Progress %", headerAr: "نسبة الإنجاز", render: (r) => r.progressPercent ?? "-" },
  ];

  return (
    <ResourceManager
      title="Work Progress Updates"
      titleAr="تحديثات تقدم الأعمال"
      columns={columns}
      fields={fields}
      useList={useListWorkProgressUpdates}
      useCreate={useCreateWorkProgressUpdate}
      useUpdate={useUpdateWorkProgressUpdate}
      useDelete={useDeleteWorkProgressUpdate}
      getListQueryKey={getListWorkProgressUpdatesQueryKey}
      companyId={companyId}
    />
  );
}
