import {
  useGetFixedAssetsDashboard,
  getGetFixedAssetsDashboardQueryKey,
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

export default function FixedAssetsDashboardPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId };
  const { data, isLoading } = useGetFixedAssetsDashboard(params, {
    query: { enabled: !!companyId, queryKey: getGetFixedAssetsDashboardQueryKey(params) },
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
      <h2 className="text-2xl font-bold tracking-tight">{t("nav.fixed_assets_dashboard")}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label={t("fa.total_assets")} value={data.totalAssets} />
        <Stat label={t("fa.total_cost")} value={data.totalAcquisitionCost} />
        <Stat label={t("fa.total_book_value")} value={data.totalBookValue} />
        <Stat label={t("fa.total_accum_dep")} value={data.totalAccumulatedDepreciation} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("fa.assets_by_status")}</CardTitle>
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
