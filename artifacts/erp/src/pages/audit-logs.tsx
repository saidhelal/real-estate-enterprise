import { useState } from "react";
import { useLanguage } from "@/lib/language-provider";
import { PageHeader } from "@/components/ui/page-header";
import { 
  useListAuditLogs, 
  getListAuditLogsQueryKey
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
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
import { format } from "date-fns";

export default function AuditLogsPage() {
  const { t } = useLanguage();
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  
  const { data: logs, isLoading } = useListAuditLogs({
    entity: entityFilter || undefined,
    action: actionFilter || undefined,
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <PageHeader title={t("audit_logs.title")} bordered={false} />
      </div>

      <div className="flex gap-4 max-w-lg">
        <Input 
          placeholder={t("audit_logs.filter_entity")}
          value={entityFilter}
          onChange={e => setEntityFilter(e.target.value)}
        />
        <Input 
          placeholder={t("audit_logs.filter_action")}
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
        />
      </div>

      <TableFrame>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.timestamp")}</TableHead>
              <TableHead>{t("common.user")}</TableHead>
              <TableHead>{t("common.action")}</TableHead>
              <TableHead>{t("common.entity")}</TableHead>
              <TableHead>{t("common.details")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableState colSpan={5} isLoading loadingLabel={t("common.loading")} emptyTitle={t("common.no_results")} />
            ) : logs?.length === 0 ? (
              <TableState colSpan={5} isEmpty emptyTitle={t("common.no_results")} />
            ) : (
              logs?.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(log.createdAt), 'PP pp')}
                  </TableCell>
                  <TableCell className="font-medium">{log.userName}</TableCell>
                  <TableCell>
                    <span className="bg-muted px-2 py-1 rounded-md text-xs uppercase font-semibold">
                      {log.action}
                    </span>
                  </TableCell>
                  <TableCell>{log.entity} {log.entityId && <span className="text-xs text-muted-foreground">({log.entityId})</span>}</TableCell>
                  <TableCell className="max-w-[300px]">
                    {log.newValue && (
                      <div className="text-xs font-mono bg-muted/50 p-2 rounded truncate" title={log.newValue}>
                        {log.newValue}
                      </div>
                    )}
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
