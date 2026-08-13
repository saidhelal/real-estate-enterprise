import {
  useGetMarketingDashboard,
  getGetMarketingDashboardQueryKey,
  useListCompanies,
} from "@workspace/api-client-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { useLanguage } from "@/lib/language-provider";

function money(value?: string | number): string {
  if (value === undefined || value === null) return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default function MarketingDashboardPage() {
  const { t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId };
  const { data: mk, isLoading } = useGetMarketingDashboard(params, {
    query: { enabled: !!companyId, queryKey: getGetMarketingDashboardQueryKey(params) },
  });

  if (isLoading) {
    return <p className="text-muted-foreground">{t("common.loading")}</p>;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader title={t("nav.marketing_dashboard")} bordered={false} />

      <section className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight">{t("mk.overview_section")}</h3>
        {!mk ? (
          <p className="text-muted-foreground">{t("lb.no_data")}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard label={t("mk.ov_campaigns")} value={mk.campaignsCount} href="/marketing-campaigns" />
            <KpiCard label={t("mk.ov_running")} value={mk.runningCampaignsCount} href="/marketing-campaigns" />
            <KpiCard label={t("mk.ov_channels")} value={mk.channelsCount} href="/marketing-channels" />
            <KpiCard label={t("mk.ov_sources")} value={mk.leadSourcesCount} href="/lead-sources" />
            <KpiCard label={t("mk.ov_budget")} value={money(mk.totalBudget)} href="/marketing-campaigns" />
            <KpiCard label={t("mk.ov_actual")} value={money(mk.totalActualCost)} href="/marketing-campaigns" />
          </div>
        )}
      </section>
    </div>
  );
}
