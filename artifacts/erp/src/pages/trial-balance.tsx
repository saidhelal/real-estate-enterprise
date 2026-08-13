import { useState } from "react";
import {
  useGetTrialBalance,
  getGetTrialBalanceQueryKey,
  useListCompanies,
} from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableFrame,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel } from "@/lib/enums";
import { ReportExportButton } from "@/components/report-export-button";
import type { ReportExport } from "@/lib/report-export";

export default function TrialBalancePage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const company = companies?.[0];
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const params = { companyId, fromDate: fromDate || undefined, toDate: toDate || undefined };
  const { data, isLoading } = useGetTrialBalance(params, {
    query: { enabled: !!companyId, queryKey: getGetTrialBalanceQueryKey(params) },
  });
  const rows = data?.rows ?? [];
  const balanced = data ? data.totalDebit === data.totalCredit : false;

  const companyName = (language === "ar" ? company?.nameAr : company?.name) ?? company?.name ?? "";
  const periodValue =
    fromDate || toDate ? `${fromDate || "…"} — ${toDate || "…"}` : t("acc.all_dates");

  const buildReport = (): ReportExport | null => {
    if (!data) return null;
    return {
      title: t("nav.trial_balance"),
      companyName,
      language,
      meta: [{ label: t("acc.period"), value: periodValue }],
      columns: [
        { header: t("common.code") },
        { header: t("common.name") },
        { header: t("acc.type") },
        { header: t("acc.debit"), numeric: true },
        { header: t("acc.credit"), numeric: true },
      ],
      sections: [
        {
          rows: rows.map((r) => [
            r.code,
            language === "ar" ? r.nameAr : r.name,
            enumLabel(r.type, language),
            r.debit,
            r.credit,
          ]),
          totalRow: [t("common.total"), "", "", data.totalDebit, data.totalCredit],
        },
      ],
    };
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <PageHeader title={t("nav.trial_balance")} bordered={false} />
        <div className="flex items-center gap-3">
          {data && (
            <Badge variant={balanced ? "default" : "destructive"}>
              {balanced ? t("acc.balanced") : t("acc.not_balanced")}
            </Badge>
          )}
          <ReportExportButton
            build={buildReport}
            baseFilename="trial-balance"
            disabled={!data}
            audit={{ reportType: "trial-balance", companyId, fromDate: fromDate || undefined, toDate: toDate || undefined }}
          />
        </div>
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

      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.code")}</TableHead>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("acc.type")}</TableHead>
              <TableHead className="text-end">{t("acc.debit")}</TableHead>
              <TableHead className="text-end">{t("acc.credit")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableState colSpan={5} isLoading loadingLabel={t("common.loading")} emptyTitle={t("common.no_results")} />
            ) : rows.length === 0 ? (
              <TableState colSpan={5} isEmpty emptyTitle={t("acc.no_data")} />
            ) : (
              rows.map((r) => (
                <TableRow key={r.accountId}>
                  <TableCell className="font-medium">{r.code}</TableCell>
                  <TableCell>{language === "ar" ? r.nameAr : r.name}</TableCell>
                  <TableCell>{enumLabel(r.type, language)}</TableCell>
                  <TableCell className="text-end">{r.debit}</TableCell>
                  <TableCell className="text-end">{r.credit}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {data && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-semibold">{t("common.total")}</TableCell>
                <TableCell className="text-end font-semibold">{data.totalDebit}</TableCell>
                <TableCell className="text-end font-semibold">{data.totalCredit}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </TableFrame>
    </div>
  );
}
