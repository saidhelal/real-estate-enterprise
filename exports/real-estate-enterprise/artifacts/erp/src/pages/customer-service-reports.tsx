import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import {
  useListCompanies,
  listSlaPolicies,
  listServiceEscalations,
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

export default function CustomerServiceReportsPage() {
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

  const { data: policies = [] } = useQuery({
    queryKey: ["report", "sla-policies", companyId],
    queryFn: () => fetchAll((p) => listSlaPolicies(p)),
    enabled,
  });
  const { data: escalations = [] } = useQuery({
    queryKey: ["report", "service-escalations", companyId],
    queryFn: () => fetchAll((p) => listServiceEscalations(p)),
    enabled,
  });

  const companyName = (language === "ar" ? company?.nameAr : company?.name) ?? company?.name ?? "";

  const policyRows = policies.map((p) => ({
    code: p.code,
    name: (language === "ar" ? p.nameAr : p.name) ?? p.name,
    channel: p.channel,
    priority: p.priority,
    firstResponse: p.firstResponseHours,
    resolution: p.resolutionHours,
  }));

  function buildPolicyReport(): ReportExport {
    return {
      title: t("cs.report_sla_register"),
      companyName,
      language,
      meta: [],
      columns: [
        { header: t("common.code") },
        { header: t("common.name") },
        { header: t("cs.channel") },
        { header: t("cs.priority") },
        { header: t("cs.first_response") },
        { header: t("cs.resolution") },
      ],
      sections: [
        {
          rows: policyRows.map<CellValue[]>((r) => [
            r.code, r.name, enumLabel(r.channel, language), enumLabel(r.priority, language), r.firstResponse, r.resolution,
          ]),
        },
      ],
    };
  }

  const escalationRows = escalations.map((e) => ({
    code: e.code,
    source: e.sourceType,
    status: e.status,
    escalatedAt: e.escalatedAt ?? "-",
  }));

  function buildEscalationReport(): ReportExport {
    return {
      title: t("cs.report_escalation_register"),
      companyName,
      language,
      meta: [],
      columns: [
        { header: t("common.code") },
        { header: t("cs.source") },
        { header: t("common.status") },
        { header: t("cs.escalated_at") },
      ],
      sections: [
        {
          rows: escalationRows.map<CellValue[]>((r) => [
            r.code, enumLabel(r.source, language), enumLabel(r.status, language), r.escalatedAt,
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
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("cs.reports")}</h2>
        <p className="text-muted-foreground">{t("cs.reports_subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">{t("cs.report_sla_register")}</CardTitle>
          <ExportMenu build={buildPolicyReport} file="sla-policy-register" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.code")}</TableHead>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("cs.channel")}</TableHead>
                <TableHead>{t("cs.priority")}</TableHead>
                <TableHead>{t("cs.first_response")}</TableHead>
                <TableHead>{t("cs.resolution")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policyRows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24">{t("lb.no_data")}</TableCell></TableRow>
              ) : (
                policyRows.map((r) => (
                  <TableRow key={r.code}>
                    <TableCell className="font-medium">{r.code}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell><Badge variant="secondary">{enumLabel(r.channel, language)}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{enumLabel(r.priority, language)}</Badge></TableCell>
                    <TableCell>{r.firstResponse}</TableCell>
                    <TableCell>{r.resolution}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">{t("cs.report_escalation_register")}</CardTitle>
          <ExportMenu build={buildEscalationReport} file="service-escalation-register" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.code")}</TableHead>
                <TableHead>{t("cs.source")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("cs.escalated_at")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {escalationRows.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center h-24">{t("lb.no_data")}</TableCell></TableRow>
              ) : (
                escalationRows.map((r) => (
                  <TableRow key={r.code}>
                    <TableCell className="font-medium">{r.code}</TableCell>
                    <TableCell><Badge variant="secondary">{enumLabel(r.source, language)}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{enumLabel(r.status, language)}</Badge></TableCell>
                    <TableCell>{r.escalatedAt}</TableCell>
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
