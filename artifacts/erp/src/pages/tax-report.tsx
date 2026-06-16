import { useState } from "react";
import {
  useGetTaxReport,
  getGetTaxReportQueryKey,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel } from "@/lib/enums";
import { ReportExportButton } from "@/components/report-export-button";
import type { ReportExport } from "@/lib/report-export";

export default function TaxReportPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const company = companies?.[0];
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const params = { companyId, fromDate: fromDate || undefined, toDate: toDate || undefined };
  const { data, isLoading } = useGetTaxReport(params, {
    query: { enabled: !!companyId, queryKey: getGetTaxReportQueryKey(params) },
  });
  const rows = data?.rows ?? [];

  const companyName = (language === "ar" ? company?.nameAr : company?.name) ?? company?.name ?? "";
  const periodValue = fromDate || toDate ? `${fromDate || "…"} — ${toDate || "…"}` : t("acc.all_dates");

  const buildReport = (): ReportExport | null => {
    if (!data) return null;
    return {
      title: t("nav.tax_report"),
      companyName,
      language,
      meta: [{ label: t("acc.period"), value: periodValue }],
      columns: [
        { header: t("common.code") },
        { header: t("tax.name") },
        { header: t("tax.type") },
        { header: t("tax.rate"), numeric: true },
        { header: t("tax.base"), numeric: true },
        { header: t("tax.tax"), numeric: true },
      ],
      sections: [
        {
          rows: rows.map((r) => [r.code, r.name, enumLabel(r.taxType, language), r.rate, r.base, r.tax]),
        },
      ],
    };
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <h2 className="text-2xl font-bold tracking-tight">{t("nav.tax_report")}</h2>
        <ReportExportButton
          build={buildReport}
          baseFilename="tax-report"
          disabled={!data}
          audit={{ reportType: "tax", companyId, fromDate: fromDate || undefined, toDate: toDate || undefined }}
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="space-y-2">
          <Label>{t("acc.from_date")}</Label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t("acc.to_date")}</Label>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("tax.output_tax")}</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold">{data.outputTax}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("tax.input_tax")}</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold">{data.inputTax}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("tax.net_tax")}</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold">{data.netTax}</CardContent>
          </Card>
        </div>
      )}

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.code")}</TableHead>
              <TableHead>{t("tax.name")}</TableHead>
              <TableHead>{t("tax.type")}</TableHead>
              <TableHead className="text-right">{t("tax.rate")}</TableHead>
              <TableHead className="text-right">{t("tax.base")}</TableHead>
              <TableHead className="text-right">{t("tax.tax")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center h-24">{t("common.loading")}</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center h-24">{t("acc.no_data")}</TableCell></TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.taxCodeId}>
                  <TableCell className="font-medium">{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{enumLabel(r.taxType, language)}</TableCell>
                  <TableCell className="text-right">{r.rate}%</TableCell>
                  <TableCell className="text-right">{r.base}</TableCell>
                  <TableCell className="text-right">{r.tax}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
