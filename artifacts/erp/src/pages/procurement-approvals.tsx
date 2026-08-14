import {
  useListProcurementApprovals,
  useCreateProcurementApproval,
  useUpdateProcurementApproval,
  useDeleteProcurementApproval,
  getListProcurementApprovalsQueryKey,
  useListCompanies,
  type ProcurementApproval,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { Badge } from "@/components/ui/badge";

export default function ProcurementApprovalsPage() {
  // Domain owned by the lookup engine. The literal is the fallback used
  // until the registry is seeded, so behaviour is unchanged either way.
  const { options: lk_approval_decision } = useLookupOptions("approval_decision", ["pending", "approved", "rejected"]);
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence on save; shown here beforehand.
      generated: true,
      generatorKey: "procurementApproval",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "entityType", label: "Entity Type", labelAr: "نوع الكيان" },
    { name: "entityId", label: "Entity ID", labelAr: "معرّف الكيان" },
    { name: "level", label: "Level", labelAr: "المستوى", type: "select", options: enumOptions(["department_head", "procurement_manager", "general_manager", "finance"]) },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: lk_approval_decision },
    { name: "approverName", label: "Approver Name", labelAr: "اسم المعتمِد" },
    { name: "approvalDate", label: "Approval Date", labelAr: "تاريخ الاعتماد", type: "date" },
    { name: "comments", label: "Comments", labelAr: "التعليقات", type: "textarea" },
  ];

  const columns: ResourceColumn<ProcurementApproval>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Level", headerAr: "المستوى", render: (r) => <Badge variant="secondary">{enumLabel(r.level, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Approval Date", headerAr: "تاريخ الاعتماد", render: (r) => r.approvalDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="Procurement Approvals"
      titleAr="اعتمادات المشتريات"
      columns={columns}
      fields={fields}
      useList={useListProcurementApprovals}
      useCreate={useCreateProcurementApproval}
      useUpdate={useUpdateProcurementApproval}
      useDelete={useDeleteProcurementApproval}
      getListQueryKey={getListProcurementApprovalsQueryKey}
      companyId={companyId}
    />
  );
}
