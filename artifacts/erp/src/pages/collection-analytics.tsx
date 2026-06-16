import {
  useGetCollectionAnalytics,
  getGetCollectionAnalyticsQueryKey,
  useListCompanies,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CircleDollarSign, Wallet, AlertTriangle, Receipt, Percent } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { BiComparativeChart } from "@/components/charts/BiComparativeChart";
import { BiAreaChart } from "@/components/charts/BiAreaChart";
import { BiPieChart } from "@/components/charts/BiPieChart";
import { useLanguage } from "@/lib/language-provider";
import { type ChartConfig } from "@/components/ui/chart";

export default function CollectionAnalyticsPage() {
  const { t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId };
  const { data, isLoading } = useGetCollectionAnalytics(params, {
    query: { enabled: !!companyId, queryKey: getGetCollectionAnalyticsQueryKey(params) },
  });

  const collectionConfig: ChartConfig = {
    primary: { label: t("bi.due"), color: "hsl(var(--chart-1))" },
    secondary: { label: t("bi.paid"), color: "hsl(var(--chart-2))" },
  };
  const receiptsConfig: ChartConfig = {
    value: { label: t("bi.receipts"), color: "hsl(var(--chart-3))" },
  };
  const statusConfig: ChartConfig = {
    value: { label: t("bi.value"), color: "hsl(var(--chart-4))" },
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("bi.collection_analytics")}</h2>
        <p className="text-muted-foreground">{t("bi.collection_subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title={t("bi.total_due")} value={data?.totalDue} icon={CircleDollarSign} isLoading={isLoading} />
        <StatCard title={t("bi.total_paid")} value={data?.totalPaid} icon={Wallet} isLoading={isLoading} />
        <StatCard title={t("bi.total_outstanding")} value={data?.totalOutstanding} icon={AlertTriangle} isLoading={isLoading} />
        <StatCard title={t("bi.overdue_amount")} value={data?.overdueAmount} icon={AlertTriangle} isLoading={isLoading} />
        <StatCard title={t("bi.overdue_count")} value={data?.overdueCount} icon={Receipt} isLoading={isLoading} />
        <StatCard title={t("bi.collection_rate")} value={data?.collectionRate} icon={Percent} isLoading={isLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("bi.collection_by_month")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BiComparativeChart data={data?.collectionByMonth ?? []} dataKeys={["primary", "secondary"]} config={collectionConfig} xKey="period" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("bi.receipts_by_month")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BiAreaChart data={data?.receiptsByMonth ?? []} dataKeys={["value"]} config={receiptsConfig} xKey="period" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("bi.installments_by_status")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BiPieChart data={data?.installmentsByStatus ?? []} dataKey="value" nameKey="key" config={statusConfig} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
