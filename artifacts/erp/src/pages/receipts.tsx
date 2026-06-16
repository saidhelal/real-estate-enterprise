import { useQueryClient } from "@tanstack/react-query";
import {
  useListReceipts,
  useCreateReceipt,
  useUpdateReceipt,
  useDeleteReceipt,
  useApproveReceipt,
  usePostReceipt,
  useReverseReceipt,
  useCancelReceipt,
  getListReceiptsQueryKey,
  useListCustomers,
  useListContracts,
  useListCashboxes,
  useListBankAccounts,
  useListCompanies,
  type Receipt,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";

const PAYMENT_METHODS = enumOptions(["cash", "bank_transfer", "cheque"]);

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "posted") return "default";
  if (status === "reversed" || status === "cancelled") return "destructive";
  if (status === "approved") return "secondary";
  return "outline";
}

export default function ReceiptsPage() {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: companies } = useListCompanies();
  const { data: customers } = useListCustomers({ pageSize: 200 });
  const { data: contracts } = useListContracts({ pageSize: 200 });
  const { data: cashboxes } = useListCashboxes({ pageSize: 200 });
  const { data: banks } = useListBankAccounts({ pageSize: 200 });
  const companyId = companies?.[0]?.id;
  const company = companies?.[0];

  const customerById = new Map((customers?.data ?? []).map((c) => [c.id, c]));

  const customerOptions = (customers?.data ?? []).map((c) => ({ value: c.id, label: `${c.code} - ${c.fullName}` }));
  const contractOptions = (contracts?.data ?? []).map((c) => ({ value: c.id, label: c.code }));
  const cashboxOptions = (cashboxes?.data ?? []).map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }));
  const bankOptions = (banks?.data ?? []).map((b) => ({ value: b.id, label: `${b.code} - ${b.bankName}` }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "customerId", label: "Customer", labelAr: "العميل", type: "select", required: true, options: customerOptions, createOnly: true },
    { name: "contractId", label: "Contract", labelAr: "العقد", type: "select", options: contractOptions, createOnly: true },
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money", required: true, createOnly: true },
    { name: "receiptDate", label: "Receipt Date", labelAr: "تاريخ السند", type: "date", required: true, createOnly: true },
    { name: "paymentMethod", label: "Payment Method", labelAr: "طريقة الدفع", type: "select", required: true, options: PAYMENT_METHODS, createOnly: true },
    { name: "cashboxId", label: "Cashbox (cash)", labelAr: "الخزينة (نقدي)", type: "select", options: cashboxOptions, createOnly: true },
    { name: "bankAccountId", label: "Bank Account (transfer)", labelAr: "الحساب البنكي (تحويل)", type: "select", options: bankOptions, createOnly: true },
    { name: "chequeNumber", label: "Cheque Number", labelAr: "رقم الشيك" },
    { name: "chequeDate", label: "Cheque Date", labelAr: "تاريخ الشيك", type: "date" },
    { name: "bankName", label: "Cheque Bank", labelAr: "بنك الشيك" },
    { name: "reference", label: "Reference", labelAr: "المرجع" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<Receipt>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Date", headerAr: "التاريخ", render: (r) => r.receiptDate },
    { header: "Amount", headerAr: "المبلغ", render: (r) => r.amount },
    { header: "Method", headerAr: "الطريقة", render: (r) => <Badge variant="outline">{enumLabel(r.paymentMethod, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant={statusVariant(r.status ?? "")}>{enumLabel(r.status ?? "", language)}</Badge> },
  ];

  const approveMutation = useApproveReceipt();
  const postMutation = usePostReceipt();
  const reverseMutation = useReverseReceipt();
  const cancelMutation = useCancelReceipt();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListReceiptsQueryKey() });

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

  const printVoucher = (r: Receipt) => {
    const ar = language === "ar";
    const esc = (v: unknown) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    const cust = r.customerId ? customerById.get(r.customerId) : undefined;
    const companyName = ar ? company?.nameAr ?? company?.name ?? "" : company?.name ?? "";
    const customerName = cust ? (ar ? cust.nameAr ?? cust.fullName : cust.fullName) : "-";
    const methodLabel = PAYMENT_METHODS.find((m) => m.value === r.paymentMethod)?.label ?? r.paymentMethod;
    const L = ar
      ? {
          title: "سند قبض", company: "الشركة", code: "الرقم", date: "التاريخ", customer: "العميل",
          amount: "المبلغ", method: "طريقة الدفع", reference: "المرجع", status: "الحالة",
          cheque: "رقم الشيك", signature: "التوقيع", print: "طباعة",
        }
      : {
          title: "Payment Voucher", company: "Company", code: "No.", date: "Date", customer: "Customer",
          amount: "Amount", method: "Payment Method", reference: "Reference", status: "Status",
          cheque: "Cheque No.", signature: "Signature", print: "Print",
        };
    const row = (label: string, value: string) =>
      `<tr><td class="label">${esc(label)}</td><td class="value">${esc(value)}</td></tr>`;
    const html = `<!doctype html><html dir="${ar ? "rtl" : "ltr"}" lang="${ar ? "ar" : "en"}"><head><meta charset="utf-8"><title>${L.title} ${esc(r.code)}</title>
      <style>
        * { font-family: ${ar ? "'Segoe UI', Tahoma, sans-serif" : "'Segoe UI', Arial, sans-serif"}; box-sizing: border-box; }
        body { margin: 0; padding: 40px; color: #1a1a1a; }
        .voucher { max-width: 640px; margin: 0 auto; border: 1px solid #ddd; border-radius: 12px; padding: 32px; }
        .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 24px; }
        .company { font-size: 20px; font-weight: 700; }
        .title { font-size: 22px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 10px 8px; border-bottom: 1px solid #eee; font-size: 15px; }
        td.label { color: #666; width: 40%; }
        td.value { font-weight: 600; text-align: ${ar ? "left" : "right"}; }
        .amount-box { margin-top: 24px; background: #f5f5f5; border-radius: 8px; padding: 16px; text-align: center; font-size: 22px; font-weight: 700; }
        .sign { margin-top: 56px; display: flex; justify-content: space-between; }
        .sign div { border-top: 1px solid #999; padding-top: 8px; width: 200px; text-align: center; color: #666; }
        @media print { body { padding: 0; } .voucher { border: none; } }
      </style></head><body>
      <div class="voucher">
        <div class="head"><div class="company">${esc(companyName)}</div><div class="title">${L.title}</div></div>
        <table>
          ${row(L.code, r.code)}
          ${row(L.date, r.receiptDate)}
          ${row(L.customer, customerName)}
          ${row(L.method, methodLabel)}
          ${r.chequeNumber ? row(L.cheque, r.chequeNumber) : ""}
          ${r.reference ? row(L.reference, r.reference) : ""}
          ${row(L.status, r.status ?? "-")}
        </table>
        <div class="amount-box">${L.amount}: ${esc(r.amount ?? "0")}</div>
        <div class="sign"><div>${L.signature}</div><div>${esc(companyName)}</div></div>
      </div>
      <script>window.onload = function(){ window.print(); }</script>
      </body></html>`;
    const w = window.open("", "_blank", "width=760,height=900");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <ResourceManager
      title="Receipts"
      titleAr="سندات القبض"
      columns={columns}
      fields={fields}
      useList={useListReceipts}
      useCreate={useCreateReceipt}
      useUpdate={useUpdateReceipt}
      useDelete={useDeleteReceipt}
      getListQueryKey={getListReceiptsQueryKey}
      companyId={companyId}
      canEdit={(r) => r.status === "draft"}
      canDelete={(r) => r.status === "draft"}
      rowActions={(r) => (
        <>
          {r.status === "draft" && (
            <>
              <Button variant="outline" size="sm" disabled={approveMutation.isPending} onClick={() => runAction(approveMutation, r.id, t("acc.approve"))}>{t("acc.approve")}</Button>
              <Button variant="ghost" size="sm" disabled={cancelMutation.isPending} onClick={() => runAction(cancelMutation, r.id, t("acc.cancel"))}>{t("acc.cancel")}</Button>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => printVoucher(r)}
            title={language === "ar" ? "طباعة السند" : "Print voucher"}
          >
            <Printer className="h-4 w-4 mr-1" />
            {language === "ar" ? "طباعة" : "Print"}
          </Button>
        </>
      )}
    />
  );
}
