import {
  useListChequeStatusHistorys,
  getListChequeStatusHistorysQueryKey,
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
import { Badge } from "@/components/ui/badge";
import { enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function ChequeStatusHistorysPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const historyParams = { companyId, pageSize: 200 };
  const { data, isLoading } = useListChequeStatusHistorys(historyParams, {
    query: { enabled: !!companyId, queryKey: getListChequeStatusHistorysQueryKey(historyParams) },
  });
  const rows = data?.data ?? [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("nav.cheque_status_history")}</h2>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.code")}</TableHead>
              <TableHead>{t("acc.action")}</TableHead>
              <TableHead>{t("acc.from_status")}</TableHead>
              <TableHead>{t("acc.to_status")}</TableHead>
              <TableHead>{t("acc.actor")}</TableHead>
              <TableHead>{t("acc.action_date")}</TableHead>
              <TableHead>{t("acc.description")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  {t("common.loading")}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  {t("common.no_results")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.code}</TableCell>
                  <TableCell>{r.action ?? "-"}</TableCell>
                  <TableCell>
                    {r.fromStatus ? (
                      <Badge variant="outline">{enumLabel(r.fromStatus, language)}</Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {r.toStatus ? (
                      <Badge variant="secondary">{enumLabel(r.toStatus, language)}</Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{r.actorName ?? "-"}</TableCell>
                  <TableCell>{r.actionDate ?? "-"}</TableCell>
                  <TableCell>{r.notes ?? "-"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
