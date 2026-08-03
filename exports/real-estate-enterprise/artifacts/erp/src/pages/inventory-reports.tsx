import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import {
  useListCompanies,
  listGoodsReceipts,
  listGoodsIssues,
  listStockAdjustments,
  listStockOpeningBalances,
} from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/language-provider";
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

export default function InventoryReportsPage() {
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

  const { data: receipts = [] } = useQuery({
    queryKey: ["inv-report", "receipts", companyId],
    queryFn: () => fetchAll((p) => listGoodsReceipts(p)),
    enabled,
  });
  const { data: issues = [] } = useQuery({
    queryKey: ["inv-report", "issues", companyId],
    queryFn: () => fetchAll((p) => listGoodsIssues(p)),
    enabled,
  });
  const { data: adjustments = [] } = useQuery({
    queryKey: ["inv-report", "adjustments", companyId],
    queryFn: () => fetchAll((p) => listStockAdjustments(p)),
    enabled,
  });
  const { data: openings = [] } = useQuery({
    queryKey: ["inv-report", "openings", companyId],
    queryFn: () => fetchAll((p) => listStockOpeningBalances(p)),
    enabled,
  });

  const totalReceived = receipts.reduce((acc, r) => acc + num(r.totalValue), 0);
  const totalIssued = issues.reduce((acc, r) => acc + num(r.totalValue), 0);
  const totalAdjusted = adjustments.reduce((acc, r) => acc + num(r.totalValue), 0);
  const totalOpening = openings.reduce((acc, r) => acc + num(r.totalValue), 0);

  const rows: { labelKey: string; count: number; total: number }[] = [
    { labelKey: "inv.report_opening", count: openings.length, total: totalOpening },
    { labelKey: "inv.report_receipts", count: receipts.length, total: totalReceived },
    { labelKey: "inv.report_issues", count: issues.length, total: totalIssued },
    { labelKey: "inv.report_adjustments", count: adjustments.length, total: totalAdjusted },
  ];

  function buildReport(): ReportExport {
    const companyName = (language === "ar" ? company?.nameAr : company?.name) ?? company?.name ?? "";
    const bodyRows: CellValue[][] = rows.map((r) => [t(r.labelKey), r.count, fmt(r.total)]);
    return {
      title: t("inv.reports"),
      companyName,
      language,
      meta: [],
      columns: [
        { header: t("inv.reports") },
        { header: t("inv.count"), numeric: true },
        { header: t("inv.total"), numeric: true },
      ],
      sections: [{ rows: bodyRows }],
    };
  }

  const handleExcel = () => exportReportToExcel(buildReport(), "inventory-report", t("acc.generated"));
  const handlePdf = () => exportReportToPdf(buildReport(), t("acc.generated"));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("inv.reports")}</h2>
          <p className="text-muted-foreground">{t("inv.reports_subtitle")}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={!enabled}>
              <Download className="h-4 w-4" />
              {t("common.export")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExcel}>
              <FileSpreadsheet className="h-4 w-4" />
              {t("common.export_excel")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handlePdf}>
              <FileText className="h-4 w-4" />
              {t("common.export_pdf")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("inv.reports")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("inv.reports")}</TableHead>
                <TableHead className="text-right">{t("inv.count")}</TableHead>
                <TableHead className="text-right">{t("inv.total")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.labelKey}>
                  <TableCell className="font-medium">{t(r.labelKey)}</TableCell>
                  <TableCell className="text-right">{r.count}</TableCell>
                  <TableCell className="text-right">{fmt(r.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
