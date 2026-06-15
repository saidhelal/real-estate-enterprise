import {
  useListReceipts,
  useCreateReceipt,
  useUpdateReceipt,
  useDeleteReceipt,
  getListReceiptsQueryKey,
  useListCustomers,
  useListContracts,
  useListCashboxes,
  useListBankAccounts,
  useListCompanies,
  type Receipt,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
];

const STATUS = [
  { value: "confirmed", label: "Confirmed" },
  { value: "pending", label: "Pending" },
  { value: "cancelled", label: "Cancelled" },
];

export default function ReceiptsPage() {
  const { data: companies } = useListCompanies();
  const { data: customers } = useListCustomers({ pageSize: 200 });
  const { data: contracts } = useListContracts({ pageSize: 200 });
  const { data: cashboxes } = useListCashboxes({ pageSize: 200 });
  const { data: banks } = useListBankAccounts({ pageSize: 200 });
  const companyId = companies?.[0]?.id;

  const customerOptions = (customers?.data ?? []).map((c) => ({ value: c.id, label: `${c.code} - ${c.fullName}` }));
  const contractOptions = (contracts?.data ?? []).map((c) => ({ value: c.id, label: c.code }));
  const cashboxOptions = (cashboxes?.data ?? []).map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }));
  const bankOptions = (banks?.data ?? []).map((b) => ({ value: b.id, label: `${b.code} - ${b.bankName}` }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "customerId", label: "Customer", labelAr: "العميل", type: "select", required: true, options: customerOptions, createOnly: true },
    { name: "contractId", label: "Contract", labelAr: "العقد", type: "select", options: contractOptions, createOnly: true },
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money", required: true, createOnly: true },
    { name: "receiptDate", label: "Receipt Date", labelAr: "تاريخ السند", type: "date", required: true, createOnly: true },
    { name: "paymentMethod", label: "Payment Method", labelAr: "طريقة الدفع", type: "select", required: true, options: PAYMENT_METHODS, createOnly: true },
    { name: "cashboxId", label: "Cashbox (cash)", labelAr: "الخزينة (نقدي)", type: "select", options: cashboxOptions, createOnly: true },
    { name: "bankAccountId", label: "Bank Account (transfer)", labelAr: "الحساب البنكي (تحويل)", type: "select", options: bankOptions, createOnly: true },
    { name: "chequeNumber", label: "Cheque Number", labelAr: "رقم الشيك" },
    { name: "chequeDate", label: "Cheque Date", labelAr: "تاريخ الشيك", type: "date" },
    { name: "bankName", label: "Cheque Bank", labelAr: "بنك الشيك" },
    { name: "reference", label: "Reference", labelAr: "المرجع" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", required: true, options: STATUS },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<Receipt>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Date", headerAr: "التاريخ", render: (r) => r.receiptDate },
    { header: "Amount", headerAr: "المبلغ", render: (r) => r.amount },
    { header: "Method", headerAr: "الطريقة", render: (r) => <Badge variant="outline">{r.paymentMethod}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{r.status}</Badge> },
  ];

  return (
    <ResourceManager
      title="Receipts"
      titleAr="سندات القبض"
      columns={columns}
      fields={fields}
      useList={useListReceipts}
      useCreate={useCreateReceipt}
      useUpdate={useUpdateReceipt}
      useDelete={useDeleteReceipt}
      getListQueryKey={getListReceiptsQueryKey}
      companyId={companyId}
    />
  );
}
