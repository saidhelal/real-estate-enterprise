import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import {
  useListCompanies,
  listHandoverRequests,
  listHandoverSnags,
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel } from "@/lib/enums";
import {
  exportReportToExcel,
  exportReportToPdf,
  type ReportExport,
  type CellValue,
} from "@/lib/report-export";

export default function HandoverReportsPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const company = companies?.[0];
  const companyId = company?.id;
  const enabled = !!companyId;

  async function fetchAll<T>(
    fn: (params: { page: number; pageSize: number; companyId?: string }) => Promise<{ data: T[]; total: number }>,
  ): Promise<T[]> {
    const pageSize = 200;
    const out: T[] = [];
    let page = 1;
    for (;;) {
      const res = await fn({ page, pageSize, companyId });
      out.push(...res.data);
      if (out.length >= res.total || res.data.length === 0) break;
      page += 1;
    }
    return out;
  }

  const { data: requests = [] } = useQuery({
    queryKey: ["report", "handover-requests", companyId],
    queryFn: () => fetchAll((p) => listHandoverRequests(p)),
    enabled,
  });
  const { data: snags = [] } = useQuery({
    queryKey: ["report", "handover-snags", companyId],
    queryFn: () => fetchAll((p) => listHandoverSnags(p)),
    enabled,
  });

  const companyName = (language === "ar" ? company?.nameAr : company?.name) ?? company?.name ?? "";

  const requestRows = requests.map((r) => ({
    code: r.code,
    type: r.handoverType,
    status: r.status,
    date: r.requestDate ?? "-",
  }));

  function buildRequestReport(): ReportExport {
    return {
      title: t("hov.report_request_register"),
      companyName,
      language,
      meta: [],
      columns: [
        { header: t("common.code") },
        { header: t("hov.type") },
        { header: t("common.status") },
        { header: t("hov.request_date") },
      ],
      sections: [
        {
          rows: requestRows.map<CellValue[]>((r) => [
            r.code, enumLabel(r.type, language), enumLabel(r.status, language), r.date,
          ]),
        },
      ],
    };
  }

  const snagRows = snags.map((s) => ({
    title: (language === "ar" ? s.titleAr : s.title) ?? s.title,
    severity: s.severity,
    status: s.status,
    due: s.dueDate ?? "-",
  }));

  function buildSnagReport(): ReportExport {
    return {
      title: t("hov.report_snag_summary"),
      companyName,
      language,
      meta: [],
      columns: [
        { header: t("hov.title") },
        { header: t("hov.severity") },
        { header: t("common.status") },
        { header: t("hov.due_date") },
      ],
      sections: [
        {
          rows: snagRows.map<CellValue[]>((r) => [
            r.title, enumLabel(r.severity, language), enumLabel(r.status, language), r.due,
          ]),
        },
      ],
    };
  }

  const ExportMenu = ({ build, file }: { build: () => ReportExport; file: string }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={!enabled}>
          <Download className="h-4 w-4" />
          {t("common.export")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportReportToExcel(build(), file, t("acc.generated"))}>
          <FileSpreadsheet className="h-4 w-4" />
          {t("common.export_excel")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportReportToPdf(build(), t("acc.generated"))}>
          <FileText className="h-4 w-4" />
          {t("common.export_pdf")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title={t("hov.reports")}
        description={t("hov.reports_subtitle")}
        bordered={false}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">{t("hov.report_request_register")}</CardTitle>
          <ExportMenu build={buildRequestReport} file="handover-request-register" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.code")}</TableHead>
                <TableHead>{t("hov.type")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("hov.request_date")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requestRows.length === 0 ? (
                <TableState colSpan={4} isEmpty emptyTitle={t("lb.no_data")} />
              ) : (
                requestRows.map((r) => (
                  <TableRow key={r.code}>
                    <TableCell className="font-medium">{r.code}</TableCell>
                    <TableCell><Badge variant="secondary">{enumLabel(r.type, language)}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{enumLabel(r.status, language)}</Badge></TableCell>
                    <TableCell>{r.date}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">{t("hov.report_snag_summary")}</CardTitle>
          <ExportMenu build={buildSnagReport} file="handover-snag-summary" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("hov.title")}</TableHead>
                <TableHead>{t("hov.severity")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("hov.due_date")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snagRows.length === 0 ? (
                <TableState colSpan={4} isEmpty emptyTitle={t("lb.no_data")} />
              ) : (
                snagRows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell><Badge variant="secondary">{enumLabel(r.severity, language)}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{enumLabel(r.status, language)}</Badge></TableCell>
                    <TableCell>{r.due}</TableCell>
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
