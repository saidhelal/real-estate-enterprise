import {
  useListCertificateApprovalLogs,
  useCreateCertificateApprovalLog,
  useUpdateCertificateApprovalLog,
  useDeleteCertificateApprovalLog,
  getListCertificateApprovalLogsQueryKey,
  useListPaymentCertificates,
  useListCompanies,
  type CertificateApprovalLog,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function CertificateApprovalLogsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: certificateData } = useListPaymentCertificates({ pageSize: 200 });
  const certificateOptions = (certificateData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "certificateId", label: "Certificate", labelAr: "المستخلص", type: "select", options: certificateOptions },
    { name: "approvalId", label: "Approval", labelAr: "الاعتماد" },
    { name: "action", label: "Action", labelAr: "الإجراء", type: "select", options: enumOptions(["submitted", "reviewed", "approved", "posted", "paid", "closed", "rejected", "returned"]) },
    { name: "fromStatus", label: "From Status", labelAr: "من حالة" },
    { name: "toStatus", label: "To Status", labelAr: "إلى حالة" },
    { name: "actorName", label: "Actor", labelAr: "المنفِّذ" },
    { name: "actionDate", label: "Action Date", labelAr: "تاريخ الإجراء", type: "date" },
    { name: "comments", label: "Comments", labelAr: "التعليقات", type: "textarea" },
  ];

  const columns: ResourceColumn<CertificateApprovalLog>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Action", headerAr: "الإجراء", render: (r) => <Badge variant="secondary">{enumLabel(r.action, language)}</Badge> },
    { header: "Action Date", headerAr: "تاريخ الإجراء", render: (r) => r.actionDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="Certificate Approval Log"
      titleAr="سجل اعتماد المستخلص"
      columns={columns}
      fields={fields}
      useList={useListCertificateApprovalLogs}
      useCreate={useCreateCertificateApprovalLog}
      useUpdate={useUpdateCertificateApprovalLog}
      useDelete={useDeleteCertificateApprovalLog}
      getListQueryKey={getListCertificateApprovalLogsQueryKey}
      companyId={companyId}
    />
  );
}
