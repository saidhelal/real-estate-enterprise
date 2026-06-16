import {
  useListRfqSuppliers,
  useCreateRfqSupplier,
  useUpdateRfqSupplier,
  useDeleteRfqSupplier,
  getListRfqSuppliersQueryKey,
  useListRfqs,
  useListSuppliers,
  useListCompanies,
  type RfqSupplier,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";

export default function RfqSuppliersPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: rfqData } = useListRfqs({ pageSize: 200 });
  const rfqOptions = (rfqData?.data ?? []).map((o) => ({ value: o.id, label: o.code }));
  const { data: supplierData } = useListSuppliers({ pageSize: 200 });
  const supplierOptions = (supplierData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    { name: "rfqId", label: "RFQ", labelAr: "طلب عرض السعر", type: "select", options: rfqOptions },
    { name: "supplierId", label: "Supplier", labelAr: "المورد", type: "select", options: supplierOptions },
    { name: "invitedDate", label: "Invited Date", labelAr: "تاريخ الدعوة", type: "date" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["invited", "responded", "declined"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<RfqSupplier>[] = [
    { header: "RFQ", headerAr: "طلب عرض السعر", render: (r) => <span className="font-medium">{r.rfqId ?? "-"}</span> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Invited Date", headerAr: "تاريخ الدعوة", render: (r) => r.invitedDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="RFQ Suppliers"
      titleAr="موردو طلب عرض السعر"
      columns={columns}
      fields={fields}
      useList={useListRfqSuppliers}
      useCreate={useCreateRfqSupplier}
      useUpdate={useUpdateRfqSupplier}
      useDelete={useDeleteRfqSupplier}
      getListQueryKey={getListRfqSuppliersQueryKey}
      companyId={companyId}
    />
  );
}
