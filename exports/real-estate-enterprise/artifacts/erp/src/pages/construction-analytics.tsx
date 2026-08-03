import {
  useGetConstructionAnalytics,
  getGetConstructionAnalyticsQueryKey,
  useListCompanies,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSignature, TrendingUp, Gauge, Award } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { BiBarChart } from "@/components/charts/BiBarChart";
import { BiPieChart } from "@/components/charts/BiPieChart";
import { useLanguage } from "@/lib/language-provider";
import { type ChartConfig } from "@/components/ui/chart";

export default function ConstructionAnalyticsPage() {
  const { t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId };
  const { data, isLoading } = useGetConstructionAnalytics(params, {
    query: { enabled: !!companyId, queryKey: getGetConstructionAnalyticsQueryKey(params) },
  });

  const progressConfig: ChartConfig = {
    value: { label: t("bi.progress"), color: "hsl(var(--chart-1))" },
  };
  const certConfig: ChartConfig = {
    value: { label: t("bi.value"), color: "hsl(var(--chart-2))" },
  };
  const contractConfig: ChartConfig = {
    value: { label: t("bi.value"), color: "hsl(var(--chart-3))" },
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("bi.construction_analytics")}</h2>
        <p className="text-muted-foreground">{t("bi.construction_subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title={t("bi.contractor_contracts")} value={data?.contractorContracts} icon={FileSignature} isLoading={isLoading} />
        <StatCard title={t("bi.total_contract_value")} value={data?.totalContractValue} icon={TrendingUp} isLoading={isLoading} />
        <StatCard title={t("bi.avg_progress")} value={data?.avgProgress} icon={Gauge} isLoading={isLoading} />
        <StatCard title={t("bi.payment_certificates_value")} value={data?.paymentCertificatesValue} icon={Award} isLoading={isLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("bi.progress_by_project")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BiBarChart data={data?.progressByProject ?? []} dataKeys={["value"]} config={progressConfig} xKey="label" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("bi.certificates_by_status")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BiPieChart data={data?.certificatesByStatus ?? []} dataKey="value" nameKey="key" config={certConfig} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("bi.contracts_by_status")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BiPieChart data={data?.contractsByStatus ?? []} dataKey="value" nameKey="key" config={contractConfig} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
