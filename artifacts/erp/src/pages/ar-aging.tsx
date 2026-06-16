import { useState } from "react";
import {
  useGetArAging,
  getGetArAgingQueryKey,
  useListCompanies,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/language-provider";
import { ReportExportButton } from "@/components/report-export-button";
import type { ReportExport } from "@/lib/report-export";

export default function ArAgingPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const company = companies?.[0];
  const [asOfDate, setAsOfDate] = useState("");

  const params = { companyId, asOfDate: asOfDate || undefined };
  const { data, isLoading } = useGetArAging(params, {
    query: { enabled: !!companyId, queryKey: getGetArAgingQueryKey(params) },
  });
  const rows = data?.rows ?? [];
  const totals = data?.totals;

  const companyName = (language === "ar" ? company?.nameAr : company?.name) ?? company?.name ?? "";

  const buildReport = (): ReportExport | null => {
    if (!data) return null;
    return {
      title: t("nav.ar_aging"),
      companyName,
      language,
      meta: [{ label: t("acc.as_of_date"), value: asOfDate || t("acc.all_dates") }],
      columns: [
        { header: t("aging.party") },
        { header: t("aging.current"), numeric: true },
        { header: t("aging.days30"), numeric: true },
        { header: t("aging.days60"), numeric: true },
        { header: t("aging.days90"), numeric: true },
        { header: t("aging.days120"), numeric: true },
        { header: t("common.total"), numeric: true },
      ],
      sections: [
        {
          rows: rows.map((r) => [
            r.partyName,
            r.current,
            r.days30,
            r.days60,
            r.days90,
            r.days120plus,
            r.total,
          ]),
          totalRow: totals
            ? [t("common.total"), totals.current, totals.days30, totals.days60, totals.days90, totals.days120plus, totals.total]
            : undefined,
        },
      ],
    };
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <h2 className="text-2xl font-bold tracking-tight">{t("nav.ar_aging")}</h2>
        <ReportExportButton
          build={buildReport}
          baseFilename="ar-aging"
          disabled={!data}
          audit={{ reportType: "ar-aging", companyId, asOfDate: asOfDate || undefined }}
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="space-y-2">
          <Label>{t("acc.as_of_date")}</Label>
          <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("aging.party")}</TableHead>
              <TableHead className="text-right">{t("aging.current")}</TableHead>
              <TableHead className="text-right">{t("aging.days30")}</TableHead>
              <TableHead className="text-right">{t("aging.days60")}</TableHead>
              <TableHead className="text-right">{t("aging.days90")}</TableHead>
              <TableHead className="text-right">{t("aging.days120")}</TableHead>
              <TableHead className="text-right">{t("common.total")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center h-24">{t("common.loading")}</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center h-24">{t("acc.no_data")}</TableCell></TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.partyId}>
                  <TableCell className="font-medium">{r.partyName}</TableCell>
                  <TableCell className="text-right">{r.current}</TableCell>
                  <TableCell className="text-right">{r.days30}</TableCell>
                  <TableCell className="text-right">{r.days60}</TableCell>
                  <TableCell className="text-right">{r.days90}</TableCell>
                  <TableCell className="text-right">{r.days120plus}</TableCell>
                  <TableCell className="text-right">{r.total}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {totals && (
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">{t("common.total")}</TableCell>
                <TableCell className="text-right font-semibold">{totals.current}</TableCell>
                <TableCell className="text-right font-semibold">{totals.days30}</TableCell>
                <TableCell className="text-right font-semibold">{totals.days60}</TableCell>
                <TableCell className="text-right font-semibold">{totals.days90}</TableCell>
                <TableCell className="text-right font-semibold">{totals.days120plus}</TableCell>
                <TableCell className="text-right font-semibold">{totals.total}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
}
