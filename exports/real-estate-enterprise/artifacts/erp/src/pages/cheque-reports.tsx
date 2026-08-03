import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useListCompanies,
  type Cheque,
} from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

const STATUS_FILTERS = [
  "all",
  "received",
  "under_collection",
  "collected",
  "returned",
  "cancelled",
  "replaced",
] as const;

const DIRECTION_FILTERS = ["all", "incoming", "outgoing"] as const;

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "collected") return "default";
  if (status === "returned" || status === "cancelled" || status === "replaced") return "destructive";
  if (status === "under_collection") return "secondary";
  return "outline";
}

export default function ChequeReportsPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [direction, setDirection] = useState<(typeof DIRECTION_FILTERS)[number]>("all");

  // Reporting needs accurate global totals, so page through ALL matching
  // cheques (the list endpoint caps pageSize at 200) before aggregating.
  const { data: rows = [], isLoading } = useQuery<Cheque[]>({
    queryKey: ["cheque-reports", companyId, direction, status],
    enabled: !!companyId,
    queryFn: async () => {
      const all: Cheque[] = [];
      const pageSize = 200;
      let page = 1;
      for (;;) {
        const qs = new URLSearchParams();
        if (companyId) qs.set("companyId", companyId);
        if (direction !== "all") qs.set("direction", direction);
        if (status !== "all") qs.set("status", status);
        qs.set("page", String(page));
        qs.set("pageSize", String(pageSize));
        const res = await fetch(`/api/cheques?${qs.toString()}`, { credentials: "include" });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { data?: Cheque[]; total?: number };
        const batch = json.data ?? [];
        all.push(...batch);
        const total = json.total ?? all.length;
        if (batch.length === 0 || all.length >= total) break;
        page += 1;
      }
      return all;
    },
  });
  const totalAmount = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("nav.cheque_reports")}</h2>
        <p className="text-sm text-muted-foreground">{t("acc.cheque_reports_desc")}</p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label>{t("acc.direction")}</Label>
          <Select value={direction} onValueChange={(v) => setDirection(v as typeof direction)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIRECTION_FILTERS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d === "all" ? t("common.all") : enumLabel(d, language)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("common.status")}</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "all" ? t("common.all") : enumLabel(s, language)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ms-auto text-sm text-muted-foreground">
          <div>{t("acc.count")}: <span className="font-semibold text-foreground">{rows.length}</span></div>
          <div>{t("acc.total_amount")}: <span className="font-semibold text-foreground">{totalAmount.toFixed(2)}</span></div>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.code")}</TableHead>
              <TableHead>{t("acc.cheque_number")}</TableHead>
              <TableHead>{t("acc.direction")}</TableHead>
              <TableHead>{t("acc.bank_name")}</TableHead>
              <TableHead>{t("acc.amount")}</TableHead>
              <TableHead>{t("acc.due_date")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
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
                  <TableCell>{r.chequeNumber}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{enumLabel(r.direction, language)}</Badge>
                  </TableCell>
                  <TableCell>{r.bankName ?? "-"}</TableCell>
                  <TableCell>{r.amount ?? "-"}</TableCell>
                  <TableCell>{r.dueDate ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(r.status)}>{enumLabel(r.status, language)}</Badge>
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
