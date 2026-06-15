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
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/language-provider";
import { ReportExportButtons } from "@/components/report-export-buttons";
import type { ReportDoc, ReportSection } from "@/lib/report-export";

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
              <TableHead className="text-right">{language === "ar" ? "المبلغ" : "Amount"}</TableHead>
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
                  <TableCell className="text-right">{r.amount}</TableCell>
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

  const buildDoc = (): ReportDoc => {
    const meta = [{ label: t("export.generated"), value: new Date().toLocaleString() }];
    if (fromDate) meta.push({ label: t("export.from"), value: fromDate });
    if (toDate) meta.push({ label: t("export.to"), value: toDate });
    const section = (title: string, secRows: StatementRow[]): ReportSection => ({
      title,
      columns: [
        { header: t("common.code") },
        { header: language === "ar" ? "الحساب" : "Account" },
        { header: language === "ar" ? "المبلغ" : "Amount", align: "right", numeric: true },
      ],
      rows: secRows.map((r) => [r.code, (language === "ar" ? r.nameAr : r.name) ?? "", r.amount]),
    });
    return {
      title: t("nav.cash_flow"),
      companyName: (language === "ar" ? company?.nameAr ?? company?.name : company?.name) ?? "",
      meta,
      rtl: language === "ar",
      sections: data
        ? [
            section(t("acc.operating"), data.operating),
            section(t("acc.investing"), data.investing),
            section(t("acc.financing"), data.financing),
            {
              title: t("acc.net_change"),
              columns: [{ header: "" }, { header: "", align: "right", numeric: true }],
              rows: [
                [t("acc.opening_cash"), data.openingCash],
                [t("acc.net_change"), data.netChange],
                [t("acc.closing_cash"), data.closingCash],
              ],
            },
          ]
        : [],
    };
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <h2 className="text-2xl font-bold tracking-tight">{t("nav.cash_flow")}</h2>
        <ReportExportButtons
          disabled={!data}
          filename="cash-flow"
          buildDoc={buildDoc}
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
