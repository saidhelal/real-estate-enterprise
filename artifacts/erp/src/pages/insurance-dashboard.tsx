import {
  useGetInsuranceDashboard,
  getGetInsuranceDashboardQueryKey,
  useListCompanies,
} from "@workspace/api-client-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { useLanguage } from "@/lib/language-provider";

export default function InsuranceDashboardPage() {
  const { t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId };
  const { data: ins, isLoading } = useGetInsuranceDashboard(params, {
    query: { enabled: !!companyId, queryKey: getGetInsuranceDashboardQueryKey(params) },
  });

  if (isLoading) {
    return <p className="text-muted-foreground">{t("common.loading")}</p>;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader title={t("nav.insurance_dashboard")} bordered={false} />

      <section className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight">{t("ins.overview_section")}</h3>
        {!ins ? (
          <p className="text-muted-foreground">{t("lb.no_data")}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard label={t("ins.ov_insured")} value={ins.insuredCount} href="/employee-insurances" />
            <KpiCard label={t("ins.ov_suspended")} value={ins.suspendedCount} href="/employee-insurances" />
            <KpiCard label={t("ins.ov_subscriptions")} value={ins.subscriptionsTotal} href="/insurance-subscriptions" />
            <KpiCard label={t("ins.ov_arrears")} value={ins.arrearsTotal} href="/insurance-arrears" />
            <KpiCard label={t("ins.ov_penalties")} value={ins.penaltiesTotal} href="/insurance-penalties" />
            <KpiCard label={t("ins.ov_alerts")} value={ins.alertsCount} href="/insurance-arrears" />
          </div>
        )}
      </section>
    </div>
  );
}
