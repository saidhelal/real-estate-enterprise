import {
  useListPurchaseContracts,
  useCreatePurchaseContract,
  useUpdatePurchaseContract,
  useDeletePurchaseContract,
  getListPurchaseContractsQueryKey,
  useListSuppliers,
  useListCompanies,
  type PurchaseContract,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function PurchaseContractsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: supplierData } = useListSuppliers({ pageSize: 200 });
  const supplierOptions = (supplierData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "title", label: "Title", labelAr: "العنوان", required: true },
    { name: "titleAr", label: "Title (Arabic)", labelAr: "العنوان بالعربية", required: true, rtl: true },
    { name: "supplierId", label: "Supplier", labelAr: "المورد", type: "select", options: supplierOptions },
    { name: "contractValue", label: "Contract Value", labelAr: "قيمة العقد", type: "money" },
    { name: "startDate", label: "Start Date", labelAr: "تاريخ البدء", type: "date" },
    { name: "endDate", label: "End Date", labelAr: "تاريخ الانتهاء", type: "date" },
    { name: "documentRef", label: "Document Ref.", labelAr: "مرجع المستند" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft", "active", "completed", "terminated"]) },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
  ];

  const columns: ResourceColumn<PurchaseContract>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Title", headerAr: "العنوان", render: (r) => (language === "ar" ? r.titleAr : r.title) },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Contract Value", headerAr: "قيمة العقد", render: (r) => r.contractValue ?? "-" },
  ];

  return (
    <ResourceManager
      title="Purchase Contracts"
      titleAr="عقود الشراء"
      columns={columns}
      fields={fields}
      useList={useListPurchaseContracts}
      useCreate={useCreatePurchaseContract}
      useUpdate={useUpdatePurchaseContract}
      useDelete={useDeletePurchaseContract}
      getListQueryKey={getListPurchaseContractsQueryKey}
      companyId={companyId}
    />
  );
}
