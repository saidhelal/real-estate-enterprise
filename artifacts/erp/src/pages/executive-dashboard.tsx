import {
  useGetExecutiveDashboard,
  getGetExecutiveDashboardQueryKey,
  useListCompanies,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  TrendingUp,
  CircleDollarSign,
  AlertTriangle,
  Home,
  BadgeCheck,
  BookMarked,
  Building,
  FileSignature,
  Wallet,
  Landmark,
  Users,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { BiLineChart } from "@/components/charts/BiLineChart";
import { BiPieChart } from "@/components/charts/BiPieChart";
import { useLanguage } from "@/lib/language-provider";
import { type ChartConfig } from "@/components/ui/chart";

export default function ExecutiveDashboardPage() {
  const { t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId };
  const { data, isLoading } = useGetExecutiveDashboard(params, {
    query: { enabled: !!companyId, queryKey: getGetExecutiveDashboardQueryKey(params) },
  });

  const trendConfig: ChartConfig = {
    value: { label: t("bi.value"), color: "hsl(var(--chart-1))" },
  };
  const collectionConfig: ChartConfig = {
    value: { label: t("bi.collected"), color: "hsl(var(--chart-2))" },
  };
  const unitConfig: ChartConfig = {
    value: { label: t("bi.units"), color: "hsl(var(--chart-1))" },
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("bi.executive_dashboard")}</h2>
        <p className="text-muted-foreground">{t("bi.executive_subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title={t("bi.total_sales_value")} value={data?.totalSalesValue} icon={TrendingUp} isLoading={isLoading} />
        <StatCard title={t("bi.total_collected")} value={data?.totalCollected} icon={CircleDollarSign} isLoading={isLoading} />
        <StatCard title={t("bi.total_outstanding")} value={data?.totalOutstanding} icon={AlertTriangle} isLoading={isLoading} />
        <StatCard title={t("bi.overdue_installments")} value={data?.overdueInstallments} icon={AlertTriangle} isLoading={isLoading} />
        <StatCard title={t("bi.units_sold")} value={data?.unitsSold} icon={Home} isLoading={isLoading} />
        <StatCard title={t("bi.units_available")} value={data?.unitsAvailable} icon={BadgeCheck} isLoading={isLoading} />
        <StatCard title={t("bi.units_reserved")} value={data?.unitsReserved} icon={BookMarked} isLoading={isLoading} />
        <StatCard title={t("bi.active_projects")} value={data?.activeProjects} icon={Building} isLoading={isLoading} />
        <StatCard title={t("bi.active_contracts")} value={data?.activeContracts} icon={FileSignature} isLoading={isLoading} />
        <StatCard title={t("bi.cash_on_hand")} value={data?.cashOnHand} icon={Wallet} isLoading={isLoading} />
        <StatCard title={t("bi.bank_balance")} value={data?.bankBalance} icon={Landmark} isLoading={isLoading} />
        <StatCard title={t("bi.employee_count")} value={data?.employeeCount} icon={Users} isLoading={isLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("bi.sales_trend")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BiLineChart data={data?.salesTrend ?? []} dataKeys={["value"]} config={trendConfig} xKey="period" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("bi.collection_trend")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BiLineChart data={data?.collectionTrend ?? []} dataKeys={["value"]} config={collectionConfig} xKey="period" />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("bi.unit_status_breakdown")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BiPieChart data={data?.unitStatusBreakdown ?? []} dataKey="value" nameKey="key" config={unitConfig} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
