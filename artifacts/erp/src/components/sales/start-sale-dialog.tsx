import { useMemo, useState } from "react";
import {
  useListCustomers,
  useListCompanies,
  useCreateReservation,
  useConvertReservation,
  useCreateInstallmentPlan,
  useCreateInstallmentSchedule,
  useCreateCheque,
  getListUnitsQueryKey,
  getListContractsQueryKey,
  getListReservationsQueryKey,
  getListChequesQueryKey,
  getListChequeStatusHistorysQueryKey,
  type Unit,
  type Contract,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";
import {
  buildSchedule,
  frequencyLabel,
  type Frequency,
  type ScheduleRow,
} from "@/lib/sale-workflow";
import { enumLabel } from "@/lib/enums";
import { ChequeLifecyclePanel } from "@/components/sales/cheque-lifecycle-panel";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

type PaymentMethod = "cash" | "installments" | "cash_installments";

const today = () => new Date().toISOString().slice(0, 10);

export function StartSaleDialog({
  unit,
  open,
  onOpenChange,
  onStarted,
}: {
  unit: Unit | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onStarted?: () => void;
}) {
  const { language, t } = useLanguage();
  const ar = language === "ar";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: customers } = useListCustomers({ pageSize: 200 });

  const createReservation = useCreateReservation();
  const convertReservation = useConvertReservation();
  const createPlan = useCreateInstallmentPlan();
  const createSchedule = useCreateInstallmentSchedule();
  const createCheque = useCreateCheque();

  const [customerId, setCustomerId] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [totalPrice, setTotalPrice] = useState("");
  const [discount, setDiscount] = useState("0");
  const [downPayment, setDownPayment] = useState("0");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [count, setCount] = useState("12");
  const [startDate, setStartDate] = useState(today());
  const [cheques, setCheques] = useState<Record<number, { chequeNumber: string; bankName: string }>>({});
  const [busy, setBusy] = useState(false);

  // After a successful sale, keep the dialog open and switch to a cheque
  // management view for the created contract so the sales user can change
  // status, replace, and view history without leaving the screen.
  const [createdContract, setCreatedContract] = useState<Contract | null>(null);

  // Initialise the price from the unit when the dialog opens for a new unit.
  const [pricedUnitId, setPricedUnitId] = useState<string | null>(null);
  if (unit && unit.id !== pricedUnitId) {
    setPricedUnitId(unit.id);
    setTotalPrice(unit.totalPrice != null ? String(unit.totalPrice) : "");
    setCustomerId("");
    setDiscount("0");
    setDownPayment("0");
    setMethod("cash");
    setFrequency("monthly");
    setCount("12");
    setStartDate(today());
    setCheques({});
    setCreatedContract(null);
  }

  const net = Math.max(0, (parseFloat(totalPrice) || 0) - (parseFloat(discount) || 0));
  const down = Math.max(0, parseFloat(downPayment) || 0);
  const financed = Math.max(0, net - down);
  const usesInstallments = method === "installments" || method === "cash_installments";

  const schedule: ScheduleRow[] = useMemo(() => {
    if (!usesInstallments) return [];
    return buildSchedule(financed, Math.max(1, parseInt(count) || 0), frequency, startDate);
  }, [usesInstallments, financed, count, frequency, startDate]);

  const customerName = (id: string) => customers?.data.find((c) => c.id === id)?.fullName ?? "";

  const canSubmit = !!companyId && !!unit && !!customerId && net > 0 && !busy && (!usesInstallments || schedule.length > 0);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getListUnitsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListUnitsQueryKey({ pageSize: 200 }) });
    queryClient.invalidateQueries({ queryKey: getListContractsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListReservationsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListChequesQueryKey({ pageSize: 200 }) });
    queryClient.invalidateQueries({ queryKey: getListChequeStatusHistorysQueryKey({ pageSize: 200 }) });
  };

  const submit = async () => {
    if (!companyId || !unit || !customerId) return;
    setBusy(true);
    try {
      // 1) Reserve the unit (locks it immediately as Pending Sale).
      const reservation = await createReservation.mutateAsync({
        data: {
          companyId,
          unitId: unit.id,
          customerId,
          reservationDate: today(),
          amount: net.toFixed(2),
          status: "active",
        },
      });
      // 2) Convert the reservation into a draft contract (auto-numbered),
      //    recording the chosen payment method as the draft is created. The
      //    payment method is set here (not via a later PATCH) because a direct
      //    PATCH on a contract is parked as a governance approval request and
      //    would not take effect immediately.
      const contract = await convertReservation.mutateAsync({
        id: reservation.id,
        data: {
          contractDate: today(),
          totalPrice: net.toFixed(2),
          downPayment: down.toFixed(2),
          paymentMethod: method,
        },
      });

      // 3) Installments: create the plan, every schedule row, and any cheques.
      if (usesInstallments && schedule.length > 0) {
        const plan = await createPlan.mutateAsync({
          data: {
            companyId,
            contractId: contract.id,
            totalAmount: net.toFixed(2),
            downPayment: down.toFixed(2),
            numberOfInstallments: schedule.length,
            frequency,
            startDate,
            status: "active",
          },
        });
        for (const row of schedule) {
          const created = await createSchedule.mutateAsync({
            data: {
              companyId,
              planId: plan.id,
              installmentNumber: row.installmentNumber,
              dueDate: row.dueDate,
              amount: row.amount,
              status: "pending",
            },
          });
          const chq = cheques[row.installmentNumber];
          if (chq?.chequeNumber?.trim()) {
            await createCheque.mutateAsync({
              data: {
                companyId,
                direction: "incoming",
                chequeNumber: chq.chequeNumber.trim(),
                dueDate: row.dueDate,
                amount: row.amount,
                bankName: chq.bankName?.trim() || undefined,
                customerId,
                contractId: contract.id,
                unitId: unit.id,
                scheduleId: created.id,
                status: "received",
              },
            });
          }
        }
      }

      refresh();
      toast({ title: ar ? `بدأ البيع — ${contract.code}` : `Sale started — ${contract.code}` });
      setCreatedContract(contract);
      onStarted?.();
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {createdContract
              ? (ar ? "إدارة شيكات العقد" : "Manage Contract Cheques")
              : (ar ? "بدء البيع" : "Start Sale")}
            {createdContract ? ` — ${createdContract.code}` : unit ? ` — ${unit.code}` : ""}
          </DialogTitle>
        </DialogHeader>

        {createdContract ? (
          <>
            <div className="rounded-md border border-success-border/40 bg-success-subtle p-2 text-sm text-success-subtle-foreground">
              {ar
                ? "تم بدء البيع. يمكنك الآن إدارة حالة الشيكات: تغيير الحالة، الاستبدال، وعرض السجل."
                : "Sale started. You can now manage cheque status: change status, replace, and view history."}
            </div>
            <ChequeLifecyclePanel
              contractId={createdContract.id}
              companyId={companyId}
              customerId={createdContract.customerId}
              unitId={createdContract.unitId}
              canAdd
            />
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>{ar ? "تم" : "Done"}</Button>
            </DialogFooter>
          </>
        ) : (
        <div className="space-y-4">
          {/* Customer */}
          <div className="space-y-1.5">
            <Label>{ar ? "العميل" : "Customer"}</Label>
            <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {customerId ? customerName(customerId) : ar ? "اختر العميل" : "Select customer"}
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder={ar ? "بحث..." : "Search..."} />
                  <CommandList>
                    <CommandEmpty>{ar ? "لا يوجد عملاء" : "No customers"}</CommandEmpty>
                    <CommandGroup>
                      {(customers?.data ?? []).map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${c.fullName} ${c.code}`}
                          onSelect={() => { setCustomerId(c.id); setCustomerOpen(false); }}
                        >
                          <Check className={`h-4 w-4 ${customerId === c.id ? "opacity-100" : "opacity-0"}`} />
                          <span>{c.fullName}</span>
                          <span className="ms-auto text-xs text-muted-foreground">{c.code}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Price / discount */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{ar ? "السعر الإجمالي" : "Total Price"}</Label>
              <Input inputMode="decimal" value={totalPrice} onChange={(e) => setTotalPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{ar ? "الخصم" : "Discount"}</Label>
              <Input inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {ar ? "الصافي" : "Net"}: <span className="font-medium text-foreground">{net.toFixed(2)}</span>
          </div>

          {/* Payment method */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{ar ? "طريقة الدفع" : "Payment Method"}</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{ar ? "نقدي" : "Cash"}</SelectItem>
                  <SelectItem value="installments">{ar ? "أقساط" : "Installments"}</SelectItem>
                  <SelectItem value="cash_installments">{ar ? "نقدي + أقساط" : "Cash + Installments"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{ar ? "الدفعة المقدمة" : "Down Payment"}</Label>
              <Input inputMode="decimal" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} />
            </div>
          </div>

          {/* Installments config */}
          {usesInstallments ? (
            <div className="space-y-3 rounded-md border p-3">
              {/* Three selects side by side leave no room for their labels on a
                  phone, so they stack until there is width for them. */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>{ar ? "التكرار" : "Frequency"}</Label>
                  <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["monthly", "quarterly", "semi_annual", "annual", "custom"] as Frequency[]).map((f) => (
                        <SelectItem key={f} value={f}>{frequencyLabel(f, ar)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{ar ? "عدد الأقساط" : "No. of Installments"}</Label>
                  <Input inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>{ar ? "تاريخ البداية" : "Start Date"}</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
              </div>

              {schedule.length > 0 ? (
                <div className="max-h-64 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>{ar ? "الاستحقاق" : "Due"}</TableHead>
                        <TableHead>{ar ? "المبلغ" : "Amount"}</TableHead>
                        <TableHead>{ar ? "رقم الشيك" : "Cheque No."}</TableHead>
                        <TableHead>{ar ? "البنك" : "Bank"}</TableHead>
                        <TableHead>{ar ? "حالة الشيك" : "Cheque Status"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {schedule.map((row) => (
                        <TableRow key={row.installmentNumber}>
                          <TableCell>{row.installmentNumber}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.dueDate}</TableCell>
                          <TableCell>{row.amount}</TableCell>
                          <TableCell>
                            <Input
                              className="h-8"
                              value={cheques[row.installmentNumber]?.chequeNumber ?? ""}
                              onChange={(e) =>
                                setCheques((prev) => ({
                                  ...prev,
                                  [row.installmentNumber]: {
                                    chequeNumber: e.target.value,
                                    bankName: prev[row.installmentNumber]?.bankName ?? "",
                                  },
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8"
                              value={cheques[row.installmentNumber]?.bankName ?? ""}
                              onChange={(e) =>
                                setCheques((prev) => ({
                                  ...prev,
                                  [row.installmentNumber]: {
                                    chequeNumber: prev[row.installmentNumber]?.chequeNumber ?? "",
                                    bankName: e.target.value,
                                  },
                                }))
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{enumLabel("received", language)}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {ar
                  ? "تُسجَّل الشيكات المُدخلة تلقائياً وتظهر لدى المالية لتأكيد الاستلام."
                  : "Entered cheques are registered automatically and appear in Finance for receipt confirmation."}
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button onClick={submit} disabled={!canSubmit}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
              {ar ? "بدء البيع" : "Start Sale"}
            </Button>
          </DialogFooter>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
