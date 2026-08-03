import {
  useListHandoverApprovals,
  useCreateHandoverApproval,
  useUpdateHandoverApproval,
  useDeleteHandoverApproval,
  getListHandoverApprovalsQueryKey,
  useListCompanies,
  useListHandoverRequests,
  type HandoverApproval,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function HandoverApprovalsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: requestIdData } = useListHandoverRequests({ pageSize: 200 });
  const requestIdOptions = (requestIdData?.data ?? []).map((x) => ({ value: x.id, label: x.code, labelAr: x.code }));

  const fields: ResourceField[] = [
    { name: "requestId", label: "Handover Request", labelAr: "طلب التسليم", type: "select", required: true, options: requestIdOptions },
    { name: "approverName", label: "Approver Name", labelAr: "اسم المعتمد" },
    { name: "approverNameAr", label: "Approver Name (Arabic)", labelAr: "اسم المعتمد بالعربية", rtl: true },
    { name: "level", label: "Level", labelAr: "المستوى", type: "number" },
    { name: "remarks", label: "Remarks", labelAr: "ملاحظات" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات إضافية", type: "textarea" },
  ];

  const columns: ResourceColumn<HandoverApproval>[] = [
    { header: "Approver", headerAr: "المعتمد", render: (r) => r.approverName ?? "-" },
    { header: "Level", headerAr: "المستوى", render: (r) => r.level ?? "-" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Approval Date", headerAr: "تاريخ الاعتماد", render: (r) => r.approvalDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="Handover Approvals"
      titleAr="اعتمادات التسليم"
      columns={columns}
      fields={fields}
      useList={useListHandoverApprovals}
      useCreate={useCreateHandoverApproval}
      useUpdate={useUpdateHandoverApproval}
      useDelete={useDeleteHandoverApproval}
      getListQueryKey={getListHandoverApprovalsQueryKey}
      companyId={companyId}
    />
  );
}
