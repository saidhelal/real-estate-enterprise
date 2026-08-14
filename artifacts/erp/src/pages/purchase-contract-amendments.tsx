import {
  useListPurchaseContractAmendments,
  useCreatePurchaseContractAmendment,
  useUpdatePurchaseContractAmendment,
  useDeletePurchaseContractAmendment,
  getListPurchaseContractAmendmentsQueryKey,
  useListPurchaseContracts,
  useListCompanies,
  type PurchaseContractAmendment,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function PurchaseContractAmendmentsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: contractData } = useListPurchaseContracts({ pageSize: 200 });
  const contractOptions = (contractData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence on save; shown here beforehand.
      generated: true,
      generatorKey: "purchaseContractAmendment",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "contractId", label: "Contract", labelAr: "العقد", type: "select", options: contractOptions },
    { name: "amendmentNumber", label: "Amendment Number", labelAr: "رقم التعديل" },
    { name: "amendmentDate", label: "Amendment Date", labelAr: "تاريخ التعديل", type: "date" },
    { name: "amendmentValue", label: "Amendment Value", labelAr: "قيمة التعديل", type: "money" },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft", "approved", "rejected"]) },
  ];

  const columns: ResourceColumn<PurchaseContractAmendment>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Amendment Value", headerAr: "قيمة التعديل", render: (r) => r.amendmentValue ?? "-" },
  ];

  return (
    <ResourceManager
      title="Purchase Contract Amendments"
      titleAr="تعديلات عقد الشراء"
      columns={columns}
      fields={fields}
      useList={useListPurchaseContractAmendments}
      useCreate={useCreatePurchaseContractAmendment}
      useUpdate={useUpdatePurchaseContractAmendment}
      useDelete={useDeletePurchaseContractAmendment}
      getListQueryKey={getListPurchaseContractAmendmentsQueryKey}
      companyId={companyId}
    />
  );
}
