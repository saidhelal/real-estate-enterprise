import { useState } from "react";
import {
  useListCheques,
  useCreateCheque,
  getListChequesQueryKey,
  useListChequeStatusHistorys,
  getListChequeStatusHistorysQueryKey,
  type Cheque,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";
import { genCode } from "@/lib/sale-workflow";
import { enumLabel } from "@/lib/enums";
import { Banknote, Plus, History } from "lucide-react";

// Lifecycle transitions, mirrored from the API ALLOWED_TRANSITIONS. `replaced`
// is reached only via the dedicated /replace endpoint, never a plain transition.
const NEXT_STATUSES: Record<string, string[]> = {
  received: ["under_collection", "cancelled"],
  under_collection: ["collected", "returned", "cancelled"],
  collected: ["returned"],
  returned: [],
  cancelled: [],
  replaced: [],
};

// A cheque may be swapped for a replacement only while it has not been collected
// or already terminated. Mirrors the API REPLACEABLE_FROM set.
const REPLACEABLE_FROM = new Set(["received", "under_collection", "returned"]);

function chequeStatusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "collected") return "default";
  if (status === "returned" || status === "cancelled" || status === "replaced") return "destructive";
  return "secondary";
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Self-contained cheque lifecycle manager for a single contract: lists the
 * contract's cheques with their status, supports Add, Change Status, Replace,
 * and an inline status History panel. Used both inside the Sales Workflow
 * cheque dialog and directly inside the Start Sale dialog.
 */
export function ChequeLifecyclePanel({
  contractId,
  companyId,
  customerId,
  unitId,
  canAdd = true,
}: {
  contractId: string;
  companyId?: string;
  customerId?: string;
  unitId?: string;
  canAdd?: boolean;
}) {
  const { language, t } = useLanguage();
  const ar = language === "ar";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const chequesQ = useListCheques(
    { pageSize: 200 },
    { query: { queryKey: getListChequesQueryKey({ pageSize: 200 }) } },
  );
  const historyQ = useListChequeStatusHistorys(
    { pageSize: 200 },
    { query: { queryKey: getListChequeStatusHistorysQueryKey({ pageSize: 200 }) } },
  );

  const cheques = (chequesQ.data?.data ?? []).filter((c) => c.contractId === contractId);
  const historyRows = historyQ.data?.data ?? [];

  const createCheque = useCreateCheque();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getListChequesQueryKey({ pageSize: 200 }) });
    queryClient.invalidateQueries({ queryKey: getListChequeStatusHistorysQueryKey({ pageSize: 200 }) });
  };
  const onError = () => toast({ title: t("common.error"), variant: "destructive" });

  // Which cheque's status history is currently expanded inline.
  const [historyOpen, setHistoryOpen] = useState<string | null>(null);

  // ---- Add form state ----
  const [showAdd, setShowAdd] = useState(false);
  const [num, setNum] = useState("");
  const [bank, setBank] = useState("");
  const [amount, setAmount] = useState("");
  const [issue, setIssue] = useState(today());
  const [due, setDue] = useState(today());
  const [owner, setOwner] = useState("");
  const [notes, setNotes] = useState("");

  const resetAdd = () => {
    setNum(""); setBank(""); setAmount(""); setIssue(today()); setDue(today());
    setOwner(""); setNotes(""); setShowAdd(false);
  };

  const submitAdd = () => {
    if (!companyId || !num || !amount) { onError(); return; }
    createCheque.mutate(
      {
        data: {
          companyId,
          code: genCode("CHQ"),
          direction: "incoming",
          chequeNumber: num,
          amount,
          bankName: bank || undefined,
          chequeDate: issue || undefined,
          dueDate: due || undefined,
          payeeName: owner || undefined,
          notes: notes || undefined,
          contractId,
          customerId,
          unitId,
          status: "received",
        },
      },
      {
        onSuccess: () => { toast({ title: ar ? "أُضيف الشيك" : "Cheque added" }); resetAdd(); refresh(); },
        onError,
      },
    );
  };

  // ---- Transition (change status) state ----
  const [txnTarget, setTxnTarget] = useState<Cheque | null>(null);
  const [txnStatus, setTxnStatus] = useState("");
  const [txnDate, setTxnDate] = useState(today());
  const [txnReason, setTxnReason] = useState("");
  const [txnBusy, setTxnBusy] = useState(false);

  const openTxn = (ch: Cheque) => {
    setTxnTarget(ch);
    setTxnStatus(NEXT_STATUSES[ch.status]?.[0] ?? "");
    setTxnDate(today());
    setTxnReason("");
  };

  const submitTxn = async () => {
    if (!txnTarget || !txnStatus) return;
    setTxnBusy(true);
    try {
      const res = await fetch(`/api/cheques/${txnTarget.id}/transition`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: txnStatus,
          actionDate: txnDate,
          returnReason: txnStatus === "returned" ? txnReason || undefined : undefined,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast({ title: ar ? "تم تحديث حالة الشيك" : "Cheque status updated" });
      setTxnTarget(null);
      refresh();
    } catch {
      onError();
    } finally {
      setTxnBusy(false);
    }
  };

  // ---- Replace state ----
  const [replaceTarget, setReplaceTarget] = useState<Cheque | null>(null);
  const [replNum, setReplNum] = useState("");
  const [replAmount, setReplAmount] = useState("");
  const [replDue, setReplDue] = useState("");
  const [replNotes, setReplNotes] = useState("");
  const [replBusy, setReplBusy] = useState(false);

  const openReplace = (ch: Cheque) => {
    setReplaceTarget(ch);
    setReplNum("");
    setReplAmount(ch.amount ?? "");
    setReplDue(ch.dueDate ?? "");
    setReplNotes("");
  };

  const submitReplace = async () => {
    if (!replaceTarget) return;
    setReplBusy(true);
    try {
      const res = await fetch(`/api/cheques/${replaceTarget.id}/replace`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chequeNumber: replNum || undefined,
          amount: replAmount || undefined,
          dueDate: replDue || undefined,
          notes: replNotes || undefined,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast({ title: ar ? "تم استبدال الشيك" : "Cheque replaced" });
      setReplaceTarget(null);
      refresh();
    } catch {
      onError();
    } finally {
      setReplBusy(false);
    }
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Banknote className="h-4 w-4" />
          {ar ? "الشيكات" : "Cheques"}
        </h3>
        {canAdd ? (
          <Button size="sm" variant="ghost" onClick={() => setShowAdd((v) => !v)}>
            <Plus className="h-4 w-4 me-1" />
            {ar ? "إضافة شيك" : "Add Cheque"}
          </Button>
        ) : null}
      </div>

      {showAdd && canAdd ? (
        <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
          <div className="space-y-1">
            <Label>{t("acc.cheque_number")}</Label>
            <Input value={num} onChange={(e) => setNum(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{t("acc.amount")}</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{t("acc.bank_name")}</Label>
            <Input value={bank} onChange={(e) => setBank(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{ar ? "مالك الشيك" : "Cheque Owner"}</Label>
            <Input value={owner} onChange={(e) => setOwner(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{t("acc.cheque_date")}</Label>
            <Input type="date" value={issue} onChange={(e) => setIssue(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{t("acc.due_date")}</Label>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          {/* Status on creation is always Received (enforced by the API). */}
          <div className="space-y-1">
            <Label>{t("common.status")}</Label>
            <Input value={enumLabel("received", language)} disabled readOnly />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>{t("acc.description")}</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="col-span-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={resetAdd}>{t("common.cancel")}</Button>
            <Button size="sm" onClick={submitAdd} disabled={createCheque.isPending}>{t("common.save")}</Button>
          </div>
        </div>
      ) : null}

      {cheques.length === 0 ? (
        <p className="text-sm text-muted-foreground">{ar ? "لا توجد شيكات" : "No cheques"}</p>
      ) : (
        <div className="space-y-1">
          {cheques.map((ch) => {
            const next = NEXT_STATUSES[ch.status] ?? [];
            const canReplace = REPLACEABLE_FROM.has(ch.status);
            const isHistoryOpen = historyOpen === ch.id;
            const rows = historyRows
              .filter((h) => h.chequeId === ch.id)
              .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
            return (
              <div key={ch.id} className="rounded-md border p-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{ch.chequeNumber}</span>
                  <span className="text-muted-foreground">{ch.amount}</span>
                  {ch.bankName ? <span className="text-muted-foreground">{ch.bankName}</span> : null}
                  {ch.dueDate ? <span className="text-muted-foreground">{ch.dueDate}</span> : null}
                  <Badge variant={chequeStatusVariant(ch.status)}>{enumLabel(ch.status, language)}</Badge>
                  <div className="ms-auto flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setHistoryOpen((v) => (v === ch.id ? null : ch.id))}
                    >
                      <History className="h-4 w-4 me-1" />
                      {ar ? "السجل" : "History"}
                    </Button>
                    {canReplace ? (
                      <Button size="sm" variant="outline" onClick={() => openReplace(ch)}>
                        {t("acc.replace_cheque")}
                      </Button>
                    ) : null}
                    {next.length > 0 ? (
                      <Button size="sm" variant="outline" onClick={() => openTxn(ch)}>
                        {ar ? "تغيير الحالة" : "Change status"}
                      </Button>
                    ) : null}
                  </div>
                </div>
                {isHistoryOpen ? (
                  <div className="mt-2 space-y-1 rounded-md bg-muted/40 p-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {ar ? "سجل حالة الشيك" : "Cheque status history"}
                    </p>
                    {rows.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{ar ? "لا يوجد سجل" : "No history"}</p>
                    ) : (
                      rows.map((h) => (
                        <div key={h.id} className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-muted-foreground">{(h.actionDate ?? h.createdAt ?? "").slice(0, 10)}</span>
                          <span>
                            {h.fromStatus ? enumLabel(h.fromStatus, language) : "—"}
                            {" → "}
                            {h.toStatus ? enumLabel(h.toStatus, language) : "—"}
                          </span>
                          {h.actorName ? <span className="text-muted-foreground">· {h.actorName}</span> : null}
                          {h.notes ? <span className="text-muted-foreground">· {h.notes}</span> : null}
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Change status dialog */}
      <Dialog open={txnTarget != null} onOpenChange={(o) => { if (!o && !txnBusy) setTxnTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ar ? "تغيير حالة الشيك" : "Change cheque status"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{t("common.status")}</Label>
              <Select value={txnStatus} onValueChange={setTxnStatus}>
                <SelectTrigger><SelectValue placeholder={ar ? "اختر الحالة" : "Select status"} /></SelectTrigger>
                <SelectContent>
                  {(txnTarget ? NEXT_STATUSES[txnTarget.status] ?? [] : []).map((s) => (
                    <SelectItem key={s} value={s}>{enumLabel(s, language)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{ar ? "تاريخ الإجراء" : "Action date"}</Label>
              <Input type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} />
            </div>
            {txnStatus === "returned" ? (
              <div className="space-y-1">
                <Label>{ar ? "سبب الإرجاع" : "Return reason"}</Label>
                <Input value={txnReason} onChange={(e) => setTxnReason(e.target.value)} />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTxnTarget(null)} disabled={txnBusy}>{t("common.cancel")}</Button>
            <Button onClick={submitTxn} disabled={!txnStatus || txnBusy}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replace dialog */}
      <Dialog open={replaceTarget != null} onOpenChange={(o) => { if (!o && !replBusy) setReplaceTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("acc.replace_cheque")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>{t("acc.cheque_number")}</Label>
              <Input value={replNum} onChange={(e) => setReplNum(e.target.value)} placeholder={replaceTarget?.chequeNumber ?? ""} />
            </div>
            <div className="space-y-1">
              <Label>{t("acc.amount")}</Label>
              <Input type="number" value={replAmount} onChange={(e) => setReplAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("acc.due_date")}</Label>
              <Input type="date" value={replDue} onChange={(e) => setReplDue(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("acc.description")}</Label>
              <Textarea rows={2} value={replNotes} onChange={(e) => setReplNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReplaceTarget(null)} disabled={replBusy}>{t("common.cancel")}</Button>
            <Button onClick={submitReplace} disabled={replBusy}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
