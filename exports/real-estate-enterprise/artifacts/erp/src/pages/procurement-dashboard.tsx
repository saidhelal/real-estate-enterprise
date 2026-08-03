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
      <h2 className="text-2xl font-bold tracking-tight">{t("nav.procurement_dashboard")}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label={t("proc.suppliers_count")} value={data.suppliersCount} />
        <Stat label={t("proc.active_suppliers")} value={data.activeSuppliers} />
        <Stat label={t("proc.open_rfqs")} value={data.openRfqs} />
        <Stat label={t("proc.pending_requests")} value={data.pendingRequests} />
        <Stat label={t("proc.open_purchase_orders")} value={data.openPurchaseOrders} />
        <Stat label={t("proc.purchase_volume")} value={data.purchaseVolume} />
        <Stat label={t("proc.total_contract_value")} value={data.totalContractValue} />
        <Stat label={t("proc.pending_approvals")} value={data.pendingApprovals} />
        <Stat label={t("proc.pending_returns")} value={data.pendingReturns} />
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
                  <TableHead className="text-right">{t("common.count")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byPoStatus.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="text-center h-24">{t("proc.no_data")}</TableCell></TableRow>
                ) : (
                  byPoStatus.map((r) => (
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("proc.requests_by_status")}</CardTitle>
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
                {byReqStatus.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="text-center h-24">{t("proc.no_data")}</TableCell></TableRow>
                ) : (
                  byReqStatus.map((r) => (
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
    </div>
  );
}
