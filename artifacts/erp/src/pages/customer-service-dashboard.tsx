import {
  useGetCustomerServiceDashboard,
  getGetCustomerServiceDashboardQueryKey,
  useGetHandoverDashboard,
  getGetHandoverDashboardQueryKey,
  useListCompanies,
} from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel } from "@/lib/enums";

export default function CustomerServiceDashboardPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId };
  const { data: cs, isLoading: csLoading } = useGetCustomerServiceDashboard(params, {
    query: { enabled: !!companyId, queryKey: getGetCustomerServiceDashboardQueryKey(params) },
  });
  const { data: hov, isLoading: hovLoading } = useGetHandoverDashboard(params, {
    query: { enabled: !!companyId, queryKey: getGetHandoverDashboardQueryKey(params) },
  });

  if (csLoading && hovLoading) {
    return <p className="text-muted-foreground">{t("common.loading")}</p>;
  }

  const csByStatus = cs?.byStatus ?? [];
  const hovByStatus = hov?.byStatus ?? [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader title={t("nav.customer_service_dashboard")} bordered={false} />

      <section className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight">{t("cs.overview_section")}</h3>
        {!cs ? (
          <p className="text-muted-foreground">{t("lb.no_data")}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <KpiCard label={t("cs.ov_customers")} value={cs.customers} />
            <KpiCard label={t("cs.ov_contracts")} value={cs.contracts} />
            <KpiCard label={t("cs.ov_reservations")} value={cs.reservations} />
            <KpiCard label={t("cs.ov_installment_plans")} value={cs.installmentPlans} />
            <KpiCard label={t("cs.ov_installment_schedules")} value={cs.installmentSchedules} />
            <KpiCard label={t("cs.ov_delivered_units")} value={cs.deliveredUnits} />
            <KpiCard label={t("cs.ov_service_requests")} value={cs.totalEscalations} />
            <KpiCard label={t("cs.ov_complaints")} value={cs.complaints} />
            <KpiCard label={t("cs.ov_follow_ups")} value={cs.followUps} />
            <KpiCard label={t("cs.ov_leads")} value={cs.leads} />
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight">{t("cs.after_sales_section")}</h3>
        {!cs ? (
          <p className="text-muted-foreground">{t("lb.no_data")}</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard label={t("cs.total_escalations")} value={cs.totalEscalations} />
              <KpiCard label={t("cs.open_escalations")} value={cs.openEscalations} />
              <KpiCard label={t("cs.sla_policies")} value={cs.slaPolicies} />
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("cs.escalations_by_status")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead className="text-end">{t("common.count")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csByStatus.length === 0 ? (
                      <TableState colSpan={2} isEmpty emptyTitle={t("lb.no_data")} />
                    ) : (
                      csByStatus.map((r) => (
                        <TableRow key={r.status}>
                          <TableCell><Badge variant="secondary">{enumLabel(r.status, language)}</Badge></TableCell>
                          <TableCell className="text-end">{r.count}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight">{t("cs.handover_section")}</h3>
        {!hov ? (
          <p className="text-muted-foreground">{t("lb.no_data")}</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label={t("hov.total_requests")} value={hov.totalRequests} />
              <KpiCard label={t("hov.scheduled")} value={hov.scheduledCount} />
              <KpiCard label={t("hov.completed")} value={hov.completedCount} />
              <KpiCard label={t("hov.open_snags")} value={hov.openSnags} />
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("hov.requests_by_status")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead className="text-end">{t("common.count")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hovByStatus.length === 0 ? (
                      <TableState colSpan={2} isEmpty emptyTitle={t("lb.no_data")} />
                    ) : (
                      hovByStatus.map((r) => (
                        <TableRow key={r.status}>
                          <TableCell><Badge variant="secondary">{enumLabel(r.status, language)}</Badge></TableCell>
                          <TableCell className="text-end">{r.count}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </section>
    </div>
  );
}
