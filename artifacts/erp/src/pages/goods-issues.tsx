import {
  useListGoodsIssues,
  useCreateGoodsIssue,
  useUpdateGoodsIssue,
  useDeleteGoodsIssue,
  getListGoodsIssuesQueryKey,
  useListWarehouses,
  useListCompanies,
  type GoodsIssue,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function GoodsIssuesPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: warehouseData } = useListWarehouses({ pageSize: 200 });
  const warehouseOptions = (warehouseData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence on save; shown here beforehand.
      generated: true,
      generatorKey: "goodsIssue",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "issueDate", label: "Issue Date", labelAr: "تاريخ الصرف", type: "date" },
    { name: "issueType", label: "Issue Type", labelAr: "نوع الصرف", type: "select", options: enumOptions(["consumption", "sale", "transfer", "return", "disposal"]) },
    { name: "warehouseId", label: "Warehouse", labelAr: "المستودع", type: "select", options: warehouseOptions },
    { name: "issuedTo", label: "Issued To", labelAr: "صُرف إلى" },
    { name: "costCenter", label: "Cost Center", labelAr: "مركز التكلفة" },
    { name: "totalValue", label: "Total Value", labelAr: "القيمة الإجمالية", type: "money" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft", "issued", "completed", "cancelled"]) },
    { name: "issuedBy", label: "Issued By", labelAr: "صرف بواسطة" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<GoodsIssue>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Issue Type", headerAr: "نوع الصرف", render: (r) => <Badge variant="secondary">{enumLabel(r.issueType, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Total Value", headerAr: "القيمة الإجمالية", render: (r) => r.totalValue ?? "-" },
  ];

  return (
    <ResourceManager
      title="Goods Issues"
      titleAr="صرف المخزون"
      columns={columns}
      fields={fields}
      useList={useListGoodsIssues}
      useCreate={useCreateGoodsIssue}
      useUpdate={useUpdateGoodsIssue}
      useDelete={useDeleteGoodsIssue}
      getListQueryKey={getListGoodsIssuesQueryKey}
      companyId={companyId}
    />
  );
}
