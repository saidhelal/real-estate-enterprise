import {
  useGetProcurementDashboard,
  getGetProcurementDashboardQueryKey,
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

export default function ProcurementDashboardPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId };
  const { data, isLoading } = useGetProcurementDashboard(params, {
    query: { enabled: !!companyId, queryKey: getGetProcurementDashboardQueryKey(params) },
  });

  if (isLoading) {
    return <p className="text-muted-foreground">{t("common.loading")}</p>;
  }
  if (!data) {
    return <p className="text-muted-foreground">{t("proc.no_data")}</p>;
  }

  const byPoStatus = data.purchaseOrdersByStatus ?? [];
  const byReqStatus = data.requestsByStatus ?? [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader title={t("nav.procurement_dashboard")} bordered={false} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={t("proc.suppliers_count")} value={data.suppliersCount} />
        <KpiCard label={t("proc.active_suppliers")} value={data.activeSuppliers} />
        <KpiCard label={t("proc.open_rfqs")} value={data.openRfqs} />
        <KpiCard label={t("proc.pending_requests")} value={data.pendingRequests} />
        <KpiCard label={t("proc.open_purchase_orders")} value={data.openPurchaseOrders} />
        <KpiCard label={t("proc.purchase_volume")} value={data.purchaseVolume} />
        <KpiCard label={t("proc.total_contract_value")} value={data.totalContractValue} />
        <KpiCard label={t("proc.pending_approvals")} value={data.pendingApprovals} />
        <KpiCard label={t("proc.pending_returns")} value={data.pendingReturns} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("proc.purchase_orders_by_status")}</CardTitle>
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
                {byPoStatus.length === 0 ? (
                  <TableState colSpan={2} isEmpty emptyTitle={t("proc.no_data")} />
                ) : (
                  byPoStatus.map((r) => (
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
            <CardTitle className="text-base">{t("proc.requests_by_status")}</CardTitle>
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
                {byReqStatus.length === 0 ? (
                  <TableState colSpan={2} isEmpty emptyTitle={t("proc.no_data")} />
                ) : (
                  byReqStatus.map((r) => (
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
    </div>
  );
}
