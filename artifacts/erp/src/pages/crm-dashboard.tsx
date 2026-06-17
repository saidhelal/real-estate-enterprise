import {
  useGetCrmDashboard,
  getGetCrmDashboardQueryKey,
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

function CountTable({
  title,
  rows,
  language,
}: {
  title: string;
  rows: { key: string; count: number }[];
  language: "en" | "ar";
}) {
  const { t } = useLanguage();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
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
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center h-20 text-muted-foreground">
                  {t("common.no_data")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.key}>
                  <TableCell>
                    <Badge variant="secondary">{enumLabel(r.key, language)}</Badge>
                  </TableCell>
                  <TableCell className="text-end">{r.count}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function CrmDashboardPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId };
  const { data, isLoading } = useGetCrmDashboard(params, {
    query: { enabled: !!companyId, queryKey: getGetCrmDashboardQueryKey(params) },
  });

  if (isLoading) return <p className="text-muted-foreground">{t("common.loading")}</p>;
  if (!data) return <p className="text-muted-foreground">{t("common.no_data")}</p>;

  const ps = data.paymentStatus;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-bold tracking-tight">{t("crm.dashboard.title")}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label={t("crm.stat.customers")} value={data.totalCustomers} />
        <Stat label={t("crm.stat.leads")} value={data.totalLeads} />
        <Stat label={t("crm.stat.reservations")} value={data.totalReservations} />
        <Stat label={t("crm.stat.active_reservations")} value={data.activeReservations} />
        <Stat label={t("crm.stat.contracts")} value={data.totalContracts} />
        <Stat label={t("crm.stat.available_units")} value={data.availableUnits} />
        <Stat label={t("crm.stat.reserved_units")} value={data.reservedUnits} />
        <Stat label={t("crm.stat.sold_units")} value={data.soldUnits} />
        <Stat label={t("crm.stat.conversion_rate")} value={`${data.conversionRate}%`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("crm.payment_status")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-end">{t("common.count")}</TableHead>
                <TableHead className="text-end">{t("common.amount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell><Badge variant="secondary">{enumLabel("paid", language)}</Badge></TableCell>
                <TableCell className="text-end">{ps.paid}</TableCell>
                <TableCell className="text-end">{ps.paidAmount}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell><Badge variant="secondary">{enumLabel("pending", language)}</Badge></TableCell>
                <TableCell className="text-end">{ps.due}</TableCell>
                <TableCell className="text-end">{ps.dueAmount}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell><Badge variant="destructive">{enumLabel("overdue", language)}</Badge></TableCell>
                <TableCell className="text-end">{ps.overdue}</TableCell>
                <TableCell className="text-end">{ps.overdueAmount}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <CountTable title={t("crm.by_classification")} rows={data.customersByClassification} language={language} />
        <CountTable title={t("crm.leads_by_status")} rows={data.leadsByStatus} language={language} />
        <CountTable title={t("crm.reservations_by_status")} rows={data.reservationsByStatus} language={language} />
      </div>
    </div>
  );
}
