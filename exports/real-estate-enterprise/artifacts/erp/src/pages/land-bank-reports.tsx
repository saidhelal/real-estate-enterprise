import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import {
  useListCompanies,
  listLandParcels,
  listLandAcquisitions,
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

export default function LandBankReportsPage() {
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

  const { data: parcels = [] } = useQuery({
    queryKey: ["report", "land-parcels", companyId],
    queryFn: () => fetchAll((p) => listLandParcels(p)),
    enabled,
  });
  const { data: acquisitions = [] } = useQuery({
    queryKey: ["report", "land-acquisitions", companyId],
    queryFn: () => fetchAll((p) => listLandAcquisitions(p)),
    enabled,
  });

  const parcelLabel = (id: string | null | undefined) => {
    const p = parcels.find((x) => x.id === id);
    if (!p) return "-";
    return (language === "ar" ? p.nameAr : p.name) ?? p.name ?? "-";
  };

  const companyName = (language === "ar" ? company?.nameAr : company?.name) ?? company?.name ?? "";

  // ---- Report 1: Parcel Register ----
  const parcelRows = parcels.map((p) => ({
    code: p.code,
    name: (language === "ar" ? p.nameAr : p.name) ?? p.name,
    status: p.status,
    area: num(p.area),
    marketValue: num(p.marketValue),
  }));
  const totalArea = parcelRows.reduce((s, r) => s + r.area, 0);
  const totalMarketValue = parcelRows.reduce((s, r) => s + r.marketValue, 0);

  function buildParcelReport(): ReportExport {
    return {
      title: t("lb.report_parcel_register"),
      companyName,
      language,
      meta: [],
      columns: [
        { header: t("common.code") },
        { header: t("common.name") },
        { header: t("common.status") },
        { header: t("lb.area"), numeric: true },
        { header: t("lb.market_value"), numeric: true },
      ],
      sections: [
        {
          rows: parcelRows.map<CellValue[]>((r) => [
            r.code, r.name, enumLabel(r.status, language), fmt(r.area), fmt(r.marketValue),
          ]),
          totalRow: [t("lb.total"), "", "", fmt(totalArea), fmt(totalMarketValue)],
        },
      ],
    };
  }

  // ---- Report 2: Acquisition Cost Summary ----
  const acqRows = acquisitions.map((a) => ({
    parcel: parcelLabel(a.parcelId),
    type: a.acquisitionType,
    date: a.acquisitionDate ?? "-",
    cost: num(a.cost),
    paymentStatus: a.paymentStatus,
  }));
  const totalCost = acqRows.reduce((s, r) => s + r.cost, 0);

  function buildAcquisitionReport(): ReportExport {
    return {
      title: t("lb.report_acquisition_summary"),
      companyName,
      language,
      meta: [],
      columns: [
        { header: t("lb.parcel") },
        { header: t("lb.type") },
        { header: t("lb.date") },
        { header: t("lb.cost"), numeric: true },
        { header: t("lb.payment_status") },
      ],
      sections: [
        {
          rows: acqRows.map<CellValue[]>((r) => [
            r.parcel, enumLabel(r.type, language), r.date, fmt(r.cost), enumLabel(r.paymentStatus, language),
          ]),
          totalRow: [t("lb.total"), "", "", fmt(totalCost), ""],
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
        <h2 className="text-2xl font-bold tracking-tight">{t("lb.reports")}</h2>
        <p className="text-muted-foreground">{t("lb.reports_subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">{t("lb.report_parcel_register")}</CardTitle>
          <ExportMenu build={buildParcelReport} file="land-parcel-register" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.code")}</TableHead>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-right">{t("lb.area")}</TableHead>
                <TableHead className="text-right">{t("lb.market_value")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parcelRows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24">{t("lb.no_data")}</TableCell></TableRow>
              ) : (
                parcelRows.map((r) => (
                  <TableRow key={r.code}>
                    <TableCell className="font-medium">{r.code}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell><Badge variant="secondary">{enumLabel(r.status, language)}</Badge></TableCell>
                    <TableCell className="text-right">{fmt(r.area)}</TableCell>
                    <TableCell className="text-right">{fmt(r.marketValue)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {parcelRows.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>{t("lb.total")}</TableCell>
                  <TableCell className="text-right">{fmt(totalArea)}</TableCell>
                  <TableCell className="text-right">{fmt(totalMarketValue)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">{t("lb.report_acquisition_summary")}</CardTitle>
          <ExportMenu build={buildAcquisitionReport} file="land-acquisition-summary" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("lb.parcel")}</TableHead>
                <TableHead>{t("lb.type")}</TableHead>
                <TableHead>{t("lb.date")}</TableHead>
                <TableHead className="text-right">{t("lb.cost")}</TableHead>
                <TableHead>{t("lb.payment_status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {acqRows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24">{t("lb.no_data")}</TableCell></TableRow>
              ) : (
                acqRows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.parcel}</TableCell>
                    <TableCell><Badge variant="secondary">{enumLabel(r.type, language)}</Badge></TableCell>
                    <TableCell>{r.date}</TableCell>
                    <TableCell className="text-right">{fmt(r.cost)}</TableCell>
                    <TableCell><Badge variant="secondary">{enumLabel(r.paymentStatus, language)}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {acqRows.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>{t("lb.total")}</TableCell>
                  <TableCell className="text-right">{fmt(totalCost)}</TableCell>
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
