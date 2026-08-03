import { useState } from "react";
import { Link } from "wouter";
import {
  useListContracts,
  getListContractsQueryKey,
  useLegalApproveContract,
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
import { ShieldCheck, FileText } from "lucide-react";

export default function LegalApprovalsPage() {
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: companies } = useListCompanies();
  void companies;
  const { data: contracts, isLoading } = useListContracts(
    { status: "finance_approved", pageSize: 200 },
    { query: { queryKey: getListContractsQueryKey({ status: "finance_approved", pageSize: 200 }) } },
  );
  const { data: customers } = useListCustomers({ pageSize: 200 });
  const { data: units } = useListUnits({ pageSize: 200 });

  const approve = useLegalApproveContract();
  const [active, setActive] = useState<Contract | null>(null);
  const [notes, setNotes] = useState("");

  const customerName = (id: string) => customers?.data.find((c) => c.id === id)?.fullName ?? id;
  const unitCode = (id: string) => units?.data.find((u) => u.id === id)?.code ?? id;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getListContractsQueryKey({ status: "finance_approved", pageSize: 200 }) });
    queryClient.invalidateQueries({ queryKey: getListContractsQueryKey() });
  };

  const submit = () => {
    if (!active) return;
    approve.mutate(
      { id: active.id, data: { notes: notes || undefined } },
      {
        onSuccess: () => {
          toast({ title: language === "ar" ? "تم اعتماد العقد وتفعيله" : "Contract approved and activated" });
          refresh();
          setActive(null);
        },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">
          {language === "ar" ? "اعتمادات الشؤون القانونية" : "Legal Approvals"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {language === "ar"
            ? "العقود المعتمدة من المالية بانتظار الاعتماد القانوني والتفعيل"
            : "Finance-approved contracts awaiting legal approval and activation"}
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !contracts || contracts.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {language === "ar" ? "لا توجد عقود بانتظار الاعتماد" : "No contracts awaiting approval"}
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {contracts.data.map((c) => (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="font-medium">{c.code}</span>
                  <Badge variant="outline">{enumLabel(c.status, language)}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                  <span>{language === "ar" ? "العميل" : "Customer"}: {customerName(c.customerId)}</span>
                  <span>{language === "ar" ? "الوحدة" : "Unit"}: {unitCode(c.unitId)}</span>
                  <span>{language === "ar" ? "القيمة" : "Total"}: {c.totalPrice}</span>
                  <span>{language === "ar" ? "طريقة الدفع" : "Payment"}: {enumLabel(c.paymentMethod, language)}</span>
                </div>
                {c.financeNotes ? (
                  <p className="text-xs text-muted-foreground">
                    {language === "ar" ? "ملاحظات المالية" : "Finance notes"}: {c.financeNotes}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" onClick={() => { setActive(c); setNotes(""); }}>
                    <ShieldCheck className="h-4 w-4 mr-1" />
                    {language === "ar" ? "اعتماد وتفعيل" : "Approve & activate"}
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/contracts/${c.id}/document`}>
                      <FileText className="h-4 w-4 mr-1" />
                      {language === "ar" ? "المستند" : "Document"}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={active != null} onOpenChange={(o) => { if (!o) setActive(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "اعتماد قانوني وتفعيل" : "Legal approval & activation"}
              {active ? ` — ${active.code}` : ""}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {language === "ar"
              ? "سيتم تفعيل العقد، وترحيل القيود المحاسبية، وتحديث حالة الوحدة إلى مباعة."
              : "This activates the contract, posts the accounting entries, and marks the unit as sold."}
          </p>
          <div className="space-y-2">
            <Label>{language === "ar" ? "ملاحظات" : "Notes"}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setActive(null)} disabled={approve.isPending}>
              {t("common.cancel")}
            </Button>
            <Button onClick={submit} disabled={approve.isPending}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
