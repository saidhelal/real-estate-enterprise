import { useState } from "react";
import {
  useGetBudgetVsActual,
  getGetBudgetVsActualQueryKey,
  useListBudgets,
  useListCompanies,
} from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableFrame,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/lib/language-provider";

export default function BudgetVsActualPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: budgets } = useListBudgets({ pageSize: 100 });
  const budgetRows = budgets?.data ?? [];
  const [budgetId, setBudgetId] = useState("");

  const params = { companyId, budgetId: budgetId || undefined };
  const { data, isLoading } = useGetBudgetVsActual(params, {
    query: { enabled: !!companyId && !!budgetId, queryKey: getGetBudgetVsActualQueryKey(params) },
  });
  const rows = data?.rows ?? [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <PageHeader title={t("nav.budget_vs_actual")} bordered={false} />
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="space-y-2 min-w-[240px]">
          <Label>{t("acc.budget")}</Label>
          <Select value={budgetId} onValueChange={setBudgetId}>
            <SelectTrigger>
              <SelectValue placeholder={t("acc.select_budget")} />
            </SelectTrigger>
            <SelectContent>
              {budgetRows.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {language === "ar" ? b.nameAr : b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.code")}</TableHead>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead className="text-end">{t("acc.budgeted")}</TableHead>
              <TableHead className="text-end">{t("acc.actual")}</TableHead>
              <TableHead className="text-end">{t("acc.variance")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!budgetId ? (
              <TableState colSpan={5} isEmpty emptyTitle={t("acc.select_budget")} />
            ) : isLoading ? (
              <TableState colSpan={5} isLoading loadingLabel={t("common.loading")} emptyTitle={t("common.no_results")} />
            ) : rows.length === 0 ? (
              <TableState colSpan={5} isEmpty emptyTitle={t("acc.no_data")} />
            ) : (
              rows.map((r) => (
                <TableRow key={r.accountId}>
                  <TableCell className="font-medium">{r.code}</TableCell>
                  <TableCell>{language === "ar" ? r.nameAr : r.name}</TableCell>
                  <TableCell className="text-end">{r.budgeted}</TableCell>
                  <TableCell className="text-end">{r.actual}</TableCell>
                  <TableCell className="text-end">{r.variance}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {data && rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">{t("common.total")}</TableCell>
                <TableCell className="text-end font-semibold">{data.totalBudgeted}</TableCell>
                <TableCell className="text-end font-semibold">{data.totalActual}</TableCell>
                <TableCell className="text-end font-semibold">{data.totalVariance}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </TableFrame>
    </div>
  );
}
