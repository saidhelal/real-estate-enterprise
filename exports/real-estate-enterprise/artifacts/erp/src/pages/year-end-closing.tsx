import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListFiscalYears,
  getListFiscalYearsQueryKey,
  type FiscalYear,
} from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/lib/language-provider";
import { useAuth } from "@/lib/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { enumLabel } from "@/lib/enums";

export default function YearEndClosingPage() {
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: years, isLoading } = useListFiscalYears();
  const list = (years ?? []) as FiscalYear[];

  const can = (perm: string) =>
    !!user && (user.permissions.includes("*") || user.permissions.includes(perm));
  const canClose = can("fiscalYears.close");
  const canReopen = can("fiscalYears.reopen");

  const [target, setTarget] = useState<FiscalYear | null>(null);
  const [closingDate, setClosingDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListFiscalYearsQueryKey() });

  const openClose = (fy: FiscalYear) => {
    setTarget(fy);
    setClosingDate(fy.endDate ?? "");
  };

  const submitClose = async () => {
    if (!target) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/fiscal-years/${target.id}/year-end-close`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closingDate: closingDate || undefined }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast({ title: t("common.updated") });
      setTarget(null);
      invalidate();
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const reopen = async (fy: FiscalYear) => {
    try {
      const res = await fetch(`/api/fiscal-years/${fy.id}/reopen`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(String(res.status));
      toast({ title: t("common.updated") });
      invalidate();
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("nav.year_end_closing")}</h1>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("acc.start_date")}</TableHead>
              <TableHead>{t("acc.end_date")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-end">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {t("common.loading")}
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {t("common.no_results")}
                </TableCell>
              </TableRow>
            ) : (
              list.map((fy) => (
                <TableRow key={fy.id}>
                  <TableCell className="font-medium">{fy.name}</TableCell>
                  <TableCell>{fy.startDate}</TableCell>
                  <TableCell>{fy.endDate}</TableCell>
                  <TableCell>
                    <Badge variant={fy.status === "closed" ? "destructive" : "secondary"}>
                      {enumLabel(fy.status, language)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    {fy.status === "closed"
                      ? canReopen && (
                          <Button variant="outline" size="sm" onClick={() => reopen(fy)}>
                            {t("acc.reopen_year")}
                          </Button>
                        )
                      : canClose && (
                          <Button variant="outline" size="sm" onClick={() => openClose(fy)}>
                            {t("acc.close_year")}
                          </Button>
                        )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!target} onOpenChange={(o) => { if (!o) setTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("acc.close_year")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("acc.closing_date")}</Label>
              <Input type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setTarget(null)}>{t("common.cancel")}</Button>
              <Button disabled={submitting} onClick={submitClose}>{t("acc.close_year")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
