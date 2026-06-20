import { useState } from "react";
import {
  useListCheques,
  useCreateCheque,
  getListChequesQueryKey,
  useListReceipts,
  useCreateReceipt,
  useApproveReceipt,
  getListReceiptsQueryKey,
  type Contract,
  type Cheque,
  type Receipt,
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
import { useAuth } from "@/lib/auth-provider";
import { useToast } from "@/hooks/use-toast";
import { saleStage, isManagerial, genCode } from "@/lib/sale-workflow";
import { enumLabel } from "@/lib/enums";
import { Banknote, Wallet, Plus, CheckCircle2, Lock } from "lucide-react";

// Lifecycle transitions for cheques, mirrored from the API ALLOWED_TRANSITIONS.
const NEXT_STATUSES: Record<string, string[]> = {
  received: ["under_collection", "deposited", "cancelled", "replaced"],
  post_dated: ["under_collection", "deposited", "cancelled", "replaced"],
  under_collection: ["cleared", "returned", "cancelled", "replaced"],
  deposited: ["cleared", "returned", "cancelled", "replaced"],
  cleared: ["returned"],
  returned: ["replaced"],
  cancelled: [],
  replaced: [],
};

const PAYMENT_METHODS = ["cash", "bank_transfer", "cheque", "card"];

// Separate one-off payment items (NOT installment plans). Each maps to a
// receipt discriminated by its `reference` value.
const PAYMENT_ITEM_TYPES = [
  { code: "down_payment", en: "Down Payment", ar: "دفعة مقدمة" },
  { code: "maintenance_payment", en: "Maintenance Payment", ar: "دفعة صيانة" },
  { code: "handover_payment", en: "Handover Payment", ar: "دفعة الاستلام" },
];

function itemTypeLabel(ref: string | null | undefined, ar: boolean): string {
  const it = PAYMENT_ITEM_TYPES.find((t) => t.code === ref);
  return it ? (ar ? it.ar : it.en) : ref ?? "-";
}

function chequeStatusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "cleared") return "default";
  if (status === "returned" || status === "cancelled" || status === "replaced") return "destructive";
  return "secondary";
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function PaymentChequeManager({
  contract,
  companyId,
}: {
  contract: Contract;
  companyId?: string;
}) {
  const { language, t } = useLanguage();
  const ar = language === "ar";
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);

  // Once the contract is Active, only Finance / managerial users may add
  // future cheques or payment items (item 6).
  const stage = saleStage(contract);
  const financeOnly = stage === "active" && !isManagerial(user);

  const chequesQ = useListCheques({ pageSize: 200 }, { query: { queryKey: getListChequesQueryKey({ pageSize: 200 }) } });
  const receiptsQ = useListReceipts({ pageSize: 200 }, { query: { queryKey: getListReceiptsQueryKey({ pageSize: 200 }) } });

  const cheques = (chequesQ.data?.data ?? []).filter((c) => c.contractId === contract.id);
  const receipts = (receiptsQ.data?.data ?? []).filter(
    (r) => r.contractId === contract.id && PAYMENT_ITEM_TYPES.some((it) => it.code === r.reference),
  );

  const createCheque = useCreateCheque();
  const createReceipt = useCreateReceipt();
  const approveReceipt = useApproveReceipt();

  const refreshCheques = () => queryClient.invalidateQueries({ queryKey: getListChequesQueryKey({ pageSize: 200 }) });
  const refreshReceipts = () => queryClient.invalidateQueries({ queryKey: getListReceiptsQueryKey({ pageSize: 200 }) });
  const onError = () => toast({ title: t("common.error"), variant: "destructive" });

  // ---- Cheque add form state ----
  const [showChequeForm, setShowChequeForm] = useState(false);
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeBank, setChequeBank] = useState("");
  const [chequeAmount, setChequeAmount] = useState("");
  const [chequeIssue, setChequeIssue] = useState(today());
  const [chequeDue, setChequeDue] = useState(today());
  const [chequeOwner, setChequeOwner] = useState("");
  const [chequeNotes, setChequeNotes] = useState("");

  const resetChequeForm = () => {
    setChequeNumber(""); setChequeBank(""); setChequeAmount("");
    setChequeIssue(today()); setChequeDue(today()); setChequeOwner(""); setChequeNotes("");
    setShowChequeForm(false);
  };

  const submitCheque = () => {
    if (!companyId || !chequeNumber || !chequeAmount) { onError(); return; }
    createCheque.mutate(
      {
        data: {
          companyId,
          code: genCode("CHQ"),
          direction: "incoming",
          chequeNumber,
          amount: chequeAmount,
          bankName: chequeBank || undefined,
          chequeDate: chequeIssue || undefined,
          dueDate: chequeDue || undefined,
          payeeName: chequeOwner || undefined,
          notes: chequeNotes || undefined,
          contractId: contract.id,
          customerId: contract.customerId,
          unitId: contract.unitId,
          status: "received",
        },
      },
      {
        onSuccess: () => { toast({ title: ar ? "أُضيف الشيك" : "Cheque added" }); resetChequeForm(); refreshCheques(); },
        onError,
      },
    );
  };

  // ---- Cheque transition state ----
  const [txnTarget, setTxnTarget] = useState<Cheque | null>(null);
  const [txnStatus, setTxnStatus] = useState("");
  const [txnDate, setTxnDate] = useState(today());
  const [txnReason, setTxnReason] = useState("");
  const [txnBusy, setTxnBusy] = useState(false);

  const openTxn = (ch: Cheque) => { setTxnTarget(ch); setTxnStatus(""); setTxnDate(today()); setTxnReason(""); };
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
      refreshCheques();
    } catch {
      onError();
    } finally {
      setTxnBusy(false);
    }
  };

  // ---- Payment item add form state ----
  const [showItemForm, setShowItemForm] = useState(false);
  const [itemType, setItemType] = useState(PAYMENT_ITEM_TYPES[0].code);
  const [itemAmount, setItemAmount] = useState("");
  const [itemDue, setItemDue] = useState(today());
  const [itemMethod, setItemMethod] = useState("cash");

  const resetItemForm = () => {
    setItemType(PAYMENT_ITEM_TYPES[0].code); setItemAmount(""); setItemDue(today()); setItemMethod("cash");
    setShowItemForm(false);
  };

  const submitItem = () => {
    if (!companyId || !itemAmount) { onError(); return; }
    createReceipt.mutate(
      {
        data: {
          companyId,
          code: genCode("RCP"),
          customerId: contract.customerId,
          contractId: contract.id,
          amount: itemAmount,
          receiptDate: itemDue,
          paymentMethod: itemMethod,
          reference: itemType,
        },
      },
      {
        onSuccess: () => { toast({ title: ar ? "أُضيفت الدفعة" : "Payment item added" }); resetItemForm(); refreshReceipts(); },
        onError,
      },
    );
  };

  const approveItem = (r: Receipt) => {
    approveReceipt.mutate(
      { id: r.id },
      {
        onSuccess: () => { toast({ title: ar ? "اعتمدته المالية" : "Finance approved" }); refreshReceipts(); },
        onError,
      },
    );
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Wallet className="h-4 w-4 me-1" />
        {ar ? "الشيكات والدفعات" : "Cheques & Payments"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {(ar ? "الشيكات والدفعات" : "Cheques & Payments")}
              {` — ${contract.code}`}
            </DialogTitle>
          </DialogHeader>

          {financeOnly ? (
            <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <Lock className="h-4 w-4" />
              {ar
                ? "العقد مُفعّل — إضافة الشيكات والدفعات المستقبلية مقتصرة على المالية."
                : "Contract is active — adding future cheques and payments is restricted to Finance."}
            </div>
          ) : null}

          {/* ---- Cheques ---- */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Banknote className="h-4 w-4" />
                {ar ? "الشيكات" : "Cheques"}
              </h3>
              {!financeOnly ? (
                <Button size="sm" variant="ghost" onClick={() => setShowChequeForm((v) => !v)}>
                  <Plus className="h-4 w-4 me-1" />
                  {ar ? "إضافة شيك" : "Add Cheque"}
                </Button>
              ) : null}
            </div>

            {showChequeForm && !financeOnly ? (
              <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                <div className="space-y-1">
                  <Label>{t("acc.cheque_number")}</Label>
                  <Input value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{t("acc.amount")}</Label>
                  <Input type="number" value={chequeAmount} onChange={(e) => setChequeAmount(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{t("acc.bank_name")}</Label>
                  <Input value={chequeBank} onChange={(e) => setChequeBank(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{ar ? "مالك الشيك" : "Cheque Owner"}</Label>
                  <Input value={chequeOwner} onChange={(e) => setChequeOwner(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{t("acc.cheque_date")}</Label>
                  <Input type="date" value={chequeIssue} onChange={(e) => setChequeIssue(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{t("acc.due_date")}</Label>
                  <Input type="date" value={chequeDue} onChange={(e) => setChequeDue(e.target.value)} />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>{t("acc.description")}</Label>
                  <Textarea rows={2} value={chequeNotes} onChange={(e) => setChequeNotes(e.target.value)} />
                </div>
                <div className="col-span-2 flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={resetChequeForm}>{t("common.cancel")}</Button>
                  <Button size="sm" onClick={submitCheque} disabled={createCheque.isPending}>{t("common.save")}</Button>
                </div>
              </div>
            ) : null}

            {cheques.length === 0 ? (
              <p className="text-sm text-muted-foreground">{ar ? "لا توجد شيكات" : "No cheques"}</p>
            ) : (
              <div className="space-y-1">
                {cheques.map((ch) => {
                  const next = NEXT_STATUSES[ch.status] ?? [];
                  return (
                    <div key={ch.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
                      <span className="font-medium">{ch.chequeNumber}</span>
                      <span className="text-muted-foreground">{ch.amount}</span>
                      {ch.bankName ? <span className="text-muted-foreground">{ch.bankName}</span> : null}
                      {ch.dueDate ? <span className="text-muted-foreground">{ch.dueDate}</span> : null}
                      <Badge variant={chequeStatusVariant(ch.status)}>{enumLabel(ch.status, language)}</Badge>
                      {next.length > 0 ? (
                        <Button size="sm" variant="outline" className="ms-auto" onClick={() => openTxn(ch)}>
                          {ar ? "تغيير الحالة" : "Change status"}
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ---- Payment items ---- */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Wallet className="h-4 w-4" />
                {ar ? "الدفعات" : "Payment Items"}
              </h3>
              {!financeOnly ? (
                <Button size="sm" variant="ghost" onClick={() => setShowItemForm((v) => !v)}>
                  <Plus className="h-4 w-4 me-1" />
                  {ar ? "إضافة دفعة" : "Add Payment"}
                </Button>
              ) : null}
            </div>

            {showItemForm && !financeOnly ? (
              <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                <div className="space-y-1">
                  <Label>{ar ? "نوع الدفعة" : "Payment Type"}</Label>
                  <Select value={itemType} onValueChange={setItemType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_ITEM_TYPES.map((it) => (
                        <SelectItem key={it.code} value={it.code}>{ar ? it.ar : it.en}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{t("acc.amount")}</Label>
                  <Input type="number" value={itemAmount} onChange={(e) => setItemAmount(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{t("acc.due_date")}</Label>
                  <Input type="date" value={itemDue} onChange={(e) => setItemDue(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{ar ? "طريقة الدفع" : "Payment Method"}</Label>
                  <Select value={itemMethod} onValueChange={setItemMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>{enumLabel(m, language)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={resetItemForm}>{t("common.cancel")}</Button>
                  <Button size="sm" onClick={submitItem} disabled={createReceipt.isPending}>{t("common.save")}</Button>
                </div>
              </div>
            ) : null}

            {receipts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{ar ? "لا توجد دفعات" : "No payment items"}</p>
            ) : (
              <div className="space-y-1">
                {receipts.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
                    <span className="font-medium">{itemTypeLabel(r.reference, ar)}</span>
                    <span className="text-muted-foreground">{r.amount ?? "-"}</span>
                    <span className="text-muted-foreground">{r.receiptDate}</span>
                    <span className="text-muted-foreground">{enumLabel(r.paymentMethod, language)}</span>
                    <span className="text-xs text-muted-foreground">{r.code}</span>
                    <Badge variant={r.status === "draft" ? "secondary" : "default"}>{enumLabel(r.status ?? "draft", language)}</Badge>
                    {r.status === "draft" ? (
                      <Button size="sm" variant="outline" className="ms-auto" onClick={() => approveItem(r)} disabled={approveReceipt.isPending}>
                        <CheckCircle2 className="h-4 w-4 me-1" />
                        {ar ? "اعتماد المالية" : "Finance Approve"}
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{ar ? "إغلاق" : "Close"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cheque transition dialog */}
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
    </>
  );
}
