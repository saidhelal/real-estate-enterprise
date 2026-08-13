import { useState } from "react";
import {
  useGetBalanceSheet,
  getGetBalanceSheetQueryKey,
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/language-provider";
import { ReportExportButton } from "@/components/report-export-button";
import type { ReportExport } from "@/lib/report-export";

interface SectionRow {
  accountId: string;
  code: string;
  name: string;
  nameAr: string;
  amount: string;
}

function Section({ title, rows, total, language }: { title: string; rows: SectionRow[]; total: string; language: string }) {
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
            {rows.map((r) => (
              <TableRow key={r.accountId}>
                <TableCell className="font-medium">{r.code}</TableCell>
                <TableCell>{language === "ar" ? r.nameAr : r.name}</TableCell>
                <TableCell className="text-end">{r.amount}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={2} className="font-semibold">{language === "ar" ? "الإجمالي" : "Total"}</TableCell>
              <TableCell className="text-end font-semibold">{total}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function BalanceSheetPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const company = companies?.[0];
  const [asOfDate, setAsOfDate] = useState("");

  const params = { companyId, asOfDate: asOfDate || undefined };
  const { data, isLoading } = useGetBalanceSheet(params, {
    query: { enabled: !!companyId, queryKey: getGetBalanceSheetQueryKey(params) },
  });

  const companyName = (language === "ar" ? company?.nameAr : company?.name) ?? company?.name ?? "";

  const buildReport = (): ReportExport | null => {
    if (!data) return null;
    const mapRows = (rows: SectionRow[]) =>
      rows.map((r) => [r.code, language === "ar" ? r.nameAr : r.name, r.amount]);
    return {
      title: t("nav.balance_sheet"),
      companyName,
      language,
      meta: [{ label: t("acc.as_of_date"), value: asOfDate || new Date().toISOString().slice(0, 10) }],
      columns: [
        { header: t("common.code") },
        { header: t("acc.account") },
        { header: t("acc.amount"), numeric: true },
      ],
      sections: [
        { title: t("acc.assets"), rows: mapRows(data.assets), totalRow: [t("acc.total_assets"), "", data.totalAssets] },
        { title: t("acc.liabilities"), rows: mapRows(data.liabilities), totalRow: [t("acc.total_liabilities"), "", data.totalLiabilities] },
        { title: t("acc.equity"), rows: mapRows(data.equity), totalRow: [t("acc.total_equity"), "", data.totalEquity] },
      ],
    };
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <PageHeader title={t("nav.balance_sheet")} bordered={false} />
        <div className="flex items-center gap-3">
          {data && (
            <Badge variant={data.balanced ? "default" : "destructive"}>
              {data.balanced ? t("acc.balanced") : t("acc.not_balanced")}
            </Badge>
          )}
          <ReportExportButton
            build={buildReport}
            baseFilename="balance-sheet"
            disabled={!data}
            audit={{ reportType: "balance-sheet", companyId, asOfDate: asOfDate || undefined }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="space-y-2">
          <Label>{t("acc.as_of_date")}</Label>
          <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      ) : !data ? (
        <p className="text-muted-foreground">{t("acc.no_data")}</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section title={t("acc.assets")} rows={data.assets} total={data.totalAssets} language={language} />
          <div className="space-y-6">
            <Section title={t("acc.liabilities")} rows={data.liabilities} total={data.totalLiabilities} language={language} />
            <Section title={t("acc.equity")} rows={data.equity} total={data.totalEquity} language={language} />
          </div>
        </div>
      )}
    </div>
  );
}
