import { useState } from "react";
import {
  useGetIncomeStatement,
  getGetIncomeStatementQueryKey,
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
import { ReportExportButton } from "@/components/report-export-button";
import type { ReportExport } from "@/lib/report-export";

interface StatementRow {
  accountId: string;
  code: string;
  name: string;
  nameAr: string;
  amount: string;
}

function Section({ title, rows, total, language }: { title: string; rows: StatementRow[]; total: string; language: string }) {
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
            {rows.map((r) => (
              <TableRow key={r.accountId}>
                <TableCell className="font-medium">{r.code}</TableCell>
                <TableCell>{language === "ar" ? r.nameAr : r.name}</TableCell>
                <TableCell className="text-right">{r.amount}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={2} className="font-semibold">{language === "ar" ? "الإجمالي" : "Total"}</TableCell>
              <TableCell className="text-right font-semibold">{total}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function IncomeStatementPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const company = companies?.[0];
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const params = { companyId, fromDate: fromDate || undefined, toDate: toDate || undefined };
  const { data, isLoading } = useGetIncomeStatement(params, {
    query: { enabled: !!companyId, queryKey: getGetIncomeStatementQueryKey(params) },
  });

  const companyName = (language === "ar" ? company?.nameAr : company?.name) ?? company?.name ?? "";
  const periodValue =
    fromDate || toDate ? `${fromDate || "…"} — ${toDate || "…"}` : t("acc.all_dates");

  const buildReport = (): ReportExport | null => {
    if (!data) return null;
    const mapRows = (rows: StatementRow[]) =>
      rows.map((r) => [r.code, language === "ar" ? r.nameAr : r.name, r.amount]);
    return {
      title: t("nav.income_statement"),
      companyName,
      language,
      meta: [{ label: t("acc.period"), value: periodValue }],
      columns: [
        { header: t("common.code") },
        { header: t("acc.account") },
        { header: t("acc.amount"), numeric: true },
      ],
      sections: [
        { title: t("acc.revenue"), rows: mapRows(data.revenue), totalRow: [t("acc.total_revenue"), "", data.totalRevenue] },
        { title: t("acc.expenses"), rows: mapRows(data.expenses), totalRow: [t("acc.total_expenses"), "", data.totalExpenses] },
      ],
      summary: [{ label: t("acc.net_income"), value: data.netIncome }],
    };
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <h2 className="text-2xl font-bold tracking-tight">{t("nav.income_statement")}</h2>
        <ReportExportButton
          build={buildReport}
          baseFilename="income-statement"
          disabled={!data}
          audit={{ reportType: "income-statement", companyId, fromDate: fromDate || undefined, toDate: toDate || undefined }}
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
          <Section title={t("acc.revenue")} rows={data.revenue} total={data.totalRevenue} language={language} />
          <Section title={t("acc.expenses")} rows={data.expenses} total={data.totalExpenses} language={language} />
          <Card>
            <CardContent className="flex items-center justify-between py-4">
              <span className="text-lg font-semibold">{t("acc.net_income")}</span>
              <span className="text-lg font-bold">{data.netIncome}</span>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
