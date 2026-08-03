import {
  useListContractApprovals,
  useCreateContractApproval,
  useUpdateContractApproval,
  useDeleteContractApproval,
  getListContractApprovalsQueryKey,
  useListContractorContracts,
  useListCompanies,
  type ContractApproval,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function ContractApprovalsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: contractData } = useListContractorContracts({ pageSize: 200 });
  const contractOptions = (contractData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "contractId", label: "Contract", labelAr: "العقد", type: "select", options: contractOptions },
    { name: "entityType", label: "Entity Type", labelAr: "نوع الكيان" },
    { name: "entityId", label: "Entity ID", labelAr: "معرّف الكيان" },
    { name: "level", label: "Level", labelAr: "المستوى", type: "select", options: enumOptions(["site_engineer", "project_manager", "engineering_manager", "finance"]) },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["pending", "approved", "rejected"]) },
    { name: "approverName", label: "Approver Name", labelAr: "اسم المعتمِد" },
    { name: "approvalDate", label: "Approval Date", labelAr: "تاريخ الاعتماد", type: "date" },
    { name: "comments", label: "Comments", labelAr: "التعليقات", type: "textarea" },
  ];

  const columns: ResourceColumn<ContractApproval>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Level", headerAr: "المستوى", render: (r) => <Badge variant="secondary">{enumLabel(r.level, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Approval Date", headerAr: "تاريخ الاعتماد", render: (r) => r.approvalDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="Contract Approvals"
      titleAr="اعتمادات العقد"
      columns={columns}
      fields={fields}
      useList={useListContractApprovals}
      useCreate={useCreateContractApproval}
      useUpdate={useUpdateContractApproval}
      useDelete={useDeleteContractApproval}
      getListQueryKey={getListContractApprovalsQueryKey}
      companyId={companyId}
    />
  );
}
