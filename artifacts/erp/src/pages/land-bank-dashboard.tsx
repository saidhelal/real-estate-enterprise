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
      <h2 className="text-2xl font-bold tracking-tight">{t("nav.land_bank_dashboard")}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label={t("lb.total_parcels")} value={data.totalParcels} />
        <Stat label={t("lb.total_area")} value={data.totalArea} />
        <Stat label={t("lb.total_market_value")} value={data.totalMarketValue} />
        <Stat label={t("lb.total_acquisition_cost")} value={data.totalAcquisitionCost} />
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
                <TableHead className="text-right">{t("common.count")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byStatus.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-center h-24">{t("lb.no_data")}</TableCell></TableRow>
              ) : (
                byStatus.map((r) => (
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
    </div>
  );
}
