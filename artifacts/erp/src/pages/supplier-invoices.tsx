import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSupplierInvoices,
  useCreateSupplierInvoice,
  useDeleteSupplierInvoice,
  usePostSupplierInvoice,
  useReverseSupplierInvoice,
  useCancelSupplierInvoice,
  getListSupplierInvoicesQueryKey,
  useListSuppliers,
  useListCompanies,
  useListTaxCodes,
  useListAccounts,
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
  description: string;
  quantity: string;
  unitPrice: string;
  taxCodeId: string;
  expenseAccountId: string;
}

const emptyLine = (): LineDraft => ({ description: "", quantity: "1", unitPrice: "", taxCodeId: "", expenseAccountId: "" });
const today = () => new Date().toISOString().slice(0, 10);
const NONE = "__none__";

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "posted" || status === "paid") return "default";
  if (status === "reversed" || status === "cancelled") return "destructive";
  if (status === "partially_paid") return "secondary";
  return "outline";
}

export default function SupplierInvoicesPage() {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: suppliers } = useListSuppliers({ pageSize: 200 });
  const { data: taxCodes } = useListTaxCodes({ pageSize: 200 });
  const { data: accounts } = useListAccounts({ pageSize: 500 });

  const supplierList = suppliers?.data ?? [];
  const taxCodeList = taxCodes?.data ?? [];
  const accountList = (accounts?.data ?? []).filter((a) => a.isPostable);

  const [page, setPage] = useState(1);
  const pageSize = 10;
  const { data, isLoading } = useListSupplierInvoices({ page, pageSize });
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const createMutation = useCreateSupplierInvoice();
  const deleteMutation = useDeleteSupplierInvoice();
  const postMutation = usePostSupplierInvoice();
  const reverseMutation = useReverseSupplierInvoice();
  const cancelMutation = useCancelSupplierInvoice();

  const [isOpen, setIsOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [dueDate, setDueDate] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListSupplierInvoicesQueryKey() });

  const supplierName = (id: string) => {
    const s = supplierList.find((x) => x.id === id);
    return s ? `${s.code} - ${language === "ar" ? s.nameAr || s.name : s.name}` : id;
  };
  const taxRate = (id: string) => Number(taxCodeList.find((x) => x.id === id)?.rate ?? 0);

  const lineSubtotal = (l: LineDraft) => (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
  const lineTax = (l: LineDraft) => (lineSubtotal(l) * taxRate(l.taxCodeId)) / 100;
  const subtotal = lines.reduce((s, l) => s + lineSubtotal(l), 0);
  const taxTotal = lines.reduce((s, l) => s + lineTax(l), 0);
  const grandTotal = subtotal + taxTotal;

  const setLine = (i: number, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const resetForm = () => {
    setSupplierId("");
    setSupplierInvoiceNumber("");
    setInvoiceDate(today());
    setDueDate("");
    setReference("");
    setDescription("");
    setLines([emptyLine()]);
  };

  const handleCreate = () => {
    if (!companyId || !supplierId) return;
    const payloadLines = lines
      .filter((l) => l.description && Number(l.unitPrice) >= 0)
      .map((l) => ({
        description: l.description,
        quantity: l.quantity || "1",
        unitPrice: l.unitPrice || "0",
        taxCodeId: l.taxCodeId || undefined,
        expenseAccountId: l.expenseAccountId || undefined,
      }));
    if (payloadLines.length === 0) {
      toast({ title: t("inv.no_lines"), variant: "destructive" });
      return;
    }
    createMutation.mutate(
      {
        data: {
          companyId,
          supplierId,
          supplierInvoiceNumber: supplierInvoiceNumber || undefined,
          invoiceDate,
          dueDate: dueDate || undefined,
          reference: reference || undefined,
          description: description || undefined,
          lines: payloadLines,
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
        onSuccess: () => {
          toast({ title: label });
          invalidate();
        },
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
        <h2 className="text-2xl font-bold tracking-tight">{t("nav.supplier_invoices")}</h2>
        <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("inv.new_supplier_invoice")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{t("inv.new_supplier_invoice")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("inv.supplier")} *</Label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger><SelectValue placeholder={t("inv.supplier")} /></SelectTrigger>
                    <SelectContent>
                      {supplierList.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.code} - {language === "ar" ? s.nameAr || s.name : s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("inv.supplier_invoice_number")}</Label>
                  <Input value={supplierInvoiceNumber} onChange={(e) => setSupplierInvoiceNumber(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("inv.invoice_date")} *</Label>
                  <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("acc.due_date")}</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
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
                <Label>{t("inv.lines")}</Label>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-40">{t("inv.line_description")}</TableHead>
                        <TableHead className="w-20">{t("inv.qty")}</TableHead>
                        <TableHead className="w-24">{t("inv.unit_price")}</TableHead>
                        <TableHead className="w-32">{t("tax.code")}</TableHead>
                        <TableHead className="w-36">{t("inv.expense_account")}</TableHead>
                        <TableHead className="w-24 text-right">{t("inv.line_total")}</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((line, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            <Input value={line.description} onChange={(e) => setLine(i, { description: e.target.value })} />
                          </TableCell>
                          <TableCell>
                            <Input type="number" step="0.01" value={line.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
                          </TableCell>
                          <TableCell>
                            <Input type="number" step="0.01" value={line.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} />
                          </TableCell>
                          <TableCell>
                            <Select value={line.taxCodeId || NONE} onValueChange={(v) => setLine(i, { taxCodeId: v === NONE ? "" : v })}>
                              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NONE}>—</SelectItem>
                                {taxCodeList.map((tc) => (
                                  <SelectItem key={tc.id} value={tc.id}>{tc.code} ({tc.rate}%)</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select value={line.expenseAccountId || NONE} onValueChange={(v) => setLine(i, { expenseAccountId: v === NONE ? "" : v })}>
                              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NONE}>—</SelectItem>
                                {accountList.map((a) => (
                                  <SelectItem key={a.id} value={a.id}>{a.code} - {language === "ar" ? a.nameAr : a.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">{(lineSubtotal(line) + lineTax(line)).toFixed(2)}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="text-destructive" disabled={lines.length <= 1} onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}>
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
                  {t("inv.add_line")}
                </Button>
              </div>

              <div className="flex items-center justify-end gap-6 rounded-md bg-muted px-4 py-2 text-sm">
                <span>{t("inv.subtotal")}: <strong>{subtotal.toFixed(2)}</strong></span>
                <span>{t("inv.tax_total")}: <strong>{taxTotal.toFixed(2)}</strong></span>
                <span>{t("common.total")}: <strong>{grandTotal.toFixed(2)}</strong></span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setIsOpen(false); resetForm(); }}>{t("common.cancel")}</Button>
                <Button disabled={!supplierId || createMutation.isPending} onClick={handleCreate}>{t("common.save")}</Button>
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
              <TableHead>{t("inv.supplier")}</TableHead>
              <TableHead>{t("inv.invoice_date")}</TableHead>
              <TableHead className="text-right">{t("common.total")}</TableHead>
              <TableHead className="text-right">{t("inv.paid")}</TableHead>
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
                  <TableCell className="font-medium">{r.number}</TableCell>
                  <TableCell>{supplierName(r.supplierId)}</TableCell>
                  <TableCell>{r.invoiceDate}</TableCell>
                  <TableCell className="text-right">{r.total}</TableCell>
                  <TableCell className="text-right">{r.paidAmount}</TableCell>
                  <TableCell><Badge variant={statusVariant(r.status)}>{enumLabel(r.status, language)}</Badge></TableCell>
                  <TableCell className="text-right space-x-2 whitespace-nowrap">
                    {r.status === "draft" && (
                      <>
                        <Button variant="outline" size="sm" disabled={postMutation.isPending} onClick={() => runAction(postMutation, r.id, t("acc.post"))}>{t("acc.post")}</Button>
                        <Button variant="ghost" size="sm" disabled={cancelMutation.isPending} onClick={() => runAction(cancelMutation, r.id, t("acc.cancel"))}>{t("acc.cancel")}</Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4" /></Button>
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
