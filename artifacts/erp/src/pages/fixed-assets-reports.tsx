import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import {
  useListCompanies,
  listFixedAssets,
  listAssetDepreciations,
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

export default function FixedAssetsReportsPage() {
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

  const { data: assets = [] } = useQuery({
    queryKey: ["report", "fixed-assets", companyId],
    queryFn: () => fetchAll((p) => listFixedAssets(p)),
    enabled,
  });
  const { data: depreciations = [] } = useQuery({
    queryKey: ["report", "asset-depreciations", companyId],
    queryFn: () => fetchAll((p) => listAssetDepreciations(p)),
    enabled,
  });

  const assetLabel = (id: string | null | undefined) => {
    const a = assets.find((x) => x.id === id);
    if (!a) return "-";
    return (language === "ar" ? a.nameAr : a.name) ?? a.name ?? "-";
  };

  const companyName = (language === "ar" ? company?.nameAr : company?.name) ?? company?.name ?? "";

  const assetRows = assets.map((a) => ({
    code: a.code,
    name: (language === "ar" ? a.nameAr : a.name) ?? a.name,
    status: a.status,
    cost: num(a.acquisitionCost),
    bookValue: num(a.bookValue),
  }));
  const totalCost = assetRows.reduce((s, r) => s + r.cost, 0);
  const totalBookValue = assetRows.reduce((s, r) => s + r.bookValue, 0);

  function buildAssetReport(): ReportExport {
    return {
      title: t("fa.report_asset_register"),
      companyName,
      language,
      meta: [],
      columns: [
        { header: t("common.code") },
        { header: t("common.name") },
        { header: t("common.status") },
        { header: t("fa.cost"), numeric: true },
        { header: t("fa.book_value"), numeric: true },
      ],
      sections: [
        {
          rows: assetRows.map<CellValue[]>((r) => [
            r.code, r.name, enumLabel(r.status, language), fmt(r.cost), fmt(r.bookValue),
          ]),
          totalRow: [t("lb.total"), "", "", fmt(totalCost), fmt(totalBookValue)],
        },
      ],
    };
  }

  const depRows = depreciations.map((d) => ({
    asset: assetLabel(d.assetId),
    period: d.periodDate ?? "-",
    amount: num(d.amount),
    status: d.status,
  }));
  const totalDep = depRows.reduce((s, r) => s + r.amount, 0);

  function buildDepreciationReport(): ReportExport {
    return {
      title: t("fa.report_depreciation_summary"),
      companyName,
      language,
      meta: [],
      columns: [
        { header: t("fa.asset") },
        { header: t("fa.period") },
        { header: t("fa.amount"), numeric: true },
        { header: t("common.status") },
      ],
      sections: [
        {
          rows: depRows.map<CellValue[]>((r) => [
            r.asset, r.period, fmt(r.amount), enumLabel(r.status, language),
          ]),
          totalRow: [t("lb.total"), "", fmt(totalDep), ""],
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
        title={t("fa.reports")}
        description={t("fa.reports_subtitle")}
        bordered={false}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">{t("fa.report_asset_register")}</CardTitle>
          <ExportMenu build={buildAssetReport} file="fixed-asset-register" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.code")}</TableHead>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-end">{t("fa.cost")}</TableHead>
                <TableHead className="text-end">{t("fa.book_value")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assetRows.length === 0 ? (
                <TableState colSpan={5} isEmpty emptyTitle={t("lb.no_data")} />
              ) : (
                assetRows.map((r) => (
                  <TableRow key={r.code}>
                    <TableCell className="font-medium">{r.code}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell><Badge variant="secondary">{enumLabel(r.status, language)}</Badge></TableCell>
                    <TableCell className="text-end">{fmt(r.cost)}</TableCell>
                    <TableCell className="text-end">{fmt(r.bookValue)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {assetRows.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>{t("lb.total")}</TableCell>
                  <TableCell className="text-end">{fmt(totalCost)}</TableCell>
                  <TableCell className="text-end">{fmt(totalBookValue)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">{t("fa.report_depreciation_summary")}</CardTitle>
          <ExportMenu build={buildDepreciationReport} file="asset-depreciation-summary" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("fa.asset")}</TableHead>
                <TableHead>{t("fa.period")}</TableHead>
                <TableHead className="text-end">{t("fa.amount")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {depRows.length === 0 ? (
                <TableState colSpan={4} isEmpty emptyTitle={t("lb.no_data")} />
              ) : (
                depRows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.asset}</TableCell>
                    <TableCell>{r.period}</TableCell>
                    <TableCell className="text-end">{fmt(r.amount)}</TableCell>
                    <TableCell><Badge variant="secondary">{enumLabel(r.status, language)}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {depRows.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2}>{t("lb.total")}</TableCell>
                  <TableCell className="text-end">{fmt(totalDep)}</TableCell>
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
