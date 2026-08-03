import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPaymentVouchers,
  useCreatePaymentVoucher,
  useDeletePaymentVoucher,
  useApprovePaymentVoucher,
  usePostPaymentVoucher,
  useReversePaymentVoucher,
  useCancelPaymentVoucher,
  getListPaymentVouchersQueryKey,
  useListSuppliers,
  useListContractors,
  useListSupplierInvoices,
  useListCompanies,
  useListCashboxes,
  useListBankAccounts,
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
import { DocumentsRowAction } from "@/components/documents/documents-row-action";
import { useToast } from "@/hooks/use-toast";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";

const PAYEE_TYPES = enumOptions(["supplier", "contractor", "other"]);
const today = () => new Date().toISOString().slice(0, 10);
const NONE = "__none__";

interface AllocDraft {
  supplierInvoiceId: string;
  amount: string;
}

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "posted") return "default";
  if (status === "reversed" || status === "cancelled") return "destructive";
  if (status === "approved") return "secondary";
  return "outline";
}

export default function PaymentVouchersPage() {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { options: PAYMENT_METHODS } = useLookupOptions("payment_method", ["cash", "bank_transfer", "cheque"]);

  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: suppliers } = useListSuppliers({ pageSize: 200 });
  const { data: contractors } = useListContractors({ pageSize: 200 });
  const { data: cashboxes } = useListCashboxes({ pageSize: 200 });
  const { data: banks } = useListBankAccounts({ pageSize: 200 });

  const supplierList = suppliers?.data ?? [];
  const contractorList = contractors?.data ?? [];

  const [page, setPage] = useState(1);
  const pageSize = 10;
  const { data, isLoading } = useListPaymentVouchers({ page, pageSize });
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const createMutation = useCreatePaymentVoucher();
  const deleteMutation = useDeletePaymentVoucher();
  const approveMutation = useApprovePaymentVoucher();
  const postMutation = usePostPaymentVoucher();
  const reverseMutation = useReversePaymentVoucher();
  const cancelMutation = useCancelPaymentVoucher();

  const [isOpen, setIsOpen] = useState(false);
  const [payeeType, setPayeeType] = useState("supplier");
  const [supplierId, setSupplierId] = useState("");
  const [contractorId, setContractorId] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashboxId, setCashboxId] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [bankName, setBankName] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [allocations, setAllocations] = useState<AllocDraft[]>([]);

  const { data: supplierInvoices } = useListSupplierInvoices(
    supplierId ? { supplierId, pageSize: 200 } : { pageSize: 0 },
  );
  const openSupplierInvoices = (supplierInvoices?.data ?? []).filter(
    (i) => i.status === "posted" || i.status === "partially_paid",
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListPaymentVouchersQueryKey() });

  const payeeLabel = (id: string, list: { id: string; code: string; name: string; nameAr?: string | null }[]) => {
    const p = list.find((x) => x.id === id);
    return p ? `${p.code} - ${language === "ar" ? p.nameAr || p.name : p.name}` : id;
  };
  const voucherPayee = (r: { payeeType: string; supplierId?: string | null; contractorId?: string | null; payeeName?: string | null }) => {
    if (r.payeeType === "supplier" && r.supplierId) return payeeLabel(r.supplierId, supplierList);
    if (r.payeeType === "contractor" && r.contractorId) return payeeLabel(r.contractorId, contractorList);
    return r.payeeName || "—";
  };

  const resetForm = () => {
    setPayeeType("supplier");
    setSupplierId("");
    setContractorId("");
    setPayeeName("");
    setAmount("");
    setPaymentDate(today());
    setPaymentMethod("cash");
    setCashboxId("");
    setBankAccountId("");
    setChequeNumber("");
    setChequeDate("");
    setBankName("");
    setReference("");
    setDescription("");
    setAllocations([]);
  };

  const handleCreate = () => {
    if (!companyId || !amount) return;
    const allocPayload = allocations
      .filter((a) => a.supplierInvoiceId && Number(a.amount) > 0)
      .map((a) => ({ supplierInvoiceId: a.supplierInvoiceId, amount: a.amount }));
    createMutation.mutate(
      {
        data: {
          companyId,
          payeeType,
          supplierId: payeeType === "supplier" ? supplierId || undefined : undefined,
          contractorId: payeeType === "contractor" ? contractorId || undefined : undefined,
          payeeName: payeeType === "other" ? payeeName || undefined : undefined,
          amount,
          paymentDate,
          paymentMethod,
          cashboxId: paymentMethod === "cash" ? cashboxId || undefined : undefined,
          bankAccountId: paymentMethod === "bank_transfer" ? bankAccountId || undefined : undefined,
          chequeNumber: paymentMethod === "cheque" ? chequeNumber || undefined : undefined,
          chequeDate: paymentMethod === "cheque" ? chequeDate || undefined : undefined,
          bankName: paymentMethod === "cheque" ? bankName || undefined : undefined,
          reference: reference || undefined,
          description: description || undefined,
          allocations: payeeType === "supplier" && allocPayload.length ? allocPayload : undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: t("common.created") });
          setIsOpen(false);
          resetForm();
          invalidate();
        },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );
  };

  const runAction = (
    mutation: { mutate: (v: { id: string }, o?: { onSuccess?: () => void; onError?: () => void }) => void },
    id: string,
    label: string,
  ) =>
    mutation.mutate(
      { id },
      {
        onSuccess: () => { toast({ title: label }); invalidate(); },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );

  const handleDelete = (id: string) => {
    if (!confirm(t("common.delete") + "?")) return;
    runAction(deleteMutation, id, t("common.deleted"));
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <h2 className="text-2xl font-bold tracking-tight">{t("nav.payment_vouchers")}</h2>
        <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("pv.new_voucher")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t("pv.new_voucher")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("pv.payee_type")} *</Label>
                  <Select value={payeeType} onValueChange={setPayeeType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYEE_TYPES.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{language === "ar" ? o.labelAr : o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {payeeType === "supplier" && (
                  <div className="space-y-2">
                    <Label>{t("inv.supplier")} *</Label>
                    <Select value={supplierId} onValueChange={setSupplierId}>
                      <SelectTrigger><SelectValue placeholder={t("inv.supplier")} /></SelectTrigger>
                      <SelectContent>
                        {supplierList.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.code} - {language === "ar" ? s.nameAr || s.name : s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {payeeType === "contractor" && (
                  <div className="space-y-2">
                    <Label>{t("pv.contractor")} *</Label>
                    <Select value={contractorId} onValueChange={setContractorId}>
                      <SelectTrigger><SelectValue placeholder={t("pv.contractor")} /></SelectTrigger>
                      <SelectContent>
                        {contractorList.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.code} - {language === "ar" ? c.nameAr || c.name : c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {payeeType === "other" && (
                  <div className="space-y-2">
                    <Label>{t("acc.payee_name")} *</Label>
                    <Input value={payeeName} onChange={(e) => setPayeeName(e.target.value)} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{t("acc.amount")} *</Label>
                  <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("pv.payment_date")} *</Label>
                  <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("pv.payment_method")} *</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{language === "ar" ? o.labelAr : o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {paymentMethod === "cash" && (
                  <div className="space-y-2">
                    <Label>{t("nav.cashboxes")}</Label>
                    <Select value={cashboxId || NONE} onValueChange={(v) => setCashboxId(v === NONE ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {(cashboxes?.data ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {paymentMethod === "bank_transfer" && (
                  <div className="space-y-2">
                    <Label>{t("nav.bank_accounts")}</Label>
                    <Select value={bankAccountId || NONE} onValueChange={(v) => setBankAccountId(v === NONE ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {(banks?.data ?? []).map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.code} - {b.bankName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {paymentMethod === "cheque" && (
                  <>
                    <div className="space-y-2">
                      <Label>{t("acc.cheque_number")}</Label>
                      <Input value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("acc.cheque_date")}</Label>
                      <Input type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("acc.bank_name")}</Label>
                      <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label>{t("acc.reference")}</Label>
                  <Input value={reference} onChange={(e) => setReference(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("acc.description")}</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </div>

              {payeeType === "supplier" && supplierId && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t("pv.allocations")}</Label>
                    <Button variant="outline" size="sm" onClick={() => setAllocations((p) => [...p, { supplierInvoiceId: "", amount: "" }])}>
                      <Plus className="mr-2 h-4 w-4" />
                      {t("pv.add_allocation")}
                    </Button>
                  </div>
                  {allocations.length > 0 && (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("nav.supplier_invoices")}</TableHead>
                            <TableHead className="w-28">{t("acc.amount")}</TableHead>
                            <TableHead className="w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allocations.map((a, i) => (
                            <TableRow key={i}>
                              <TableCell>
                                <Select value={a.supplierInvoiceId} onValueChange={(v) => setAllocations((prev) => prev.map((x, idx) => idx === i ? { ...x, supplierInvoiceId: v } : x))}>
                                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                                  <SelectContent>
                                    {openSupplierInvoices.map((inv) => (
                                      <SelectItem key={inv.id} value={inv.id}>{inv.number} ({inv.total})</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input type="number" step="0.01" value={a.amount} onChange={(e) => setAllocations((prev) => prev.map((x, idx) => idx === i ? { ...x, amount: e.target.value } : x))} />
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setAllocations((prev) => prev.filter((_, idx) => idx !== i))}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setIsOpen(false); resetForm(); }}>{t("common.cancel")}</Button>
                <Button disabled={!amount || createMutation.isPending} onClick={handleCreate}>{t("common.save")}</Button>
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
              <TableHead>{t("pv.payee")}</TableHead>
              <TableHead>{t("pv.payment_date")}</TableHead>
              <TableHead className="text-right">{t("acc.amount")}</TableHead>
              <TableHead>{t("pv.payment_method")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center h-24">{t("common.loading")}</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center h-24">{t("common.no_results")}</TableCell></TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.code}</TableCell>
                  <TableCell>{voucherPayee(r)}</TableCell>
                  <TableCell>{r.paymentDate}</TableCell>
                  <TableCell className="text-right">{r.amount}</TableCell>
                  <TableCell><Badge variant="outline">{enumLabel(r.paymentMethod, language)}</Badge></TableCell>
                  <TableCell><Badge variant={statusVariant(r.status)}>{enumLabel(r.status, language)}</Badge></TableCell>
                  <TableCell className="text-right space-x-2 whitespace-nowrap">
                    <DocumentsRowAction moduleKey="payment-vouchers" sourceId={r.id} />
                    {r.status === "draft" && (
                      <>
                        <Button variant="outline" size="sm" disabled={approveMutation.isPending} onClick={() => runAction(approveMutation, r.id, t("acc.approve"))}>{t("acc.approve")}</Button>
                        <Button variant="ghost" size="sm" disabled={cancelMutation.isPending} onClick={() => runAction(cancelMutation, r.id, t("acc.cancel"))}>{t("acc.cancel")}</Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4" /></Button>
                      </>
                    )}
                    {r.status === "approved" && (
                      <>
                        <Button variant="outline" size="sm" disabled={postMutation.isPending} onClick={() => runAction(postMutation, r.id, t("acc.post"))}>{t("acc.post")}</Button>
                        <Button variant="ghost" size="sm" disabled={cancelMutation.isPending} onClick={() => runAction(cancelMutation, r.id, t("acc.cancel"))}>{t("acc.cancel")}</Button>
                      </>
                    )}
                    {r.status === "posted" && (
                      <Button variant="ghost" size="sm" className="text-destructive" disabled={reverseMutation.isPending} onClick={() => runAction(reverseMutation, r.id, t("acc.reverse"))}>{t("acc.reverse")}</Button>
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
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>{"<"}</Button>
          <span className="text-sm">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>{">"}</Button>
        </div>
      </div>
    </div>
  );
}
