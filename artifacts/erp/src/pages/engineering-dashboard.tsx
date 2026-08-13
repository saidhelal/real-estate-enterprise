import {
  useGetEngineeringDashboard,
  getGetEngineeringDashboardQueryKey,
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

export default function EngineeringDashboardPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId };
  const { data, isLoading } = useGetEngineeringDashboard(params, {
    query: { enabled: !!companyId, queryKey: getGetEngineeringDashboardQueryKey(params) },
  });

  if (isLoading) {
    return <p className="text-muted-foreground">{t("common.loading")}</p>;
  }
  if (!data) {
    return <p className="text-muted-foreground">{t("eng.no_data")}</p>;
  }

  const byStatus = data.drawingsByStatus ?? [];
  const bySeverity = data.defectsBySeverity ?? [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader title={t("nav.engineering_dashboard")} bordered={false} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={t("eng.drawings_count")} value={data.drawingsCount} />
        <KpiCard label={t("eng.pending_drawing_approvals")} value={data.pendingDrawingApprovals} />
        <KpiCard label={t("eng.boq_count")} value={data.boqCount} />
        <KpiCard label={t("eng.total_boq_value")} value={data.totalBoqValue} />
        <KpiCard label={t("eng.open_rfis")} value={data.openRfis} />
        <KpiCard label={t("eng.open_defects")} value={data.openDefects} />
        <KpiCard label={t("eng.open_inspections")} value={data.openInspections} />
        <KpiCard label={t("eng.consultants_count")} value={data.consultantsCount} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("eng.drawings_by_status")}</CardTitle>
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
                {byStatus.length === 0 ? (
                  <TableState colSpan={2} isEmpty emptyTitle={t("eng.no_data")} />
                ) : (
                  byStatus.map((r) => (
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("eng.defects_by_severity")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("eng.open_defects")}</TableHead>
                  <TableHead className="text-end">{t("common.count")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bySeverity.length === 0 ? (
                  <TableState colSpan={2} isEmpty emptyTitle={t("eng.no_data")} />
                ) : (
                  bySeverity.map((r) => (
                    <TableRow key={r.severity}>
                      <TableCell><Badge variant="secondary">{enumLabel(r.severity, language)}</Badge></TableCell>
                      <TableCell className="text-end">{r.count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
