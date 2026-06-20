import { useState } from "react";
import {
  useSubmitContractToFinance,
  useCreateContractCancellation,
  getListContractsQueryKey,
  getListUnitsQueryKey,
  getListReservationsQueryKey,
  type Contract,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { PaymentChequeManager } from "@/components/sales/payment-cheque-manager";
import { Send, Ban } from "lucide-react";

/**
 * Sales-pipeline actions for a contract, rendered inside the CRM/Sales module.
 *
 * This component intentionally exposes ONLY the actions the Sales team owns:
 * submitting a draft into the approval workflow and cancelling a sale (plus
 * attaching the customer's cheques). Finance approval lives exclusively in the
 * Finance module (Finance Inbox) and Legal approval lives exclusively in the
 * Legal Affairs module (Legal Approvals). CRM merely displays the current
 * approval status; it never performs another department's approval.
 */
type ActionKind = "submit" | "cancel";

export function ContractStageActions({
  contract,
  companyId,
}: {
  contract: Contract;
  companyId?: string;
}) {
  const { language, t } = useLanguage();
  const ar = language === "ar";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const submit = useSubmitContractToFinance();
  const cancel = useCreateContractCancellation();

  const [active, setActive] = useState<ActionKind | null>(null);
  const [notes, setNotes] = useState("");

  const stage = saleStage(contract);
  const today = () => new Date().toISOString().slice(0, 10);

  const isPending = submit.isPending || cancel.isPending;

  const open = (k: ActionKind) => { setActive(k); setNotes(""); };
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
    switch (active) {
      case "submit":
        submit.mutate({ id, data: {} }, { onSuccess: () => done("Submitted to Finance", "أُرسل إلى المالية"), onError });
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

  const btn = (k: ActionKind, label: string, Icon: React.ComponentType<{ className?: string }>, variant?: "default" | "outline" | "destructive") => (
    <Button size="sm" variant={variant ?? "outline"} onClick={() => open(k)}>
      <Icon className="h-4 w-4 me-1" />
      {label}
    </Button>
  );

  const canCancel = stage !== "cancelled" && stage !== "rejected";

  return (
    <div className="flex flex-wrap gap-2">
      {(stage === "draft" || stage === "returned")
        ? btn("submit", ar ? "إرسال إلى المالية" : "Submit to Finance", Send, "default")
        : null}

      {canCancel ? btn("cancel", ar ? "إلغاء البيع" : "Cancel Sale", Ban, "destructive") : null}

      {canCancel ? <PaymentChequeManager contract={contract} companyId={companyId} /> : null}

      <Dialog open={active != null} onOpenChange={(o) => { if (!o && !isPending) close(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {active === "submit" && (ar ? "إرسال إلى المالية" : "Submit to Finance")}
              {active === "cancel" && (ar ? "إلغاء البيع" : "Cancel Sale")}
              {` — ${contract.code}`}
            </DialogTitle>
          </DialogHeader>

          {active === "cancel" ? (
            <div className="space-y-2">
              <Label>{ar ? "سبب الإلغاء" : "Cancellation reason"}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {ar
                ? "سيتم إرسال العقد إلى المالية للمراجعة والاعتماد. تتم إجراءات الاعتماد داخل وحدة المالية."
                : "The contract will be sent to Finance for review and approval. Approval is performed inside the Finance module."}
            </p>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={close} disabled={isPending}>{t("common.cancel")}</Button>
            <Button
              onClick={run}
              disabled={isPending}
              variant={active === "cancel" ? "destructive" : "default"}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
