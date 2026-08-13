import { useLanguage } from "@/lib/language-provider";
import { PageHeader } from "@/components/ui/page-header";
import { 
  useListLoginHistory
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
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function LoginHistoryPage() {
  const { t } = useLanguage();
  
  const { data: history, isLoading } = useListLoginHistory();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <PageHeader title={t("login_history.title")} bordered={false} />
      </div>

      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.timestamp")}</TableHead>
              <TableHead>{t("common.user")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead>{t("login_history.ip")}</TableHead>
              <TableHead>{t("login_history.user_agent")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableState colSpan={5} isLoading loadingLabel={t("common.loading")} emptyTitle={t("common.no_results")} />
            ) : history?.length === 0 ? (
              <TableState colSpan={5} isEmpty emptyTitle={t("common.no_results")} />
            ) : (
              history?.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(entry.createdAt), 'PP pp')}
                  </TableCell>
                  <TableCell className="font-medium">{entry.userName}</TableCell>
                  <TableCell>
                    <Badge variant={entry.success ? "default" : "destructive"}>
                      {entry.success ? t("common.success") : t("common.failed")}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{entry.ipAddress}</TableCell>
                  <TableCell className="text-xs truncate max-w-[300px]" title={entry.userAgent || ""}>
                    {entry.userAgent}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableFrame>
    </div>
  );
}
