import {
  useGetCrmSalesPerformance,
  getGetCrmSalesPerformanceQueryKey,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/language-provider";

export default function CrmSalesPerformancePage() {
  const { t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId };
  const { data, isLoading } = useGetCrmSalesPerformance(params, {
    query: { enabled: !!companyId, queryKey: getGetCrmSalesPerformanceQueryKey(params) },
  });

  const reps = data?.reps ?? [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-bold tracking-tight">{t("crm.sales_performance.title")}</h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("crm.sales_performance.by_rep")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("crm.rep")}</TableHead>
                <TableHead className="text-end">{t("crm.stat.customers")}</TableHead>
                <TableHead className="text-end">{t("crm.stat.leads")}</TableHead>
                <TableHead className="text-end">{t("crm.stat.reservations")}</TableHead>
                <TableHead className="text-end">{t("crm.stat.contracts")}</TableHead>
                <TableHead className="text-end">{t("crm.stat.conversion_rate")}</TableHead>
                <TableHead className="text-end">{t("crm.contract_value")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                    {t("common.loading")}
                  </TableCell>
                </TableRow>
              ) : reps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                    {t("common.no_data")}
                  </TableCell>
                </TableRow>
              ) : (
                reps.map((r) => (
                  <TableRow key={r.userId}>
                    <TableCell className="font-medium">{r.userName ?? "-"}</TableCell>
                    <TableCell className="text-end">{r.customers}</TableCell>
                    <TableCell className="text-end">{r.leads}</TableCell>
                    <TableCell className="text-end">{r.reservations}</TableCell>
                    <TableCell className="text-end">{r.contracts}</TableCell>
                    <TableCell className="text-end">{r.conversionRate}%</TableCell>
                    <TableCell className="text-end">{r.totalContractValue}</TableCell>
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
