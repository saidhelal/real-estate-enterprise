import {
  useGetAccountingDashboard,
  getGetAccountingDashboardQueryKey,
  useListCompanies,
} from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel } from "@/lib/enums";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function AccountingDashboardPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId };
  const { data, isLoading } = useGetAccountingDashboard(params, {
    query: { enabled: !!companyId, queryKey: getGetAccountingDashboardQueryKey(params) },
  });

  if (isLoading) {
    return <p className="text-muted-foreground">{t("common.loading")}</p>;
  }
  if (!data) {
    return <p className="text-muted-foreground">{t("acc.no_data")}</p>;
  }

  const recent = data.recentEntries ?? [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-bold tracking-tight">{t("nav.accounting_dashboard")}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Stat label={t("acc.assets")} value={data.totalAssets} />
        <Stat label={t("acc.liabilities")} value={data.totalLiabilities} />
        <Stat label={t("acc.equity")} value={data.totalEquity} />
        <Stat label={t("acc.revenue")} value={data.totalRevenue} />
        <Stat label={t("acc.expenses")} value={data.totalExpenses} />
        <Stat label={t("acc.net_income")} value={data.netIncome} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label={t("acc.entry_count")} value={data.journalEntryCount ?? 0} />
        <Stat label={t("acc.draft_entries")} value={data.draftCount ?? 0} />
        <Stat label={t("acc.posted_entries")} value={data.postedCount ?? 0} />
        <Stat label={t("acc.open_periods")} value={data.openPeriodCount ?? 0} />
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
                <TableHead className="text-right">{t("acc.total_debit")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24">{t("acc.no_data")}</TableCell></TableRow>
              ) : (
                recent.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.number}</TableCell>
                    <TableCell>{r.entryDate}</TableCell>
                    <TableCell>{language === "ar" ? r.descriptionAr || r.description : r.description}</TableCell>
                    <TableCell className="text-right">{r.totalDebit}</TableCell>
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
