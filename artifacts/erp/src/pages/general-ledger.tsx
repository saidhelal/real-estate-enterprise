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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export default function GeneralLedgerPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
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
  };
  const { data, isLoading } = useGetGeneralLedger(params, {
    query: { enabled: !!companyId && !!accountId, queryKey: getGetGeneralLedgerQueryKey(params) },
  });
  const rows = data?.data ?? [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-bold tracking-tight">{t("nav.general_ledger")}</h2>

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
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.code")}</TableHead>
                  <TableHead>{t("acc.entry_date")}</TableHead>
                  <TableHead>{t("acc.description")}</TableHead>
                  <TableHead className="text-right">{t("acc.debit")}</TableHead>
                  <TableHead className="text-right">{t("acc.credit")}</TableHead>
                  <TableHead className="text-right">{t("acc.balance")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center h-24">{t("common.loading")}</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center h-24">{t("acc.no_data")}</TableCell></TableRow>
                ) : (
                  rows.map((r, i) => (
                    <TableRow key={`${r.entryId}-${i}`}>
                      <TableCell className="font-medium">{r.entryNumber}</TableCell>
                      <TableCell>{r.entryDate}</TableCell>
                      <TableCell>{r.description}</TableCell>
                      <TableCell className="text-right">{r.debit}</TableCell>
                      <TableCell className="text-right">{r.credit}</TableCell>
                      <TableCell className="text-right">{r.balance}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
