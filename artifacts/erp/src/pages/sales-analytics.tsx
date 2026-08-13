import {
  useGetSalesAnalytics,
  getGetSalesAnalyticsQueryKey,
  useListCompanies,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { FileSignature, TrendingUp, Wallet, BadgeCheck, BookMarked, UserPlus } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { BiBarChart } from "@/components/charts/BiBarChart";
import { BiPieChart } from "@/components/charts/BiPieChart";
import { useLanguage } from "@/lib/language-provider";
import { type ChartConfig } from "@/components/ui/chart";

export default function SalesAnalyticsPage() {
  const { t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId };
  const { data, isLoading } = useGetSalesAnalytics(params, {
    query: { enabled: !!companyId, queryKey: getGetSalesAnalyticsQueryKey(params) },
  });

  const monthConfig: ChartConfig = {
    value: { label: t("bi.value"), color: "hsl(var(--chart-1))" },
  };
  const projectConfig: ChartConfig = {
    value: { label: t("bi.value"), color: "hsl(var(--chart-2))" },
  };
  const statusConfig: ChartConfig = {
    value: { label: t("bi.value"), color: "hsl(var(--chart-3))" },
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title={t("bi.sales_analytics")}
        description={t("bi.sales_subtitle")}
        bordered={false}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title={t("bi.total_contracts")} value={data?.totalContracts} icon={FileSignature} isLoading={isLoading} />
        <StatCard title={t("bi.total_contract_value")} value={data?.totalContractValue} icon={TrendingUp} isLoading={isLoading} />
        <StatCard title={t("bi.total_down_payments")} value={data?.totalDownPayments} icon={Wallet} isLoading={isLoading} />
        <StatCard title={t("bi.avg_contract_value")} value={data?.avgContractValue} icon={BadgeCheck} isLoading={isLoading} />
        <StatCard title={t("bi.reservations_count")} value={data?.reservationsCount} icon={BookMarked} isLoading={isLoading} />
        <StatCard title={t("bi.reservations_value")} value={data?.reservationsValue} icon={Wallet} isLoading={isLoading} />
        <StatCard title={t("bi.leads_count")} value={data?.leadsCount} icon={UserPlus} isLoading={isLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("bi.sales_by_month")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BiBarChart data={data?.salesByMonth ?? []} dataKeys={["value"]} config={monthConfig} xKey="period" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("bi.sales_by_project")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BiBarChart data={data?.salesByProject ?? []} dataKeys={["value"]} config={projectConfig} xKey="label" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("bi.sales_by_status")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BiPieChart data={data?.salesByStatus ?? []} dataKey="value" nameKey="key" config={statusConfig} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
