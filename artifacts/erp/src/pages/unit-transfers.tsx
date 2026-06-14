import {
  useListUnitTransfers,
  useCreateUnitTransfer,
  useUpdateUnitTransfer,
  useDeleteUnitTransfer,
  getListUnitTransfersQueryKey,
  useListContracts,
  useListUnits,
  useListUsers,
  useListCompanies,
  type UnitTransfer,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function UnitTransfersPage() {
  useLanguage();
  const { data: companies } = useListCompanies();
  const { data: contracts } = useListContracts({ pageSize: 200 });
  const { data: units } = useListUnits({ pageSize: 200 });
  const { data: users } = useListUsers();
  const companyId = companies?.[0]?.id;

  const contractOptions = (contracts?.data ?? []).map((c) => ({ value: c.id, label: c.code }));
  const unitOptions = (units?.data ?? []).map((u) => ({ value: u.id, label: u.name }));
  const userOptions = (users ?? []).map((u) => ({ value: u.id, label: u.fullName ?? u.username }));

  const fields: ResourceField[] = [
    { name: "contractId", label: "Contract", labelAr: "العقد", type: "select", required: true, options: contractOptions },
    { name: "fromUnitId", label: "From Unit", labelAr: "من الوحدة", type: "select", required: true, options: unitOptions },
    { name: "toUnitId", label: "To Unit", labelAr: "إلى الوحدة", type: "select", required: true, options: unitOptions },
    { name: "transferDate", label: "Transfer Date", labelAr: "تاريخ النقل", type: "date", required: true },
    { name: "reason", label: "Reason", labelAr: "السبب", type: "textarea" },
    { name: "priceDifference", label: "Price Difference", labelAr: "فرق السعر", type: "money" },
    { name: "userId", label: "User", labelAr: "المستخدم", type: "select", options: userOptions },
  ];

  const columns: ResourceColumn<UnitTransfer>[] = [
    { header: "Date", headerAr: "التاريخ", render: (r) => r.transferDate },
    { header: "Reason", headerAr: "السبب", render: (r) => r.reason ?? "-" },
    { header: "Price Difference", headerAr: "فرق السعر", render: (r) => r.priceDifference ?? "-" },
  ];

  return (
    <ResourceManager
      title="Unit Transfers"
      titleAr="نقل الوحدات"
      columns={columns}
      fields={fields}
      useList={useListUnitTransfers}
      useCreate={useCreateUnitTransfer}
      useUpdate={useUpdateUnitTransfer}
      useDelete={useDeleteUnitTransfer}
      getListQueryKey={getListUnitTransfersQueryKey}
      companyId={companyId}
    />
  );
}
