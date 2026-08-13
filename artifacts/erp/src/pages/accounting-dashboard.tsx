import {
  useGetAccountingDashboard,
  getGetAccountingDashboardQueryKey,
  useListCompanies,
  useListCheques,
  getListChequesQueryKey,
} from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel } from "@/lib/enums";

export default function AccountingDashboardPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId };
  const { data, isLoading } = useGetAccountingDashboard(params, {
    query: { enabled: !!companyId, queryKey: getGetAccountingDashboardQueryKey(params) },
  });

  const chequeParams = { companyId, pageSize: 500 };
  const { data: chequesData } = useListCheques(chequeParams, {
    query: { enabled: !!companyId, queryKey: getListChequesQueryKey(chequeParams) },
  });
  const cheques = chequesData?.data ?? [];
  const PENDING_STATUSES = new Set(["received", "under_collection"]);
  const pendingCheques = cheques.filter((c) => PENDING_STATUSES.has(c.status));
  const chequesPendingCount = pendingCheques.length;
  const chequesClearedCount = cheques.filter((c) => c.status === "collected").length;
  const chequesDueAmount = pendingCheques
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0)
    .toFixed(2);

  if (isLoading) {
    return <p className="text-muted-foreground">{t("common.loading")}</p>;
  }
  if (!data) {
    return <p className="text-muted-foreground">{t("acc.no_data")}</p>;
  }

  const recent = data.recentEntries ?? [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader title={t("nav.accounting_dashboard")} bordered={false} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label={t("acc.assets")} value={data.totalAssets} />
        <KpiCard label={t("acc.liabilities")} value={data.totalLiabilities} />
        <KpiCard label={t("acc.equity")} value={data.totalEquity} />
        <KpiCard label={t("acc.revenue")} value={data.totalRevenue} />
        <KpiCard label={t("acc.expenses")} value={data.totalExpenses} />
        <KpiCard label={t("acc.net_income")} value={data.netIncome} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={t("acc.entry_count")} value={data.journalEntryCount ?? 0} />
        <KpiCard label={t("acc.draft_entries")} value={data.draftCount ?? 0} />
        <KpiCard label={t("acc.posted_entries")} value={data.postedCount ?? 0} />
        <KpiCard label={t("acc.open_periods")} value={data.openPeriodCount ?? 0} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard label={t("acc.cheques_pending")} value={chequesPendingCount} />
        <KpiCard label={t("acc.cheques_cleared")} value={chequesClearedCount} />
        <KpiCard label={t("acc.cheques_due")} value={chequesDueAmount} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("acc.recent_entries")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.code")}</TableHead>
                <TableHead>{t("acc.entry_date")}</TableHead>
                <TableHead>{t("acc.description")}</TableHead>
                <TableHead className="text-end">{t("acc.total_debit")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.length === 0 ? (
                <TableState colSpan={5} isEmpty emptyTitle={t("acc.no_data")} />
              ) : (
                recent.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.number}</TableCell>
                    <TableCell>{r.entryDate}</TableCell>
                    <TableCell>{language === "ar" ? r.descriptionAr || r.description : r.description}</TableCell>
                    <TableCell className="text-end">{r.totalDebit}</TableCell>
                    <TableCell><Badge variant="secondary">{enumLabel(r.status, language)}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
