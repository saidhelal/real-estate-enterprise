import {
  useListBudgets,
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
  getListBudgetsQueryKey,
  useListCompanies,
  useListFiscalYears,
  type BudgetDetail,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

const STATUS = enumOptions(["draft", "approved", "active", "closed"]);

export default function BudgetsPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: years } = useListFiscalYears();

  const yearOptions = (years ?? []).map((y) => ({
    value: y.id,
    label: y.name,
    labelAr: y.name,
  }));

  const fields: ResourceField[] = [
    { name: "code", label: t("common.code"), required: true, createOnly: true },
    { name: "name", label: t("common.name"), required: true },
    { name: "nameAr", label: t("common.name_ar"), required: true, rtl: true },
    { name: "fiscalYearId", label: t("acc.fiscal_year"), type: "select", required: true, options: yearOptions },
    { name: "status", label: t("common.status"), type: "select", options: STATUS },
    { name: "description", label: t("acc.description"), type: "textarea" },
  ];

  const columns: ResourceColumn<BudgetDetail>[] = [
    { header: t("common.code"), render: (r) => <span className="font-medium">{r.code}</span> },
    { header: t("common.name"), render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: t("common.status"), render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title={t("nav.budgets")}
      columns={columns}
      fields={fields}
      useList={useListBudgets}
      useCreate={useCreateBudget}
      useUpdate={useUpdateBudget}
      useDelete={useDeleteBudget}
      getListQueryKey={getListBudgetsQueryKey}
      companyId={companyId}
    />
  );
}
