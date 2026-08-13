import {
  useGetInventoryAnalytics,
  getGetInventoryAnalyticsQueryKey,
  useListCompanies,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Package, AlertTriangle, PackageX, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { BiBarChart } from "@/components/charts/BiBarChart";
import { useLanguage } from "@/lib/language-provider";
import { type ChartConfig } from "@/components/ui/chart";

export default function InventoryAnalyticsPage() {
  const { t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId };
  const { data, isLoading } = useGetInventoryAnalytics(params, {
    query: { enabled: !!companyId, queryKey: getGetInventoryAnalyticsQueryKey(params) },
  });

  const valueConfig: ChartConfig = {
    value: { label: t("bi.value"), color: "hsl(var(--chart-1))" },
  };
  const lowStockConfig: ChartConfig = {
    value: { label: t("bi.quantity"), color: "hsl(var(--chart-2))" },
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title={t("bi.inventory_analytics")}
        description={t("bi.inventory_subtitle")}
        bordered={false}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title={t("bi.total_items")} value={data?.totalItems} icon={Package} isLoading={isLoading} />
        <StatCard title={t("bi.low_stock_count")} value={data?.lowStockCount} icon={AlertTriangle} isLoading={isLoading} />
        <StatCard title={t("bi.out_of_stock_count")} value={data?.outOfStockCount} icon={PackageX} isLoading={isLoading} />
        <StatCard title={t("bi.total_stock_value")} value={data?.totalStockValue} icon={TrendingUp} isLoading={isLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("bi.value_by_item")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BiBarChart data={data?.valueByItem ?? []} dataKeys={["value"]} config={valueConfig} xKey="label" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("bi.low_stock_items")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BiBarChart data={data?.lowStockItems ?? []} dataKeys={["value"]} config={lowStockConfig} xKey="label" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
