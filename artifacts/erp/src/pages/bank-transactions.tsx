import {
  useListBankTransactions,
  useCreateBankTransaction,
  useUpdateBankTransaction,
  useDeleteBankTransaction,
  getListBankTransactionsQueryKey,
  useListBankAccounts,
  useListCompanies,
  type BankTransaction,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";

const TYPES = [
  { value: "in", label: "In" },
  { value: "out", label: "Out" },
];

export default function BankTransactionsPage() {
  const { data: companies } = useListCompanies();
  const { data: banks } = useListBankAccounts({ pageSize: 200 });
  const companyId = companies?.[0]?.id;
  const bankOptions = (banks?.data ?? []).map((b) => ({ value: b.id, label: `${b.code} - ${b.bankName}` }));

  const fields: ResourceField[] = [
    { name: "bankAccountId", label: "Bank Account", labelAr: "الحساب البنكي", type: "select", required: true, options: bankOptions, createOnly: true },
    { name: "type", label: "Type", labelAr: "النوع", type: "select", required: true, options: TYPES, createOnly: true },
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money", required: true, createOnly: true },
    { name: "transactionDate", label: "Date", labelAr: "التاريخ", type: "date", required: true },
    { name: "reference", label: "Reference", labelAr: "المرجع" },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
  ];

  const columns: ResourceColumn<BankTransaction>[] = [
    { header: "Date", headerAr: "التاريخ", render: (r) => r.transactionDate },
    {
      header: "Type",
      headerAr: "النوع",
      render: (r) => <Badge variant={r.type === "out" ? "destructive" : "default"}>{r.type}</Badge>,
    },
    { header: "Amount", headerAr: "المبلغ", render: (r) => r.amount },
    { header: "Reference", headerAr: "المرجع", render: (r) => r.reference ?? "—" },
  ];

  return (
    <ResourceManager
      title="Bank Transactions"
      titleAr="الحركات البنكية"
      columns={columns}
      fields={fields}
      useList={useListBankTransactions}
      useCreate={useCreateBankTransaction}
      useUpdate={useUpdateBankTransaction}
      useDelete={useDeleteBankTransaction}
      getListQueryKey={getListBankTransactionsQueryKey}
      companyId={companyId}
    />
  );
}
