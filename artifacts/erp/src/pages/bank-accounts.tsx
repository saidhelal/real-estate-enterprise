import {
  useListBankAccounts,
  useCreateBankAccount,
  useUpdateBankAccount,
  useDeleteBankAccount,
  getListBankAccountsQueryKey,
  useListCompanies,
  type BankAccount,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

const STATUS = enumOptions(["active", "inactive", "closed"]);

export default function BankAccountsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "bankName", label: "Bank Name", labelAr: "اسم البنك", required: true },
    { name: "bankNameAr", label: "Arabic Bank Name", labelAr: "اسم البنك بالعربية", required: true, rtl: true },
    { name: "accountNumber", label: "Account Number", labelAr: "رقم الحساب", required: true },
    { name: "iban", label: "IBAN", labelAr: "الآيبان" },
    { name: "openingBalance", label: "Opening Balance", labelAr: "الرصيد الافتتاحي", type: "money" },
    { name: "currentBalance", label: "Current Balance", labelAr: "الرصيد الحالي", type: "money" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", required: true, options: STATUS },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<BankAccount>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Bank", headerAr: "البنك", render: (r) => r.bankName },
    { header: "Account", headerAr: "الحساب", render: (r) => r.accountNumber },
    { header: "Current Balance", headerAr: "الرصيد الحالي", render: (r) => r.currentBalance },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Bank Accounts"
      titleAr="الحسابات البنكية"
      columns={columns}
      fields={fields}
      useList={useListBankAccounts}
      useCreate={useCreateBankAccount}
      useUpdate={useUpdateBankAccount}
      useDelete={useDeleteBankAccount}
      getListQueryKey={getListBankAccountsQueryKey}
      companyId={companyId}
    />
  );
}
