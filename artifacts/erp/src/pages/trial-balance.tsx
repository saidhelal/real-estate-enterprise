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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel } from "@/lib/enums";

export default function TrialBalancePage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const params = { companyId, fromDate: fromDate || undefined, toDate: toDate || undefined };
  const { data, isLoading } = useGetTrialBalance(params, {
    query: { enabled: !!companyId, queryKey: getGetTrialBalanceQueryKey(params) },
  });
  const rows = data?.rows ?? [];
  const balanced = data ? data.totalDebit === data.totalCredit : false;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <h2 className="text-2xl font-bold tracking-tight">{t("nav.trial_balance")}</h2>
        {data && (
          <Badge variant={balanced ? "default" : "destructive"}>
            {balanced ? t("acc.balanced") : t("acc.not_balanced")}
          </Badge>
        )}
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

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.code")}</TableHead>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("acc.type")}</TableHead>
              <TableHead className="text-right">{t("acc.debit")}</TableHead>
              <TableHead className="text-right">{t("acc.credit")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center h-24">{t("common.loading")}</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center h-24">{t("acc.no_data")}</TableCell></TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.accountId}>
                  <TableCell className="font-medium">{r.code}</TableCell>
                  <TableCell>{language === "ar" ? r.nameAr : r.name}</TableCell>
                  <TableCell>{enumLabel(r.type, language)}</TableCell>
                  <TableCell className="text-right">{r.debit}</TableCell>
                  <TableCell className="text-right">{r.credit}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {data && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-semibold">{t("common.total")}</TableCell>
                <TableCell className="text-right font-semibold">{data.totalDebit}</TableCell>
                <TableCell className="text-right font-semibold">{data.totalCredit}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
}
