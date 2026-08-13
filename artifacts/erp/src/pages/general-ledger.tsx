import { useState } from "react";
import {
  useGetGeneralLedger,
  getGetGeneralLedgerQueryKey,
  useListAccounts,
  useListCompanies,
} from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableFrame,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/lib/language-provider";
import { ReportExportButton } from "@/components/report-export-button";
import type { ReportExport } from "@/lib/report-export";

export default function GeneralLedgerPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const company = companies?.[0];
  const { data: accounts } = useListAccounts({ pageSize: 500 });
  const accountList = accounts?.data ?? [];

  const [accountId, setAccountId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const params = {
    companyId,
    accountId: accountId || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    pageSize: 200,
  };
  const { data, isLoading } = useGetGeneralLedger(params, {
    query: { enabled: !!companyId && !!accountId, queryKey: getGetGeneralLedgerQueryKey(params) },
  });
  const rows = data?.data ?? [];
  const companyName = (language === "ar" ? company?.nameAr : company?.name) ?? company?.name ?? "";
  const selectedAccount = accountList.find((a) => a.id === accountId);
  const accountLabel = selectedAccount
    ? `${selectedAccount.code} - ${language === "ar" ? selectedAccount.nameAr : selectedAccount.name}`
    : "";
  const periodValue =
    fromDate || toDate ? `${fromDate || "…"} — ${toDate || "…"}` : t("acc.all_dates");

  const buildReport = (): ReportExport | null => {
    if (!data || rows.length === 0) return null;
    return {
      title: t("nav.general_ledger"),
      companyName,
      language,
      meta: [
        { label: t("acc.account"), value: accountLabel },
        { label: t("acc.period"), value: periodValue },
        { label: t("acc.opening_balance"), value: data.openingBalance },
        { label: t("acc.closing_balance"), value: data.closingBalance },
      ],
      columns: [
        { header: t("common.code") },
        { header: t("acc.entry_date") },
        { header: t("acc.description") },
        { header: t("acc.debit"), numeric: true },
        { header: t("acc.credit"), numeric: true },
        { header: t("acc.balance"), numeric: true },
      ],
      sections: [
        {
          rows: rows.map((r) => [
            r.entryNumber,
            r.entryDate,
            r.description ?? "",
            r.debit,
            r.credit,
            r.balance,
          ]),
          totalRow: [t("acc.closing_balance"), "", "", data.totalDebit, data.totalCredit, data.closingBalance],
        },
      ],
    };
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <PageHeader title={t("nav.general_ledger")} bordered={false} />
        <ReportExportButton
          build={buildReport}
          baseFilename="general-ledger"
          disabled={!data || rows.length === 0}
          audit={{ reportType: "general-ledger", companyId, accountId: accountId || undefined, fromDate: fromDate || undefined, toDate: toDate || undefined }}
        />
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-2 min-w-64">
          <Label>{t("acc.account")}</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger>
              <SelectValue placeholder={t("acc.select_account")} />
            </SelectTrigger>
            <SelectContent>
              {accountList.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.code} - {language === "ar" ? a.nameAr : a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("acc.from_date")}</Label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t("acc.to_date")}</Label>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
      </div>

      {!accountId ? (
        <p className="text-muted-foreground">{t("acc.select_account_prompt")}</p>
      ) : (
        <>
          {data && (
            <div className="flex flex-wrap gap-6 text-sm">
              <span>{t("acc.opening_balance")}: <strong>{data.openingBalance}</strong></span>
              <span>{t("acc.closing_balance")}: <strong>{data.closingBalance}</strong></span>
            </div>
          )}
          <TableFrame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.code")}</TableHead>
                  <TableHead>{t("acc.entry_date")}</TableHead>
                  <TableHead>{t("acc.description")}</TableHead>
                  <TableHead className="text-end">{t("acc.debit")}</TableHead>
                  <TableHead className="text-end">{t("acc.credit")}</TableHead>
                  <TableHead className="text-end">{t("acc.balance")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableState colSpan={6} isLoading loadingLabel={t("common.loading")} emptyTitle={t("common.no_results")} />
                ) : rows.length === 0 ? (
                  <TableState colSpan={6} isEmpty emptyTitle={t("acc.no_data")} />
                ) : (
                  rows.map((r, i) => (
                    <TableRow key={`${r.entryId}-${i}`}>
                      <TableCell className="font-medium">{r.entryNumber}</TableCell>
                      <TableCell>{r.entryDate}</TableCell>
                      <TableCell>{r.description}</TableCell>
                      <TableCell className="text-end">{r.debit}</TableCell>
                      <TableCell className="text-end">{r.credit}</TableCell>
                      <TableCell className="text-end">{r.balance}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableFrame>
        </>
      )}
    </div>
  );
}
