import {
  useGetGeneralAdminDashboard,
  getGetGeneralAdminDashboardQueryKey,
  useListCompanies,
} from "@workspace/api-client-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { useLanguage } from "@/lib/language-provider";

export default function GeneralAdminDashboardPage() {
  const { t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId };
  const { data: ga, isLoading } = useGetGeneralAdminDashboard(params, {
    query: { enabled: !!companyId, queryKey: getGetGeneralAdminDashboardQueryKey(params) },
  });

  if (isLoading) {
    return <p className="text-muted-foreground">{t("common.loading")}</p>;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader title={t("nav.general_admin_dashboard")} bordered={false} />

      <section className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight">{t("ga.overview_section")}</h3>
        {!ga ? (
          <p className="text-muted-foreground">{t("lb.no_data")}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard label={t("ga.ov_meetings")} value={ga.meetingsCount} href="/meetings" />
            <KpiCard label={t("ga.ov_decisions")} value={ga.decisionsCount} href="/administrative-decisions" />
            <KpiCard label={t("ga.ov_tasks")} value={ga.tasksCount} href="/administrative-tasks" />
            <KpiCard label={t("ga.ov_visitors")} value={ga.visitorsCount} href="/visitor-logs" />
            <KpiCard label={t("ga.ov_vehicles")} value={ga.vehiclesCount} href="/vehicles" />
            <KpiCard label={t("ga.ov_assets")} value={ga.assetsCount} href="/fixed-assets" />
          </div>
        )}
      </section>
    </div>
  );
}
