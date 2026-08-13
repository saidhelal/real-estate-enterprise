import {
  useGetProcurementAnalytics,
  getGetProcurementAnalyticsQueryKey,
  useListCompanies,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ShoppingCart, TrendingUp, Star, Truck } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { BiBarChart } from "@/components/charts/BiBarChart";
import { BiAreaChart } from "@/components/charts/BiAreaChart";
import { BiPieChart } from "@/components/charts/BiPieChart";
import { useLanguage } from "@/lib/language-provider";
import { type ChartConfig } from "@/components/ui/chart";

export default function ProcurementAnalyticsPage() {
  const { t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId };
  const { data, isLoading } = useGetProcurementAnalytics(params, {
    query: { enabled: !!companyId, queryKey: getGetProcurementAnalyticsQueryKey(params) },
  });

  const monthConfig: ChartConfig = {
    value: { label: t("bi.value"), color: "hsl(var(--chart-1))" },
  };
  const statusConfig: ChartConfig = {
    value: { label: t("bi.value"), color: "hsl(var(--chart-2))" },
  };
  const supplierConfig: ChartConfig = {
    value: { label: t("bi.value"), color: "hsl(var(--chart-3))" },
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title={t("bi.procurement_analytics")}
        description={t("bi.procurement_subtitle")}
        bordered={false}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title={t("bi.purchase_orders")} value={data?.purchaseOrders} icon={ShoppingCart} isLoading={isLoading} />
        <StatCard title={t("bi.total_po_value")} value={data?.totalPoValue} icon={TrendingUp} isLoading={isLoading} />
        <StatCard title={t("bi.avg_supplier_rating")} value={data?.avgSupplierRating} icon={Star} isLoading={isLoading} />
        <StatCard title={t("bi.suppliers_count")} value={data?.suppliersCount} icon={Truck} isLoading={isLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("bi.po_by_month")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BiAreaChart data={data?.poByMonth ?? []} dataKeys={["value"]} config={monthConfig} xKey="period" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("bi.po_by_status")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BiPieChart data={data?.poByStatus ?? []} dataKey="value" nameKey="key" config={statusConfig} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("bi.top_suppliers")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BiBarChart data={data?.topSuppliers ?? []} dataKeys={["value"]} config={supplierConfig} xKey="label" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
