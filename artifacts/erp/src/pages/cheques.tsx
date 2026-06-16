import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCheques,
  useCreateCheque,
  useUpdateCheque,
  useDeleteCheque,
  getListChequesQueryKey,
  useListCompanies,
  useListCustomers,
  useListBankAccounts,
  useListSuppliers,
  useListContracts,
  useListUnits,
  useListInstallmentSchedules,
  type Cheque,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";

const DIRECTIONS = enumOptions(["incoming", "outgoing"]);
const CREATE_STATUSES = enumOptions(["received", "post_dated"]);

// Allowed next statuses for the lifecycle, keyed by current status.
const NEXT_STATUSES: Record<string, string[]> = {
  received: ["under_collection", "deposited", "cancelled"],
  post_dated: ["under_collection", "deposited", "cancelled"],
  under_collection: ["cleared", "returned", "cancelled"],
  deposited: ["cleared", "returned", "cancelled"],
  cleared: ["returned"],
  returned: [],
  cancelled: [],
};

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "cleared") return "default";
  if (status === "returned" || status === "cancelled") return "destructive";
  if (status === "deposited" || status === "under_collection") return "secondary";
  return "outline";
}

const today = () => new Date().toISOString().slice(0, 10);

export default function ChequesPage() {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: customers } = useListCustomers({ pageSize: 200 });
  const { data: bankAccounts } = useListBankAccounts({ pageSize: 200 });
  const { data: suppliers } = useListSuppliers({ pageSize: 200 });
  const { data: contracts } = useListContracts({ pageSize: 200 });
  const { data: units } = useListUnits({ pageSize: 200 });
  const { data: schedules } = useListInstallmentSchedules({ pageSize: 200 });

  const customerOptions = (customers?.data ?? []).map((c) => ({ value: c.id, label: c.fullName, labelAr: c.nameAr ?? c.fullName }));
  const bankAccountOptions = (bankAccounts?.data ?? []).map((b) => ({ value: b.id, label: `${b.bankName} - ${b.accountNumber}`, labelAr: `${b.bankNameAr} - ${b.accountNumber}` }));
  const supplierOptions = (suppliers?.data ?? []).map((s) => ({ value: s.id, label: s.name, labelAr: s.nameAr ?? s.name }));
  const contractOptions = (contracts?.data ?? []).map((c) => ({ value: c.id, label: c.code, labelAr: c.code }));
  const unitOptions = (units?.data ?? []).map((u) => ({ value: u.id, label: u.code, labelAr: u.code }));
  const scheduleOptions = (schedules?.data ?? []).map((s) => ({ value: s.id, label: `#${s.installmentNumber} - ${s.dueDate} - ${s.amount ?? ""}`, labelAr: `#${s.installmentNumber} - ${s.dueDate} - ${s.amount ?? ""}` }));

  const [target, setTarget] = useState<Cheque | null>(null);
  const [toStatus, setToStatus] = useState("");
  const [actionDate, setActionDate] = useState(today());
  const [returnReason, setReturnReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListChequesQueryKey() });

  const fields: ResourceField[] = [
    { name: "code", label: t("common.code"), required: true, createOnly: true },
    { name: "direction", label: t("acc.direction"), type: "select", required: true, options: DIRECTIONS },
    { name: "chequeNumber", label: t("acc.cheque_number"), required: true },
    { name: "amount", label: t("acc.amount"), type: "money", required: true },
    { name: "chequeDate", label: t("acc.cheque_date"), type: "date" },
    { name: "dueDate", label: t("acc.due_date"), type: "date" },
    { name: "bankName", label: t("acc.bank_name") },
    { name: "bankAccountId", label: t("nav.bank_accounts"), type: "select", options: bankAccountOptions },
    { name: "customerId", label: t("nav.customers"), type: "select", options: customerOptions },
    { name: "supplierId", label: t("nav.suppliers"), type: "select", options: supplierOptions },
    { name: "contractId", label: t("nav.contracts"), type: "select", options: contractOptions },
    { name: "unitId", label: t("acc.related_unit"), type: "select", options: unitOptions },
    { name: "scheduleId", label: t("acc.related_installment"), type: "select", options: scheduleOptions },
    { name: "payeeName", label: t("acc.payee_name") },
    { name: "status", label: t("common.status"), type: "select", options: CREATE_STATUSES },
    { name: "reference", label: t("acc.reference") },
    { name: "notes", label: t("acc.description"), type: "textarea" },
    { name: "attachments", label: t("acc.attachments"), type: "textarea" },
  ];

  const columns: ResourceColumn<Cheque>[] = [
    { header: t("common.code"), render: (r) => <span className="font-medium">{r.code}</span> },
    { header: t("acc.cheque_number"), render: (r) => r.chequeNumber },
    { header: t("acc.direction"), render: (r) => <Badge variant="outline">{enumLabel(r.direction, language)}</Badge> },
    { header: t("acc.amount"), render: (r) => r.amount ?? "-" },
    { header: t("acc.due_date"), render: (r) => r.dueDate ?? "-" },
    { header: t("common.status"), render: (r) => <Badge variant={statusVariant(r.status)}>{enumLabel(r.status, language)}</Badge> },
  ];

  const openTransition = (cheque: Cheque) => {
    setTarget(cheque);
    setToStatus(NEXT_STATUSES[cheque.status]?.[0] ?? "");
    setActionDate(today());
    setReturnReason("");
  };

  const submitTransition = async () => {
    if (!target || !toStatus) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/cheques/${target.id}/transition`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: toStatus,
          actionDate,
          returnReason: toStatus === "returned" ? returnReason || undefined : undefined,
        }),
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

  return (
    <>
      <ResourceManager
        title={t("nav.cheques")}
        columns={columns}
        fields={fields}
        useList={useListCheques}
        useCreate={useCreateCheque}
        useUpdate={useUpdateCheque}
        useDelete={useDeleteCheque}
        getListQueryKey={getListChequesQueryKey}
        companyId={companyId}
        rowActions={(r) =>
          (NEXT_STATUSES[r.status]?.length ?? 0) > 0 ? (
            <Button variant="outline" size="sm" onClick={() => openTransition(r)}>
              {t("acc.change_status")}
            </Button>
          ) : null
        }
      />

      <Dialog open={!!target} onOpenChange={(o) => { if (!o) setTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("acc.change_status")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("common.status")}</Label>
              <Select value={toStatus} onValueChange={setToStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(target ? NEXT_STATUSES[target.status] ?? [] : []).map((s) => (
                    <SelectItem key={s} value={s}>
                      {language === "ar" ? enumLabel(s, "ar") : enumLabel(s, "en")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("acc.action_date")}</Label>
              <Input type="date" value={actionDate} onChange={(e) => setActionDate(e.target.value)} />
            </div>
            {toStatus === "returned" && (
              <div className="space-y-2">
                <Label>{t("acc.return_reason")}</Label>
                <Input value={returnReason} onChange={(e) => setReturnReason(e.target.value)} />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setTarget(null)}>{t("common.cancel")}</Button>
              <Button disabled={!toStatus || submitting} onClick={submitTransition}>{t("common.save")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
