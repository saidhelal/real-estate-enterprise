import {
  useGetConstructionDashboard,
  getGetConstructionDashboardQueryKey,
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

export default function ConstructionDashboardPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId };
  const { data, isLoading } = useGetConstructionDashboard(params, {
    query: { enabled: !!companyId, queryKey: getGetConstructionDashboardQueryKey(params) },
  });

  if (isLoading) {
    return <p className="text-muted-foreground">{t("common.loading")}</p>;
  }
  if (!data) {
    return <p className="text-muted-foreground">{t("con.no_data")}</p>;
  }

  const byContractStatus = data.contractsByStatus ?? [];
  const byCertStatus = data.certificatesByStatus ?? [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader title={t("nav.construction_dashboard")} bordered={false} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={t("con.contracts_count")} value={data.contractsCount} />
        <KpiCard label={t("con.active_contracts")} value={data.activeContracts} />
        <KpiCard label={t("con.total_contract_value")} value={data.totalContractValue} />
        <KpiCard label={t("con.total_certified")} value={data.totalCertified} />
        <KpiCard label={t("con.total_deductions")} value={data.totalDeductions} />
        <KpiCard label={t("con.total_additions")} value={data.totalAdditions} />
        <KpiCard label={t("con.retention_held")} value={data.retentionHeld} />
        <KpiCard label={t("con.open_variations")} value={data.openVariations} />
        <KpiCard label={t("con.pending_approvals")} value={data.pendingApprovals} />
        <KpiCard label={t("con.pending_invoices")} value={data.pendingInvoices} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("con.contracts_by_status")}</CardTitle>
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
                {byContractStatus.length === 0 ? (
                  <TableState colSpan={2} isEmpty emptyTitle={t("con.no_data")} />
                ) : (
                  byContractStatus.map((r) => (
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
            <CardTitle className="text-base">{t("con.certificates_by_status")}</CardTitle>
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
                {byCertStatus.length === 0 ? (
                  <TableState colSpan={2} isEmpty emptyTitle={t("con.no_data")} />
                ) : (
                  byCertStatus.map((r) => (
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
