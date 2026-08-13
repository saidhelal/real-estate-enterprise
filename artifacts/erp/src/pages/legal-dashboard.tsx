import {
  useGetLegalDashboard,
  getGetLegalDashboardQueryKey,
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

type Group = { key?: string | null; count: number };

function GroupCard({
  title,
  rows,
  keyHeader,
  countHeader,
  noData,
}: {
  title: string;
  rows: Group[];
  keyHeader: string;
  countHeader: string;
  noData: string;
}) {
  const { language } = useLanguage();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{keyHeader}</TableHead>
              <TableHead className="text-end">{countHeader}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableState colSpan={2} isEmpty emptyTitle={noData} />
            ) : (
              rows.map((r) => (
                <TableRow key={r.key ?? "none"}>
                  <TableCell><Badge variant="secondary">{enumLabel(r.key, language)}</Badge></TableCell>
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

export default function LegalDashboardPage() {
  const { t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId };
  const { data, isLoading } = useGetLegalDashboard(params, {
    query: { enabled: !!companyId, queryKey: getGetLegalDashboardQueryKey(params) },
  });

  if (isLoading) {
    return <p className="text-muted-foreground">{t("common.loading")}</p>;
  }
  if (!data) {
    return <p className="text-muted-foreground">{t("legal.no_data")}</p>;
  }

  const noData = t("legal.no_data");
  const keyHeader = t("common.status");
  const countHeader = t("common.count");

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader title={t("nav.legal_dashboard")} bordered={false} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={t("legal.contracts_count")} value={data.contractsCount} />
        <KpiCard label={t("legal.active_contracts")} value={data.activeContracts} />
        <KpiCard label={t("legal.expiring_soon")} value={data.expiringSoon} />
        <KpiCard label={t("legal.cases_count")} value={data.casesCount} />
        <KpiCard label={t("legal.open_cases")} value={data.openCases} />
        <KpiCard label={t("legal.pending_notices")} value={data.pendingNotices} />
        <KpiCard label={t("legal.total_claim_amount")} value={data.totalClaimAmount} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GroupCard
          title={t("legal.contracts_by_status")}
          rows={(data.contractsByStatus ?? []) as Group[]}
          keyHeader={keyHeader}
          countHeader={countHeader}
          noData={noData}
        />
        <GroupCard
          title={t("legal.contracts_by_type")}
          rows={(data.contractsByType ?? []) as Group[]}
          keyHeader={t("legal.contract_type")}
          countHeader={countHeader}
          noData={noData}
        />
        <GroupCard
          title={t("legal.contracts_by_source")}
          rows={(data.contractsBySource ?? []) as Group[]}
          keyHeader={t("legal.source_module")}
          countHeader={countHeader}
          noData={noData}
        />
        <GroupCard
          title={t("legal.cases_by_status")}
          rows={(data.casesByStatus ?? []) as Group[]}
          keyHeader={keyHeader}
          countHeader={countHeader}
          noData={noData}
        />
      </div>
    </div>
  );
}
