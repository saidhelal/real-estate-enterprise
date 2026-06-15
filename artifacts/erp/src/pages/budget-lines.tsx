import {
  useListBudgetLines,
  useCreateBudgetLine,
  useUpdateBudgetLine,
  useDeleteBudgetLine,
  getListBudgetLinesQueryKey,
  useListBudgets,
  useListAccounts,
  useListCompanies,
  type BudgetLine,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function BudgetLinesPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: budgets } = useListBudgets({ pageSize: 100 });
  const { data: accounts } = useListAccounts({ pageSize: 500 });

  const budgetRows = budgets?.data ?? [];
  const accountRows = (accounts?.data ?? []).filter((a) => a.isPostable !== false);

  const budgetOptions = budgetRows.map((b) => ({ value: b.id, label: b.name, labelAr: b.nameAr }));
  const accountOptions = accountRows.map((a) => ({
    value: a.id,
    label: `${a.code} — ${a.name}`,
    labelAr: `${a.code} — ${a.nameAr}`,
  }));

  const budgetName = (id: string) => {
    const b = budgetRows.find((x) => x.id === id);
    return b ? (language === "ar" ? b.nameAr : b.name) : id;
  };
  const accountName = (id: string) => {
    const a = accountRows.find((x) => x.id === id);
    return a ? `${a.code} — ${language === "ar" ? a.nameAr : a.name}` : id;
  };

  const fields: ResourceField[] = [
    { name: "budgetId", label: t("acc.budget"), type: "select", required: true, options: budgetOptions },
    { name: "accountId", label: t("acc.account"), type: "select", required: true, options: accountOptions },
    { name: "amount", label: t("acc.budgeted"), type: "money", required: true },
    { name: "notes", label: t("acc.description"), type: "textarea" },
  ];

  const columns: ResourceColumn<BudgetLine>[] = [
    { header: t("acc.budget"), render: (r) => budgetName(r.budgetId) },
    { header: t("acc.account"), render: (r) => accountName(r.accountId) },
    { header: t("acc.budgeted"), render: (r) => <span className="text-right font-medium">{r.amount}</span> },
    { header: t("acc.description"), render: (r) => r.notes ?? "" },
  ];

  return (
    <ResourceManager
      title={t("nav.budget_lines")}
      columns={columns}
      fields={fields}
      useList={useListBudgetLines}
      useCreate={useCreateBudgetLine}
      useUpdate={useUpdateBudgetLine}
      useDelete={useDeleteBudgetLine}
      getListQueryKey={getListBudgetLinesQueryKey}
      companyId={companyId}
      searchable={false}
    />
  );
}
