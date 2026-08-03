import { useLanguage } from "@/lib/language-provider";
import { 
  useListLoginHistory
} from "@workspace/api-client-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function LoginHistoryPage() {
  const { t } = useLanguage();
  
  const { data: history, isLoading } = useListLoginHistory();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">{t("login_history.title")}</h2>
      </div>

      <div className="rounded-md border bg-card">
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
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">{t("common.loading")}</TableCell>
              </TableRow>
            ) : history?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">{t("common.no_results")}</TableCell>
              </TableRow>
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
      </div>
    </div>
  );
}
