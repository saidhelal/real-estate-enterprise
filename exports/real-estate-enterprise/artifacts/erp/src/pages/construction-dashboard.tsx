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
      <h2 className="text-2xl font-bold tracking-tight">{t("nav.construction_dashboard")}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label={t("con.contracts_count")} value={data.contractsCount} />
        <Stat label={t("con.active_contracts")} value={data.activeContracts} />
        <Stat label={t("con.total_contract_value")} value={data.totalContractValue} />
        <Stat label={t("con.total_certified")} value={data.totalCertified} />
        <Stat label={t("con.total_deductions")} value={data.totalDeductions} />
        <Stat label={t("con.total_additions")} value={data.totalAdditions} />
        <Stat label={t("con.retention_held")} value={data.retentionHeld} />
        <Stat label={t("con.open_variations")} value={data.openVariations} />
        <Stat label={t("con.pending_approvals")} value={data.pendingApprovals} />
        <Stat label={t("con.pending_invoices")} value={data.pendingInvoices} />
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
                  <TableHead className="text-right">{t("common.count")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byContractStatus.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="text-center h-24">{t("con.no_data")}</TableCell></TableRow>
                ) : (
                  byContractStatus.map((r) => (
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
            <CardTitle className="text-base">{t("con.certificates_by_status")}</CardTitle>
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
                {byCertStatus.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="text-center h-24">{t("con.no_data")}</TableCell></TableRow>
                ) : (
                  byCertStatus.map((r) => (
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
