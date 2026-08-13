import {
  useGetLegalContractReport,
  getGetLegalContractReportQueryKey,
  useGetLegalLitigationReport,
  getGetLegalLitigationReportQueryKey,
  useGetLegalClaimReport,
  getGetLegalClaimReportQueryKey,
  useGetLegalAdvisorReport,
  getGetLegalAdvisorReportQueryKey,
  useListCompanies,
  useListLegalAdvisors,
  useListLawFirms,
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
import { useLanguage } from "@/lib/language-provider";
import { enumLabel } from "@/lib/enums";

type Group = { key?: string | null; count: number };

function GroupTable({
  rows,
  keyHeader,
  countHeader,
  noData,
  render,
}: {
  rows: Group[];
  keyHeader: string;
  countHeader: string;
  noData: string;
  render: (key: string | null | undefined) => React.ReactNode;
}) {
  return (
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
              <TableCell>{render(r.key)}</TableCell>
              <TableCell className="text-end">{r.count}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export default function LegalReportsPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const enabled = !!companyId;
  const { data: advisors } = useListLegalAdvisors({ pageSize: 200 });
  const { data: lawFirms } = useListLawFirms({ pageSize: 200 });

  const advisorName = (id: string | null | undefined) => {
    const a = (advisors?.data ?? []).find((x) => x.id === id);
    return a ? (language === "ar" ? (a.nameAr ?? a.name) : a.name) : "-";
  };
  const lawFirmName = (id: string | null | undefined) => {
    const f = (lawFirms?.data ?? []).find((x) => x.id === id);
    return f ? (language === "ar" ? (f.nameAr ?? f.name) : f.name) : "-";
  };

  const params = { companyId };
  const { data: contractReport } = useGetLegalContractReport(params, {
    query: { enabled, queryKey: getGetLegalContractReportQueryKey(params) },
  });
  const { data: litigationReport } = useGetLegalLitigationReport(params, {
    query: { enabled, queryKey: getGetLegalLitigationReportQueryKey(params) },
  });
  const { data: claimReport } = useGetLegalClaimReport(params, {
    query: { enabled, queryKey: getGetLegalClaimReportQueryKey(params) },
  });
  const { data: advisorReport } = useGetLegalAdvisorReport(params, {
    query: { enabled, queryKey: getGetLegalAdvisorReportQueryKey(params) },
  });

  const noData = t("legal.no_data");
  const countHeader = t("common.count");
  const statusBadge = (k: string | null | undefined) => <Badge variant="secondary">{enumLabel(k, language)}</Badge>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title={t("legal.reports")}
        description={t("legal.reports_subtitle")}
        bordered={false}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("legal.report_contracts")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>{t("common.total")}</TableCell>
                  <TableCell className="text-end">{contractReport?.total ?? 0}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("legal.expiring_soon")}</TableCell>
                  <TableCell className="text-end">{contractReport?.expiringSoon ?? 0}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("legal.expired")}</TableCell>
                  <TableCell className="text-end">{contractReport?.expired ?? 0}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <GroupTable
              rows={(contractReport?.byStatus ?? []) as Group[]}
              keyHeader={t("common.status")}
              countHeader={countHeader}
              noData={noData}
              render={statusBadge}
            />
            <GroupTable
              rows={(contractReport?.byType ?? []) as Group[]}
              keyHeader={t("legal.contract_type")}
              countHeader={countHeader}
              noData={noData}
              render={statusBadge}
            />
            <GroupTable
              rows={(contractReport?.bySource ?? []) as Group[]}
              keyHeader={t("legal.source_module")}
              countHeader={countHeader}
              noData={noData}
              render={statusBadge}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("legal.report_litigation")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>{t("common.total")}</TableCell>
                  <TableCell className="text-end">{litigationReport?.total ?? 0}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("legal.claim_amount")}</TableCell>
                  <TableCell className="text-end">{litigationReport?.totalClaimAmount ?? "0"}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <GroupTable
              rows={(litigationReport?.byStatus ?? []) as Group[]}
              keyHeader={t("common.status")}
              countHeader={countHeader}
              noData={noData}
              render={statusBadge}
            />
            <GroupTable
              rows={(litigationReport?.byType ?? []) as Group[]}
              keyHeader={t("legal.case_type")}
              countHeader={countHeader}
              noData={noData}
              render={statusBadge}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("legal.report_claims")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>{t("common.total")}</TableCell>
                  <TableCell className="text-end">{claimReport?.total ?? 0}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("legal.amount")}</TableCell>
                  <TableCell className="text-end">{claimReport?.totalAmount ?? "0"}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <GroupTable
              rows={(claimReport?.byStatus ?? []) as Group[]}
              keyHeader={t("common.status")}
              countHeader={countHeader}
              noData={noData}
              render={statusBadge}
            />
            <GroupTable
              rows={(claimReport?.byType ?? []) as Group[]}
              keyHeader={t("legal.claim_type")}
              countHeader={countHeader}
              noData={noData}
              render={statusBadge}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("legal.report_advisors")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>{t("legal.cases_count")}</TableCell>
                  <TableCell className="text-end">{advisorReport?.totalCases ?? 0}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <GroupTable
              rows={(advisorReport?.byAdvisor ?? []) as Group[]}
              keyHeader={t("legal.by_advisor")}
              countHeader={countHeader}
              noData={noData}
              render={(k) => advisorName(k)}
            />
            <GroupTable
              rows={(advisorReport?.byLawFirm ?? []) as Group[]}
              keyHeader={t("legal.by_law_firm")}
              countHeader={countHeader}
              noData={noData}
              render={(k) => lawFirmName(k)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
