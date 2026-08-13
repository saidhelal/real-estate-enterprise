import {
  useGetLandBankDashboard,
  getGetLandBankDashboardQueryKey,
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

export default function LandBankDashboardPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId };
  const { data, isLoading } = useGetLandBankDashboard(params, {
    query: { enabled: !!companyId, queryKey: getGetLandBankDashboardQueryKey(params) },
  });

  if (isLoading) {
    return <p className="text-muted-foreground">{t("common.loading")}</p>;
  }
  if (!data) {
    return <p className="text-muted-foreground">{t("lb.no_data")}</p>;
  }

  const byStatus = data.byStatus ?? [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader title={t("nav.land_bank_dashboard")} bordered={false} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={t("lb.total_parcels")} value={data.totalParcels} />
        <KpiCard label={t("lb.total_area")} value={data.totalArea} />
        <KpiCard label={t("lb.total_market_value")} value={data.totalMarketValue} />
        <KpiCard label={t("lb.total_acquisition_cost")} value={data.totalAcquisitionCost} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("lb.parcels_by_status")}</CardTitle>
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
                <TableState colSpan={2} isEmpty emptyTitle={t("lb.no_data")} />
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
    </div>
  );
}
