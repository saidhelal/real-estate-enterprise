import {
  useGetFinancialAnalytics,
  getGetFinancialAnalyticsQueryKey,
  useListCompanies,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, Landmark, TrendingUp, TrendingDown, CircleDollarSign, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { BiComparativeChart } from "@/components/charts/BiComparativeChart";
import { BiPieChart } from "@/components/charts/BiPieChart";
import { useLanguage } from "@/lib/language-provider";
import { type ChartConfig } from "@/components/ui/chart";

export default function FinancialAnalyticsPage() {
  const { t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId };
  const { data, isLoading } = useGetFinancialAnalytics(params, {
    query: { enabled: !!companyId, queryKey: getGetFinancialAnalyticsQueryKey(params) },
  });

  const revExpConfig: ChartConfig = {
    primary: { label: t("bi.revenue"), color: "hsl(var(--chart-1))" },
    secondary: { label: t("bi.expense"), color: "hsl(var(--chart-2))" },
  };
  const cashFlowConfig: ChartConfig = {
    primary: { label: t("bi.inflow"), color: "hsl(var(--chart-3))" },
    secondary: { label: t("bi.outflow"), color: "hsl(var(--chart-4))" },
  };
  const accountConfig: ChartConfig = {
    value: { label: t("bi.value"), color: "hsl(var(--chart-5))" },
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("bi.financial_analytics")}</h2>
        <p className="text-muted-foreground">{t("bi.financial_subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title={t("bi.cash_balance")} value={data?.cashBalance} icon={Wallet} isLoading={isLoading} />
        <StatCard title={t("bi.bank_balance")} value={data?.bankBalance} icon={Landmark} isLoading={isLoading} />
        <StatCard title={t("bi.total_revenue")} value={data?.totalRevenue} icon={TrendingUp} isLoading={isLoading} />
        <StatCard title={t("bi.total_expenses")} value={data?.totalExpenses} icon={TrendingDown} isLoading={isLoading} />
        <StatCard title={t("bi.net_income")} value={data?.netIncome} icon={CircleDollarSign} isLoading={isLoading} />
        <StatCard title={t("bi.ar_outstanding")} value={data?.arOutstanding} icon={ArrowDownRight} isLoading={isLoading} />
        <StatCard title={t("bi.ap_outstanding")} value={data?.apOutstanding} icon={ArrowUpRight} isLoading={isLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("bi.revenue_vs_expense")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BiComparativeChart data={data?.revenueVsExpense ?? []} dataKeys={["primary", "secondary"]} config={revExpConfig} xKey="period" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("bi.cash_flow_trend")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BiComparativeChart data={data?.cashFlowTrend ?? []} dataKeys={["primary", "secondary"]} config={cashFlowConfig} xKey="period" variant="line" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("bi.account_type_breakdown")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BiPieChart data={data?.accountTypeBreakdown ?? []} dataKey="value" nameKey="key" config={accountConfig} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
