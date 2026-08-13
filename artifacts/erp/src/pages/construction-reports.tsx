import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import {
  useListCompanies,
  listContractors,
  listContractorContracts,
  listPaymentCertificates,
  listRetentions,
  listAdvancePayments,
  listAdvanceRecoverys,
} from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
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

function num(v: string | null | undefined): number {
  if (!v) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmt(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ConstructionReportsPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const company = companies?.[0];
  const companyId = company?.id;
  const enabled = !!companyId;

  // The server caps pageSize at 200, so reports must page through every row to
  // aggregate accurate totals rather than truncating at a single page.
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

  const { data: contractors = [] } = useQuery({
    queryKey: ["report", "contractors", companyId],
    queryFn: () => fetchAll((p) => listContractors(p)),
    enabled,
  });
  const { data: contracts = [] } = useQuery({
    queryKey: ["report", "contracts", companyId],
    queryFn: () => fetchAll((p) => listContractorContracts(p)),
    enabled,
  });
  const { data: certs = [] } = useQuery({
    queryKey: ["report", "certs", companyId],
    queryFn: () => fetchAll((p) => listPaymentCertificates(p)),
    enabled,
  });
  const { data: retentions = [] } = useQuery({
    queryKey: ["report", "retentions", companyId],
    queryFn: () => fetchAll((p) => listRetentions(p)),
    enabled,
  });
  const { data: advances = [] } = useQuery({
    queryKey: ["report", "advances", companyId],
    queryFn: () => fetchAll((p) => listAdvancePayments(p)),
    enabled,
  });
  const { data: recoveries = [] } = useQuery({
    queryKey: ["report", "recoveries", companyId],
    queryFn: () => fetchAll((p) => listAdvanceRecoverys(p)),
    enabled,
  });

  const contractorName = (id: string | null | undefined) => {
    const c = contractors.find((x) => x.id === id);
    if (!c) return "-";
    return (language === "ar" ? c.nameAr : c.name) ?? c.name ?? "-";
  };
  const contractLabel = (id: string | null | undefined) => {
    const c = contracts.find((x) => x.id === id);
    return c?.code ?? "-";
  };

  // Contract financial summary: certified per contract
  const certifiedByContract = new Map<string, number>();
  for (const cert of certs) {
    if (!cert.contractId) continue;
    certifiedByContract.set(cert.contractId, (certifiedByContract.get(cert.contractId) ?? 0) + num(cert.netAmount));
  }

  const contractRows = contracts.map((c) => ({
    code: c.code,
    contractor: contractorName(c.contractorId),
    status: c.status,
    value: num(c.contractValue),
    certified: certifiedByContract.get(c.id) ?? 0,
  }));
  const totalContractValue = contractRows.reduce((s, r) => s + r.value, 0);
  const totalCertified = contractRows.reduce((s, r) => s + r.certified, 0);

  const totalGross = certs.reduce((s, r) => s + num(r.grossAmount), 0);
  const totalNet = certs.reduce((s, r) => s + num(r.netAmount), 0);

  const totalRetained = retentions.reduce((s, r) => s + num(r.retainedAmount), 0);
  const totalReleased = retentions.reduce((s, r) => s + num(r.releasedAmount), 0);

  // Recovery is tracked by the dedicated advance-recoveries entity (the actual
  // recovery transactions). Use that as the single source of truth so the
  // summary card and the detailed report below never disagree or double-count.
  const recoveredByAdvance = new Map<string, number>();
  for (const rec of recoveries) {
    if (!rec.advanceId) continue;
    recoveredByAdvance.set(rec.advanceId, (recoveredByAdvance.get(rec.advanceId) ?? 0) + num(rec.amount));
  }
  const totalAdvance = advances.reduce((s, r) => s + num(r.amount), 0);
  const totalRecovered = recoveries.reduce((s, r) => s + num(r.amount), 0);

  const companyName = (language === "ar" ? company?.nameAr : company?.name) ?? company?.name ?? "";

  // ---- Report 1: Certificate Register (all certificates) ----
  const registerRows = certs.map((c) => ({
    code: c.code,
    contract: contractLabel(c.contractId),
    date: c.certificateDate ?? "-",
    gross: num(c.grossAmount),
    net: num(c.netAmount),
    status: c.status,
  }));
  const registerGross = registerRows.reduce((s, r) => s + r.gross, 0);
  const registerNet = registerRows.reduce((s, r) => s + r.net, 0);

  function buildRegisterReport(): ReportExport {
    return {
      title: t("con.report_certificate_register"),
      companyName,
      language,
      meta: [],
      columns: [
        { header: t("common.code") },
        { header: t("con.contract") },
        { header: t("con.date") },
        { header: t("con.gross"), numeric: true },
        { header: t("con.net"), numeric: true },
        { header: t("common.status") },
      ],
      sections: [
        {
          rows: registerRows.map<CellValue[]>((r) => [
            r.code, r.contract, r.date, fmt(r.gross), fmt(r.net), enumLabel(r.status, language),
          ]),
          totalRow: [t("con.total"), "", "", fmt(registerGross), fmt(registerNet), ""],
        },
      ],
    };
  }

  // ---- Report 2: Outstanding Certificates (not paid/closed) ----
  const outstandingRows = certs
    .filter((c) => c.status !== "paid" && c.status !== "closed")
    .map((c) => ({
      code: c.code,
      contract: contractLabel(c.contractId),
      date: c.certificateDate ?? "-",
      net: num(c.netAmount),
      status: c.status,
    }));
  const outstandingNet = outstandingRows.reduce((s, r) => s + r.net, 0);

  function buildOutstandingReport(): ReportExport {
    return {
      title: t("con.report_outstanding_certificates"),
      companyName,
      language,
      meta: [],
      columns: [
        { header: t("common.code") },
        { header: t("con.contract") },
        { header: t("con.date") },
        { header: t("con.net"), numeric: true },
        { header: t("common.status") },
      ],
      sections: [
        {
          rows: outstandingRows.map<CellValue[]>((r) => [
            r.code, r.contract, r.date, fmt(r.net), enumLabel(r.status, language),
          ]),
          totalRow: [t("con.total"), "", "", fmt(outstandingNet), ""],
        },
      ],
    };
  }

  // ---- Report 3: Retention (held vs released) ----
  const retentionRows = retentions.map((r) => {
    const retained = num(r.retainedAmount);
    const released = num(r.releasedAmount);
    return {
      code: r.code,
      contract: contractLabel(r.contractId),
      retained,
      released,
      outstanding: retained - released,
      status: r.status,
    };
  });
  const retRetained = retentionRows.reduce((s, r) => s + r.retained, 0);
  const retReleased = retentionRows.reduce((s, r) => s + r.released, 0);
  const retOutstanding = retRetained - retReleased;

  function buildRetentionReport(): ReportExport {
    return {
      title: t("con.report_certificate_retention"),
      companyName,
      language,
      meta: [],
      columns: [
        { header: t("common.code") },
        { header: t("con.contract") },
        { header: t("con.retained"), numeric: true },
        { header: t("con.released"), numeric: true },
        { header: t("con.outstanding"), numeric: true },
        { header: t("common.status") },
      ],
      sections: [
        {
          rows: retentionRows.map<CellValue[]>((r) => [
            r.code, r.contract, fmt(r.retained), fmt(r.released), fmt(r.outstanding), enumLabel(r.status, language),
          ]),
          totalRow: [t("con.total"), "", fmt(retRetained), fmt(retReleased), fmt(retOutstanding), ""],
        },
      ],
    };
  }

  // ---- Report 4: Advance Recovery (advances vs recovered) ----
  const advanceRows = advances.map((a) => {
    const amount = num(a.amount);
    const recovered = recoveredByAdvance.get(a.id) ?? 0;
    return {
      code: a.code,
      contract: contractLabel(a.contractId),
      amount,
      recovered,
      outstanding: amount - recovered,
      status: a.status,
    };
  });
  const advAmount = advanceRows.reduce((s, r) => s + r.amount, 0);
  const advRecovered = advanceRows.reduce((s, r) => s + r.recovered, 0);
  const advOutstanding = advAmount - advRecovered;

  function buildAdvanceRecoveryReport(): ReportExport {
    return {
      title: t("con.report_advance_recovery"),
      companyName,
      language,
      meta: [],
      columns: [
        { header: t("common.code") },
        { header: t("con.contract") },
        { header: t("con.amount"), numeric: true },
        { header: t("con.recovered"), numeric: true },
        { header: t("con.outstanding"), numeric: true },
        { header: t("common.status") },
      ],
      sections: [
        {
          rows: advanceRows.map<CellValue[]>((r) => [
            r.code, r.contract, fmt(r.amount), fmt(r.recovered), fmt(r.outstanding), enumLabel(r.status, language),
          ]),
          totalRow: [t("con.total"), "", fmt(advAmount), fmt(advRecovered), fmt(advOutstanding), ""],
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
        title={t("con.reports")}
        description={t("con.reports_subtitle")}
        bordered={false}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("con.report_contract_financials")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("con.contract")}</TableHead>
                <TableHead>{t("con.contractor")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-end">{t("con.total_contract_value")}</TableHead>
                <TableHead className="text-end">{t("con.certified")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contractRows.length === 0 ? (
                <TableState colSpan={5} isEmpty emptyTitle={t("con.no_data")} />
              ) : (
                contractRows.map((r) => (
                  <TableRow key={r.code}>
                    <TableCell className="font-medium">{r.code}</TableCell>
                    <TableCell>{r.contractor}</TableCell>
                    <TableCell><Badge variant="secondary">{enumLabel(r.status, language)}</Badge></TableCell>
                    <TableCell className="text-end">{fmt(r.value)}</TableCell>
                    <TableCell className="text-end">{fmt(r.certified)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {contractRows.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>{t("con.total")}</TableCell>
                  <TableCell className="text-end">{fmt(totalContractValue)}</TableCell>
                  <TableCell className="text-end">{fmt(totalCertified)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("con.report_certificates")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>{t("con.count")}</TableCell>
                  <TableCell className="text-end">{certs.length}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("con.gross")}</TableCell>
                  <TableCell className="text-end">{fmt(totalGross)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("con.net")}</TableCell>
                  <TableCell className="text-end">{fmt(totalNet)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("con.report_retention")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>{t("con.count")}</TableCell>
                  <TableCell className="text-end">{retentions.length}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("con.retained")}</TableCell>
                  <TableCell className="text-end">{fmt(totalRetained)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("con.released")}</TableCell>
                  <TableCell className="text-end">{fmt(totalReleased)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("con.report_advances")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>{t("con.count")}</TableCell>
                  <TableCell className="text-end">{advances.length}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("con.total")}</TableCell>
                  <TableCell className="text-end">{fmt(totalAdvance)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("con.recovered")}</TableCell>
                  <TableCell className="text-end">{fmt(totalRecovered)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Certificate Register */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">{t("con.report_certificate_register")}</CardTitle>
          <ExportMenu build={buildRegisterReport} file="certificate-register" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.code")}</TableHead>
                <TableHead>{t("con.contract")}</TableHead>
                <TableHead>{t("con.date")}</TableHead>
                <TableHead className="text-end">{t("con.gross")}</TableHead>
                <TableHead className="text-end">{t("con.net")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registerRows.length === 0 ? (
                <TableState colSpan={6} isEmpty emptyTitle={t("con.no_data")} />
              ) : (
                registerRows.map((r) => (
                  <TableRow key={r.code}>
                    <TableCell className="font-medium">{r.code}</TableCell>
                    <TableCell>{r.contract}</TableCell>
                    <TableCell>{r.date}</TableCell>
                    <TableCell className="text-end">{fmt(r.gross)}</TableCell>
                    <TableCell className="text-end">{fmt(r.net)}</TableCell>
                    <TableCell><Badge variant="secondary">{enumLabel(r.status, language)}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {registerRows.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>{t("con.total")}</TableCell>
                  <TableCell className="text-end">{fmt(registerGross)}</TableCell>
                  <TableCell className="text-end">{fmt(registerNet)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>

      {/* Outstanding Certificates */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">{t("con.report_outstanding_certificates")}</CardTitle>
          <ExportMenu build={buildOutstandingReport} file="outstanding-certificates" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.code")}</TableHead>
                <TableHead>{t("con.contract")}</TableHead>
                <TableHead>{t("con.date")}</TableHead>
                <TableHead className="text-end">{t("con.net")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outstandingRows.length === 0 ? (
                <TableState colSpan={5} isEmpty emptyTitle={t("con.no_data")} />
              ) : (
                outstandingRows.map((r) => (
                  <TableRow key={r.code}>
                    <TableCell className="font-medium">{r.code}</TableCell>
                    <TableCell>{r.contract}</TableCell>
                    <TableCell>{r.date}</TableCell>
                    <TableCell className="text-end">{fmt(r.net)}</TableCell>
                    <TableCell><Badge variant="secondary">{enumLabel(r.status, language)}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {outstandingRows.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>{t("con.total")}</TableCell>
                  <TableCell className="text-end">{fmt(outstandingNet)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>

      {/* Retention Report */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">{t("con.report_certificate_retention")}</CardTitle>
          <ExportMenu build={buildRetentionReport} file="retention-report" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.code")}</TableHead>
                <TableHead>{t("con.contract")}</TableHead>
                <TableHead className="text-end">{t("con.retained")}</TableHead>
                <TableHead className="text-end">{t("con.released")}</TableHead>
                <TableHead className="text-end">{t("con.outstanding")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {retentionRows.length === 0 ? (
                <TableState colSpan={6} isEmpty emptyTitle={t("con.no_data")} />
              ) : (
                retentionRows.map((r) => (
                  <TableRow key={r.code}>
                    <TableCell className="font-medium">{r.code}</TableCell>
                    <TableCell>{r.contract}</TableCell>
                    <TableCell className="text-end">{fmt(r.retained)}</TableCell>
                    <TableCell className="text-end">{fmt(r.released)}</TableCell>
                    <TableCell className="text-end">{fmt(r.outstanding)}</TableCell>
                    <TableCell><Badge variant="secondary">{enumLabel(r.status, language)}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {retentionRows.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2}>{t("con.total")}</TableCell>
                  <TableCell className="text-end">{fmt(retRetained)}</TableCell>
                  <TableCell className="text-end">{fmt(retReleased)}</TableCell>
                  <TableCell className="text-end">{fmt(retOutstanding)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>

      {/* Advance Recovery Report */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">{t("con.report_advance_recovery")}</CardTitle>
          <ExportMenu build={buildAdvanceRecoveryReport} file="advance-recovery" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.code")}</TableHead>
                <TableHead>{t("con.contract")}</TableHead>
                <TableHead className="text-end">{t("con.amount")}</TableHead>
                <TableHead className="text-end">{t("con.recovered")}</TableHead>
                <TableHead className="text-end">{t("con.outstanding")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {advanceRows.length === 0 ? (
                <TableState colSpan={6} isEmpty emptyTitle={t("con.no_data")} />
              ) : (
                advanceRows.map((r) => (
                  <TableRow key={r.code}>
                    <TableCell className="font-medium">{r.code}</TableCell>
                    <TableCell>{r.contract}</TableCell>
                    <TableCell className="text-end">{fmt(r.amount)}</TableCell>
                    <TableCell className="text-end">{fmt(r.recovered)}</TableCell>
                    <TableCell className="text-end">{fmt(r.outstanding)}</TableCell>
                    <TableCell><Badge variant="secondary">{enumLabel(r.status, language)}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {advanceRows.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2}>{t("con.total")}</TableCell>
                  <TableCell className="text-end">{fmt(advAmount)}</TableCell>
                  <TableCell className="text-end">{fmt(advRecovered)}</TableCell>
                  <TableCell className="text-end">{fmt(advOutstanding)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
