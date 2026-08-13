import { useState } from "react";
import {
  useGetCashFlow,
  getGetCashFlowQueryKey,
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
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/language-provider";
import { ReportExportButton } from "@/components/report-export-button";
import type { ReportExport } from "@/lib/report-export";

interface StatementRow {
  accountId: string;
  code: string;
  name: string;
  nameAr: string;
  amount: string;
}

function Section({ title, rows, language }: { title: string; rows: StatementRow[]; language: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">{"#"}</TableHead>
              <TableHead>{language === "ar" ? "الحساب" : "Account"}</TableHead>
              <TableHead className="text-end">{language === "ar" ? "المبلغ" : "Amount"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">—</TableCell></TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.accountId}>
                  <TableCell className="font-medium">{r.code}</TableCell>
                  <TableCell>{language === "ar" ? r.nameAr : r.name}</TableCell>
                  <TableCell className="text-end">{r.amount}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function CashFlowPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const company = companies?.[0];
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const params = { companyId, fromDate: fromDate || undefined, toDate: toDate || undefined };
  const { data, isLoading } = useGetCashFlow(params, {
    query: { enabled: !!companyId, queryKey: getGetCashFlowQueryKey(params) },
  });

  const companyName = (language === "ar" ? company?.nameAr : company?.name) ?? company?.name ?? "";
  const periodValue =
    fromDate || toDate ? `${fromDate || "…"} — ${toDate || "…"}` : t("acc.all_dates");

  const buildReport = (): ReportExport | null => {
    if (!data) return null;
    const mapRows = (rows: StatementRow[]) =>
      rows.map((r) => [r.code, language === "ar" ? r.nameAr : r.name, r.amount]);
    return {
      title: t("nav.cash_flow"),
      companyName,
      language,
      meta: [{ label: t("acc.period"), value: periodValue }],
      columns: [
        { header: t("common.code") },
        { header: t("acc.account") },
        { header: t("acc.amount"), numeric: true },
      ],
      sections: [
        { title: t("acc.operating"), rows: mapRows(data.operating) },
        { title: t("acc.investing"), rows: mapRows(data.investing) },
        { title: t("acc.financing"), rows: mapRows(data.financing) },
      ],
      summary: [
        { label: t("acc.opening_cash"), value: data.openingCash },
        { label: t("acc.net_change"), value: data.netChange },
        { label: t("acc.closing_cash"), value: data.closingCash },
      ],
    };
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <PageHeader title={t("nav.cash_flow")} bordered={false} />
        <ReportExportButton
          build={buildReport}
          baseFilename="cash-flow"
          disabled={!data}
          audit={{ reportType: "cash-flow", companyId, fromDate: fromDate || undefined, toDate: toDate || undefined }}
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

      {isLoading ? (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      ) : !data ? (
        <p className="text-muted-foreground">{t("acc.no_data")}</p>
      ) : (
        <div className="space-y-6">
          <Section title={t("acc.operating")} rows={data.operating} language={language} />
          <Section title={t("acc.investing")} rows={data.investing} language={language} />
          <Section title={t("acc.financing")} rows={data.financing} language={language} />
          <Card>
            <CardContent className="space-y-2 py-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("acc.opening_cash")}</span>
                <span>{data.openingCash}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("acc.net_change")}</span>
                <span>{data.netChange}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="font-semibold">{t("acc.closing_cash")}</span>
                <span className="font-bold">{data.closingCash}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
