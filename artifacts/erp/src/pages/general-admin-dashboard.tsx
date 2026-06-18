import {
  useGetGeneralAdminDashboard,
  getGetGeneralAdminDashboardQueryKey,
  useListCompanies,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/language-provider";

function Stat({ label, value, href }: { label: string; value: string | number; href: string }) {
  return (
    <Link href={href}>
      <Card className="cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{value}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

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
      <h2 className="text-2xl font-bold tracking-tight">{t("nav.general_admin_dashboard")}</h2>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight">{t("ga.overview_section")}</h3>
        {!ga ? (
          <p className="text-muted-foreground">{t("lb.no_data")}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <Stat label={t("ga.ov_meetings")} value={ga.meetingsCount} href="/meetings" />
            <Stat label={t("ga.ov_decisions")} value={ga.decisionsCount} href="/administrative-decisions" />
            <Stat label={t("ga.ov_tasks")} value={ga.tasksCount} href="/administrative-tasks" />
            <Stat label={t("ga.ov_visitors")} value={ga.visitorsCount} href="/visitor-logs" />
            <Stat label={t("ga.ov_vehicles")} value={ga.vehiclesCount} href="/vehicles" />
            <Stat label={t("ga.ov_assets")} value={ga.assetsCount} href="/fixed-assets" />
          </div>
        )}
      </section>
    </div>
  );
}
