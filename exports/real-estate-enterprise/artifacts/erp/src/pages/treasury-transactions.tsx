import {
  useListTreasuryTransactions,
  useCreateTreasuryTransaction,
  useUpdateTreasuryTransaction,
  useDeleteTreasuryTransaction,
  getListTreasuryTransactionsQueryKey,
  useListCashboxes,
  useListCompanies,
  type TreasuryTransaction,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

const TYPES = enumOptions(["in", "out"]);

export default function TreasuryTransactionsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const { data: cashboxes } = useListCashboxes({ pageSize: 200 });
  const companyId = companies?.[0]?.id;
  const cashboxOptions = (cashboxes?.data ?? []).map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }));

  const fields: ResourceField[] = [
    { name: "cashboxId", label: "Cashbox", labelAr: "الخزينة", type: "select", required: true, options: cashboxOptions, createOnly: true },
    { name: "type", label: "Type", labelAr: "النوع", type: "select", required: true, options: TYPES, createOnly: true },
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money", required: true, createOnly: true },
    { name: "transactionDate", label: "Date", labelAr: "التاريخ", type: "date", required: true },
    { name: "reference", label: "Reference", labelAr: "المرجع" },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
  ];

  const columns: ResourceColumn<TreasuryTransaction>[] = [
    { header: "Date", headerAr: "التاريخ", render: (r) => r.transactionDate },
    {
      header: "Type",
      headerAr: "النوع",
      render: (r) => <Badge variant={r.type === "out" ? "destructive" : "default"}>{enumLabel(r.type, language)}</Badge>,
    },
    { header: "Amount", headerAr: "المبلغ", render: (r) => r.amount },
    { header: "Reference", headerAr: "المرجع", render: (r) => r.reference ?? "—" },
  ];

  return (
    <ResourceManager
      title="Treasury Transactions"
      titleAr="حركات الخزينة"
      columns={columns}
      fields={fields}
      useList={useListTreasuryTransactions}
      useCreate={useCreateTreasuryTransaction}
      useUpdate={useUpdateTreasuryTransaction}
      useDelete={useDeleteTreasuryTransaction}
      getListQueryKey={getListTreasuryTransactionsQueryKey}
      companyId={companyId}
    />
  );
}
