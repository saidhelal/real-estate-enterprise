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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel } from "@/lib/enums";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

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
      <h2 className="text-2xl font-bold tracking-tight">{t("nav.customer_service_dashboard")}</h2>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold tracking-tight">{t("cs.overview_section")}</h3>
        {!cs ? (
          <p className="text-muted-foreground">{t("lb.no_data")}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <Stat label={t("cs.ov_customers")} value={cs.customers} />
            <Stat label={t("cs.ov_contracts")} value={cs.contracts} />
            <Stat label={t("cs.ov_reservations")} value={cs.reservations} />
            <Stat label={t("cs.ov_installment_plans")} value={cs.installmentPlans} />
            <Stat label={t("cs.ov_installment_schedules")} value={cs.installmentSchedules} />
            <Stat label={t("cs.ov_delivered_units")} value={cs.deliveredUnits} />
            <Stat label={t("cs.ov_service_requests")} value={cs.totalEscalations} />
            <Stat label={t("cs.ov_complaints")} value={cs.complaints} />
            <Stat label={t("cs.ov_follow_ups")} value={cs.followUps} />
            <Stat label={t("cs.ov_leads")} value={cs.leads} />
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
              <Stat label={t("cs.total_escalations")} value={cs.totalEscalations} />
              <Stat label={t("cs.open_escalations")} value={cs.openEscalations} />
              <Stat label={t("cs.sla_policies")} value={cs.slaPolicies} />
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
                      <TableHead className="text-right">{t("common.count")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csByStatus.length === 0 ? (
                      <TableRow><TableCell colSpan={2} className="text-center h-24">{t("lb.no_data")}</TableCell></TableRow>
                    ) : (
                      csByStatus.map((r) => (
                        <TableRow key={r.status}>
                          <TableCell><Badge variant="secondary">{enumLabel(r.status, language)}</Badge></TableCell>
                          <TableCell className="text-right">{r.count}</TableCell>
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
              <Stat label={t("hov.total_requests")} value={hov.totalRequests} />
              <Stat label={t("hov.scheduled")} value={hov.scheduledCount} />
              <Stat label={t("hov.completed")} value={hov.completedCount} />
              <Stat label={t("hov.open_snags")} value={hov.openSnags} />
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
                      <TableHead className="text-right">{t("common.count")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hovByStatus.length === 0 ? (
                      <TableRow><TableCell colSpan={2} className="text-center h-24">{t("lb.no_data")}</TableCell></TableRow>
                    ) : (
                      hovByStatus.map((r) => (
                        <TableRow key={r.status}>
                          <TableCell><Badge variant="secondary">{enumLabel(r.status, language)}</Badge></TableCell>
                          <TableCell className="text-right">{r.count}</TableCell>
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
