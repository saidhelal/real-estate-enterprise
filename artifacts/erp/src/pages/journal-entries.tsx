import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListJournalEntries,
  useCreateJournalEntry,
  usePostJournalEntry,
  useReverseJournalEntry,
  useApproveJournalEntry,
  getListJournalEntriesQueryKey,
  useListCompanies,
  useListAccounts,
  type JournalEntryDetail,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";
import { enumLabel } from "@/lib/enums";

interface LineDraft {
  accountId: string;
  debit: string;
  credit: string;
  description: string;
}

const emptyLine = (): LineDraft => ({ accountId: "", debit: "", credit: "", description: "" });
const today = () => new Date().toISOString().slice(0, 10);

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "posted") return "default";
  if (status === "reversed") return "destructive";
  if (status === "approved") return "secondary";
  return "outline";
}

export default function JournalEntriesPage() {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: accounts } = useListAccounts({ pageSize: 500 });
  const accountList = (accounts?.data ?? []).filter((a) => a.isPostable);

  const [page, setPage] = useState(1);
  const pageSize = 10;
  const { data, isLoading } = useListJournalEntries({ page, pageSize });
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const createMutation = useCreateJournalEntry();
  const postMutation = usePostJournalEntry();
  const reverseMutation = useReverseJournalEntry();
  const approveMutation = useApproveJournalEntry();

  const [isOpen, setIsOpen] = useState(false);
  const [entryDate, setEntryDate] = useState(today());
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine(), emptyLine()]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListJournalEntriesQueryKey() });

  const accountLabel = (id: string | null | undefined) => {
    if (!id) return "—";
    const a = (accounts?.data ?? []).find((x) => x.id === id);
    if (!a) return id;
    return `${a.code} - ${language === "ar" ? a.nameAr : a.name}`;
  };

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.005;

  const setLine = (i: number, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const resetForm = () => {
    setEntryDate(today());
    setReference("");
    setDescription("");
    setLines([emptyLine(), emptyLine()]);
  };

  const handleCreate = (thenPost: boolean) => {
    if (!companyId) return;
    const payloadLines = lines
      .filter((l) => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0))
      .map((l) => ({
        accountId: l.accountId,
        debit: l.debit ? String(l.debit) : "0",
        credit: l.credit ? String(l.credit) : "0",
        description: l.description || undefined,
      }));
    if (payloadLines.length < 2) {
      toast({ title: t("acc.not_balanced"), variant: "destructive" });
      return;
    }
    createMutation.mutate(
      {
        data: {
          companyId,
          entryDate,
          reference: reference || undefined,
          description: description || undefined,
          lines: payloadLines,
        },
      },
      {
        onSuccess: (created: JournalEntryDetail) => {
          if (thenPost && created?.id) {
            postMutation.mutate(
              { id: created.id },
              {
                onSuccess: () => {
                  toast({ title: t("acc.post") + " ✓" });
                  invalidate();
                },
                onError: () => toast({ title: t("common.error"), variant: "destructive" }),
              },
            );
          } else {
            toast({ title: t("common.created") });
          }
          setIsOpen(false);
          resetForm();
          invalidate();
        },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );
  };

  const doPost = (id: string) =>
    postMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: t("acc.post") + " ✓" });
          invalidate();
        },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );

  const doReverse = (id: string) =>
    reverseMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: t("acc.reverse") + " ✓" });
          invalidate();
        },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );

  const doApprove = (id: string) =>
    approveMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: t("acc.approve") + " ✓" });
          invalidate();
        },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <h2 className="text-2xl font-bold tracking-tight">{t("nav.journal_entries")}</h2>
        <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("acc.new_entry")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{t("acc.new_entry")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t("acc.entry_date")} *</Label>
                  <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("acc.reference")}</Label>
                  <Input value={reference} onChange={(e) => setReference(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("acc.description")}</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("acc.lines")}</Label>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("acc.account")}</TableHead>
                        <TableHead className="w-28">{t("acc.debit")}</TableHead>
                        <TableHead className="w-28">{t("acc.credit")}</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((line, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Select value={line.accountId} onValueChange={(v) => setLine(i, { accountId: v })}>
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
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={line.debit}
                              onChange={(e) => setLine(i, { debit: e.target.value, credit: "" })}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={line.credit}
                              onChange={(e) => setLine(i, { credit: e.target.value, debit: "" })}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              disabled={lines.length <= 2}
                              onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, emptyLine()])}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t("acc.add_line")}
                </Button>
              </div>

              <div className="flex items-center justify-between rounded-md bg-muted px-4 py-2 text-sm">
                <span>
                  {t("acc.total_debit")}: <strong>{totalDebit.toFixed(2)}</strong>
                  {"  |  "}
                  {t("acc.total_credit")}: <strong>{totalCredit.toFixed(2)}</strong>
                </span>
                <Badge variant={balanced ? "default" : "destructive"}>
                  {balanced ? t("acc.balanced") : t("acc.not_balanced")}
                </Badge>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setIsOpen(false); resetForm(); }}>
                  {t("common.cancel")}
                </Button>
                <Button
                  variant="secondary"
                  disabled={!balanced || createMutation.isPending}
                  onClick={() => handleCreate(false)}
                >
                  {t("common.save")}
                </Button>
                <Button
                  disabled={!balanced || createMutation.isPending || postMutation.isPending}
                  onClick={() => handleCreate(true)}
                >
                  {t("acc.post")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.code")}</TableHead>
              <TableHead>{t("acc.entry_date")}</TableHead>
              <TableHead>{t("acc.description")}</TableHead>
              <TableHead className="text-right">{t("acc.total_debit")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">{t("common.loading")}</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">{t("common.no_results")}</TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.number}
                    {r.isAutomatic && (
                      <Badge variant="outline" className="ml-2">{t("acc.automatic")}</Badge>
                    )}
                  </TableCell>
                  <TableCell>{r.entryDate}</TableCell>
                  <TableCell>{language === "ar" ? r.descriptionAr || r.description : r.description}</TableCell>
                  <TableCell className="text-right">{r.totalDebit}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(r.status)}>{enumLabel(r.status, language)}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2 whitespace-nowrap">
                    {r.status === "draft" && (
                      <>
                        <Button variant="outline" size="sm" disabled={postMutation.isPending} onClick={() => doPost(r.id)}>
                          {t("acc.post")}
                        </Button>
                        <Button variant="ghost" size="sm" disabled={approveMutation.isPending} onClick={() => doApprove(r.id)}>
                          {t("acc.approve")}
                        </Button>
                      </>
                    )}
                    {r.status === "posted" && (
                      <Button variant="ghost" size="sm" className="text-destructive" disabled={reverseMutation.isPending} onClick={() => doReverse(r.id)}>
                        {t("acc.reverse")}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t("common.total")}: {total}</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            {"<"}
          </Button>
          <span className="text-sm">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
            {">"}
          </Button>
        </div>
      </div>
    </div>
  );
}
