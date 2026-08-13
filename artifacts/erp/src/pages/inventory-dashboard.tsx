import {
  useGetInventoryDashboard,
  getGetInventoryDashboardQueryKey,
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

export default function InventoryDashboardPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId };
  const { data, isLoading } = useGetInventoryDashboard(params, {
    query: { enabled: !!companyId, queryKey: getGetInventoryDashboardQueryKey(params) },
  });

  if (isLoading) {
    return <p className="text-muted-foreground">{t("common.loading")}</p>;
  }
  if (!data) {
    return <p className="text-muted-foreground">{t("inv.no_data")}</p>;
  }

  const byReceiptStatus = data.receiptsByStatus ?? [];
  const byIssueStatus = data.issuesByStatus ?? [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader title={t("nav.inventory_dashboard")} bordered={false} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={t("inv.items_count")} value={data.itemsCount} />
        <KpiCard label={t("inv.active_items")} value={data.activeItems} />
        <KpiCard label={t("inv.warehouses_count")} value={data.warehousesCount} />
        <KpiCard label={t("inv.low_stock_items")} value={data.lowStockItems} />
        <KpiCard label={t("inv.total_stock_value")} value={data.totalStockValue} />
        <KpiCard label={t("inv.pending_receipts")} value={data.pendingReceipts} />
        <KpiCard label={t("inv.pending_issues")} value={data.pendingIssues} />
        <KpiCard label={t("inv.pending_transfers")} value={data.pendingTransfers} />
        <KpiCard label={t("inv.pending_adjustments")} value={data.pendingAdjustments} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("inv.receipts_by_status")}</CardTitle>
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
                {byReceiptStatus.length === 0 ? (
                  <TableState colSpan={2} isEmpty emptyTitle={t("inv.no_data")} />
                ) : (
                  byReceiptStatus.map((r) => (
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
            <CardTitle className="text-base">{t("inv.issues_by_status")}</CardTitle>
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
                {byIssueStatus.length === 0 ? (
                  <TableState colSpan={2} isEmpty emptyTitle={t("inv.no_data")} />
                ) : (
                  byIssueStatus.map((r) => (
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
