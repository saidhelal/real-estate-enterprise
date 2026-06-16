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
      <h2 className="text-2xl font-bold tracking-tight">{t("nav.inventory_dashboard")}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label={t("inv.items_count")} value={data.itemsCount} />
        <Stat label={t("inv.active_items")} value={data.activeItems} />
        <Stat label={t("inv.warehouses_count")} value={data.warehousesCount} />
        <Stat label={t("inv.low_stock_items")} value={data.lowStockItems} />
        <Stat label={t("inv.total_stock_value")} value={data.totalStockValue} />
        <Stat label={t("inv.pending_receipts")} value={data.pendingReceipts} />
        <Stat label={t("inv.pending_issues")} value={data.pendingIssues} />
        <Stat label={t("inv.pending_transfers")} value={data.pendingTransfers} />
        <Stat label={t("inv.pending_adjustments")} value={data.pendingAdjustments} />
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
                  <TableHead className="text-right">{t("common.count")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byReceiptStatus.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="text-center h-24">{t("inv.no_data")}</TableCell></TableRow>
                ) : (
                  byReceiptStatus.map((r) => (
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
            <CardTitle className="text-base">{t("inv.issues_by_status")}</CardTitle>
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
                {byIssueStatus.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="text-center h-24">{t("inv.no_data")}</TableCell></TableRow>
                ) : (
                  byIssueStatus.map((r) => (
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
