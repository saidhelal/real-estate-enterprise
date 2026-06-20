import { useState } from "react";
import {
  useSubmitContractToFinance,
  useFinanceApproveContract,
  useFinanceReceivePartial,
  useFinanceRejectContract,
  useFinanceReturnContract,
  useLegalApproveContract,
  useCreateContractCancellation,
  getListContractsQueryKey,
  getListUnitsQueryKey,
  getListReservationsQueryKey,
  type Contract,
  type Cheque,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";
import { saleStage } from "@/lib/sale-workflow";
import {
  Send,
  CheckCircle2,
  Banknote,
  Undo2,
  XCircle,
  Scale,
  Ban,
} from "lucide-react";

type ActionKind = "submit" | "approve" | "partial" | "return" | "reject" | "legal" | "cancel";

export function ContractStageActions({
  contract,
  companyId,
  cheques,
}: {
  contract: Contract;
  companyId?: string;
  cheques: Cheque[];
}) {
  const { language, t } = useLanguage();
  const ar = language === "ar";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const submit = useSubmitContractToFinance();
  const approve = useFinanceApproveContract();
  const partial = useFinanceReceivePartial();
  const reject = useFinanceRejectContract();
  const ret = useFinanceReturnContract();
  const legal = useLegalApproveContract();
  const cancel = useCreateContractCancellation();

  const [active, setActive] = useState<ActionKind | null>(null);
  const [notes, setNotes] = useState("");
  const [selectedCheques, setSelectedCheques] = useState<string[]>([]);

  const stage = saleStage(contract);
  const today = () => new Date().toISOString().slice(0, 10);

  const isPending =
    submit.isPending || approve.isPending || partial.isPending || reject.isPending ||
    ret.isPending || legal.isPending || cancel.isPending;

  const open = (k: ActionKind) => { setActive(k); setNotes(""); setSelectedCheques([]); };
  const close = () => setActive(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getListContractsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListUnitsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListUnitsQueryKey({ pageSize: 200 }) });
    queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
  };
  const done = (en: string, arMsg: string) => { toast({ title: ar ? arMsg : en }); refresh(); close(); };
  const onError = () => toast({ title: t("common.error"), variant: "destructive" });

  const run = () => {
    if (!active) return;
    const id = contract.id;
    const data = { notes: notes || undefined };
    switch (active) {
      case "submit":
        submit.mutate({ id, data: {} }, { onSuccess: () => done("Submitted to Finance", "أُرسل إلى المالية"), onError });
        break;
      case "approve":
        approve.mutate({ id, data }, { onSuccess: () => done("Finance approved", "اعتمدته المالية"), onError });
        break;
      case "partial":
        partial.mutate(
          { id, data: { chequeIds: selectedCheques, notes: notes || undefined } },
          { onSuccess: () => done("Cheques recorded", "تم تسجيل الشيكات"), onError },
        );
        break;
      case "return":
        ret.mutate({ id, data }, { onSuccess: () => done("Returned to Sales", "أُعيد إلى المبيعات"), onError });
        break;
      case "reject":
        reject.mutate({ id, data }, { onSuccess: () => done("Contract rejected", "رُفض العقد"), onError });
        break;
      case "legal":
        legal.mutate({ id, data }, { onSuccess: () => done("Legal approved & activated", "اعتمدته القانونية وفُعّل"), onError });
        break;
      case "cancel":
        if (!companyId) { onError(); return; }
        cancel.mutate(
          { data: { companyId, contractId: id, cancellationDate: today(), reason: notes || undefined } },
          { onSuccess: () => done("Sale cancelled — unit released", "أُلغي البيع — حُررت الوحدة"), onError },
        );
        break;
    }
  };

  const contractCheques = cheques.filter((c) => c.contractId === contract.id);

  const btn = (k: ActionKind, label: string, Icon: React.ComponentType<{ className?: string }>, variant?: "default" | "outline" | "destructive") => (
    <Button size="sm" variant={variant ?? "outline"} onClick={() => open(k)}>
      <Icon className="h-4 w-4 me-1" />
      {label}
    </Button>
  );

  return (
    <div className="flex flex-wrap gap-2">
      {(stage === "draft" || stage === "returned") ? (
        <>
          {btn("submit", ar ? "إرسال إلى المالية" : "Submit to Finance", Send, "default")}
          {btn("cancel", ar ? "إلغاء البيع" : "Cancel Sale", Ban, "destructive")}
        </>
      ) : null}

      {stage === "pending_finance" ? (
        <>
          {btn("approve", ar ? "تأكيد المالية" : "Finance Confirm", CheckCircle2, "default")}
          {btn("partial", ar ? "استلام شيكات" : "Record Cheques", Banknote)}
          {btn("return", ar ? "إرجاع للمبيعات" : "Return to Sales", Undo2)}
          {btn("reject", ar ? "رفض" : "Finance Reject", XCircle, "destructive")}
          {btn("cancel", ar ? "إلغاء البيع" : "Cancel Sale", Ban, "destructive")}
        </>
      ) : null}

      {stage === "finance_approved" ? (
        <>
          {btn("legal", ar ? "اعتماد قانوني وتفعيل" : "Legal Approve & Activate", Scale, "default")}
          {btn("cancel", ar ? "إلغاء البيع" : "Cancel Sale", Ban, "destructive")}
        </>
      ) : null}

      {stage === "active" ? btn("cancel", ar ? "إلغاء البيع" : "Cancel Sale", Ban, "destructive") : null}

      <Dialog open={active != null} onOpenChange={(o) => { if (!o && !isPending) close(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {active === "submit" && (ar ? "إرسال إلى المالية" : "Submit to Finance")}
              {active === "approve" && (ar ? "تأكيد المالية" : "Finance Confirm")}
              {active === "partial" && (ar ? "استلام الشيكات" : "Record received cheques")}
              {active === "return" && (ar ? "إرجاع إلى المبيعات" : "Return to Sales")}
              {active === "reject" && (ar ? "رفض العقد" : "Reject contract")}
              {active === "legal" && (ar ? "اعتماد قانوني وتفعيل" : "Legal Approve & Activate")}
              {active === "cancel" && (ar ? "إلغاء البيع" : "Cancel Sale")}
              {` — ${contract.code}`}
            </DialogTitle>
          </DialogHeader>

          {active === "partial" ? (
            <div className="space-y-2">
              <Label>{ar ? "الشيكات المرتبطة بالعقد" : "Cheques linked to this contract"}</Label>
              {contractCheques.length === 0 ? (
                <p className="text-sm text-muted-foreground">{ar ? "لا توجد شيكات مرتبطة" : "No cheques linked"}</p>
              ) : (
                <div className="space-y-1 max-h-60 overflow-y-auto rounded-md border p-2">
                  {contractCheques.map((ch) => (
                    <label key={ch.id} className="flex items-center gap-2 text-sm py-1">
                      <Checkbox
                        checked={selectedCheques.includes(ch.id)}
                        onCheckedChange={(v) =>
                          setSelectedCheques((prev) => (v ? [...prev, ch.id] : prev.filter((x) => x !== ch.id)))
                        }
                      />
                      <span className="flex-1">
                        {ch.chequeNumber} — {ch.amount}{ch.dueDate ? ` (${ch.dueDate})` : ""}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>{ar ? (active === "cancel" ? "سبب الإلغاء" : "ملاحظات") : active === "cancel" ? "Cancellation reason" : "Notes"}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={close} disabled={isPending}>{t("common.cancel")}</Button>
            <Button
              onClick={run}
              disabled={isPending || (active === "partial" && selectedCheques.length === 0)}
              variant={active === "reject" || active === "cancel" ? "destructive" : "default"}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
