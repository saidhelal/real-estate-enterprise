import { useState } from "react";
import {
  useListReceipts,
  useCreateReceipt,
  getListReceiptsQueryKey,
  type Contract,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { saleStage, isManagerial } from "@/lib/sale-workflow";
import { enumLabel } from "@/lib/enums";
import { ChequeLifecyclePanel } from "@/components/sales/cheque-lifecycle-panel";
import { Wallet, Plus, Lock } from "lucide-react";

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

  const receiptsQ = useListReceipts({ pageSize: 200 }, { query: { queryKey: getListReceiptsQueryKey({ pageSize: 200 }) } });

  const receipts = (receiptsQ.data?.data ?? []).filter(
    (r) => r.contractId === contract.id && PAYMENT_ITEM_TYPES.some((it) => it.code === r.reference),
  );

  const createReceipt = useCreateReceipt();

  const refreshReceipts = () => queryClient.invalidateQueries({ queryKey: getListReceiptsQueryKey({ pageSize: 200 }) });
  const onError = () => toast({ title: t("common.error"), variant: "destructive" });

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
            <div className="flex items-center gap-2 rounded-md border border-warning-border/40 bg-warning-subtle p-2 text-sm text-warning-subtle-foreground">
              <Lock className="h-4 w-4" />
              {ar
                ? "العقد مُفعّل — إضافة الشيكات والدفعات المستقبلية مقتصرة على المالية."
                : "Contract is active — adding future cheques and payments is restricted to Finance."}
            </div>
          ) : null}

          {/* ---- Cheques (full lifecycle: status, change, replace, history) ---- */}
          <ChequeLifecyclePanel
            contractId={contract.id}
            companyId={companyId}
            customerId={contract.customerId}
            unitId={contract.unitId}
            canAdd={!financeOnly}
          />

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
    </>
  );
}
