import {
  useGetGeneralAdminDashboard,
  getGetGeneralAdminDashboardQueryKey,
  useGetSecretariatOverview,
  getGetSecretariatOverviewQueryKey,
  useListCompanies,
} from "@workspace/api-client-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { useLanguage } from "@/lib/language-provider";

/**
 * General Administration.
 *
 * The department's front door. The section cards use the same anatomy as the
 * home launcher — tinted surface, accent bar, hue-on-hue chip — because they
 * are the same kind of object: a way in to a part of the system. Each one
 * points at an existing route; none of them is a screen in its own right.
 */

export default function GeneralAdminDashboardPage() {
  const { t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId };
  const { data: ga, isLoading } = useGetGeneralAdminDashboard(params, {
    query: { enabled: !!companyId, queryKey: getGetGeneralAdminDashboardQueryKey(params) },
  });
  const { data: sec } = useGetSecretariatOverview(params, {
    query: { enabled: !!companyId, queryKey: getGetSecretariatOverviewQueryKey(params) },
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title={t("nav.general_admin_dashboard")}
        description={t("ga.description")}
        bordered={false}
      />

      {/* The department's contents are not listed here any more. They live on
          the department's workspace at /department/general_admin, which every
          department now has and which reads the same navigation SSOT this
          section used to. Keeping both would have put the same cards on two
          screens — this page is the department's dashboard, one of the screens
          that workspace offers. */}

      <section className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight">{t("ga.overview_section")}</h3>
        {isLoading || !ga ? (
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

      {/* Correspondence volumes come from the secretariat's own read model,
          so this section and the desk can never disagree about the numbers. */}
      {sec ? (
        <section className="space-y-4">
          <h3 className="text-lg font-semibold tracking-tight">{t("sec.section.registers")}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <KpiCard label={t("sec.kpi.incoming")} value={sec.incomingCount} href="/correspondence" />
            <KpiCard label={t("sec.kpi.outgoing")} value={sec.outgoingCount} href="/correspondence" />
            <KpiCard label={t("sec.kpi.internal")} value={sec.internalCount} href="/internal-correspondence" />
            <KpiCard label={t("sec.kpi.awaiting_reply")} value={sec.correspondenceAwaitingReply} href="/secretariat" />
            <KpiCard label={t("sec.kpi.overdue_tasks")} value={sec.overdueTasks} href="/secretariat" />
          </div>
        </section>
      ) : null}
    </div>
  );
}
