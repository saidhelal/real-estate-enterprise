import { useState } from "react";
import {
  useListContracts,
  getListContractsQueryKey,
  useFinanceApproveContract,
  useFinanceReceivePartial,
  useFinanceRejectContract,
  useFinanceReturnContract,
  useListCheques,
  useListCustomers,
  useListUnits,
  useListCompanies,
  type Contract,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Undo2, Banknote, Clock } from "lucide-react";

type ActionKind = "approve" | "partial" | "reject" | "return";

export default function FinanceInboxPage() {
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: contracts, isLoading } = useListContracts(
    { status: "pending_finance", pageSize: 200 },
    { query: { queryKey: getListContractsQueryKey({ status: "pending_finance", pageSize: 200 }) } },
  );
  const { data: customers } = useListCustomers({ pageSize: 200 });
  const { data: units } = useListUnits({ pageSize: 200 });
  const { data: cheques } = useListCheques({ pageSize: 200 });

  const approve = useFinanceApproveContract();
  const partial = useFinanceReceivePartial();
  const reject = useFinanceRejectContract();
  const ret = useFinanceReturnContract();

  const [active, setActive] = useState<{ contract: Contract; kind: ActionKind } | null>(null);
  const [notes, setNotes] = useState("");
  const [selectedCheques, setSelectedCheques] = useState<string[]>([]);

  const customerName = (id: string) => customers?.data.find((c) => c.id === id)?.fullName ?? id;
  const unitCode = (id: string) => units?.data.find((u) => u.id === id)?.code ?? id;

  const openAction = (contract: Contract, kind: ActionKind) => {
    setActive({ contract, kind });
    setNotes("");
    setSelectedCheques([]);
  };
  const close = () => setActive(null);

  const isPending = approve.isPending || partial.isPending || reject.isPending || ret.isPending;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getListContractsQueryKey({ status: "pending_finance", pageSize: 200 }) });
    queryClient.invalidateQueries({ queryKey: getListContractsQueryKey() });
  };
  const onDone = (titleEn: string, titleAr: string) => {
    toast({ title: language === "ar" ? titleAr : titleEn });
    refresh();
    close();
  };
  const onError = () => toast({ title: t("common.error"), variant: "destructive" });

  const submit = () => {
    if (!active) return;
    const id = active.contract.id;
    switch (active.kind) {
      case "approve":
        approve.mutate(
          { id, data: { notes: notes || undefined } },
          { onSuccess: () => onDone("Contract approved", "تم اعتماد العقد"), onError },
        );
        break;
      case "partial":
        partial.mutate(
          { id, data: { chequeIds: selectedCheques, notes: notes || undefined } },
          { onSuccess: () => onDone("Cheques recorded", "تم تسجيل الشيكات"), onError },
        );
        break;
      case "reject":
        reject.mutate(
          { id, data: { notes: notes || undefined } },
          { onSuccess: () => onDone("Contract rejected", "تم رفض العقد"), onError },
        );
        break;
      case "return":
        ret.mutate(
          { id, data: { notes: notes || undefined } },
          { onSuccess: () => onDone("Returned to sales", "أُعيد إلى المبيعات"), onError },
        );
        break;
    }
  };

  const contractCheques = active
    ? (cheques?.data ?? []).filter((c) => c.contractId === active.contract.id)
    : [];

  const overdue = (c: Contract) =>
    c.financeSlaDueAt != null && new Date(c.financeSlaDueAt).getTime() < Date.now();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">
          {language === "ar" ? "صندوق المالية" : "Finance Inbox"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {language === "ar"
            ? "العقود المرسلة من المبيعات بانتظار اعتماد المالية"
            : "Contracts submitted by sales awaiting finance approval"}
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !contracts || contracts.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {language === "ar" ? "لا توجد عقود بانتظار المراجعة" : "No contracts awaiting review"}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {contracts.data.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="font-medium">{c.code}</span>
                  <div className="flex items-center gap-2">
                    {overdue(c) ? (
                      <Badge variant="destructive" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {language === "ar" ? "تجاوز المهلة" : "SLA overdue"}
                      </Badge>
                    ) : null}
                    <Badge variant="outline">{enumLabel(c.status, language)}</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                  <span>{language === "ar" ? "العميل" : "Customer"}: {customerName(c.customerId)}</span>
                  <span>{language === "ar" ? "الوحدة" : "Unit"}: {unitCode(c.unitId)}</span>
                  <span>{language === "ar" ? "القيمة" : "Total"}: {c.totalPrice}</span>
                  <span>{language === "ar" ? "طريقة الدفع" : "Payment"}: {enumLabel(c.paymentMethod, language)}</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" onClick={() => openAction(c, "approve")}>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    {language === "ar" ? "اعتماد" : "Approve"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openAction(c, "partial")}>
                    <Banknote className="h-4 w-4 mr-1" />
                    {language === "ar" ? "استلام شيكات" : "Record cheques"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openAction(c, "return")}>
                    <Undo2 className="h-4 w-4 mr-1" />
                    {language === "ar" ? "إرجاع" : "Return"}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => openAction(c, "reject")}>
                    <XCircle className="h-4 w-4 mr-1" />
                    {language === "ar" ? "رفض" : "Reject"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={active != null} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {active?.kind === "approve" && (language === "ar" ? "اعتماد العقد" : "Approve contract")}
              {active?.kind === "partial" && (language === "ar" ? "استلام الشيكات" : "Record received cheques")}
              {active?.kind === "return" && (language === "ar" ? "إرجاع إلى المبيعات" : "Return to sales")}
              {active?.kind === "reject" && (language === "ar" ? "رفض العقد" : "Reject contract")}
              {active ? ` — ${active.contract.code}` : ""}
            </DialogTitle>
          </DialogHeader>

          {active?.kind === "partial" ? (
            <div className="space-y-2">
              <Label>{language === "ar" ? "الشيكات المرتبطة بالعقد" : "Cheques linked to this contract"}</Label>
              {contractCheques.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "لا توجد شيكات مرتبطة" : "No cheques linked to this contract"}
                </p>
              ) : (
                <div className="space-y-1 max-h-60 overflow-y-auto rounded-md border p-2">
                  {contractCheques.map((ch) => (
                    <label key={ch.id} className="flex items-center gap-2 text-sm py-1">
                      <Checkbox
                        checked={selectedCheques.includes(ch.id)}
                        onCheckedChange={(v) =>
                          setSelectedCheques((prev) =>
                            v ? [...prev, ch.id] : prev.filter((x) => x !== ch.id),
                          )
                        }
                      />
                      <span className="flex-1">
                        {ch.chequeNumber} — {ch.amount}
                        {ch.dueDate ? ` (${ch.dueDate})` : ""}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>{language === "ar" ? "ملاحظات" : "Notes"}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={close} disabled={isPending}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={submit}
              disabled={isPending || (active?.kind === "partial" && selectedCheques.length === 0)}
              variant={active?.kind === "reject" ? "destructive" : "default"}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
