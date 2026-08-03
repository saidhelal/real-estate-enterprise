import {
  useListPenalties,
  useCreatePenalty,
  useUpdatePenalty,
  useDeletePenalty,
  getListPenaltiesQueryKey,
  useCalculatePenalties,
  useListCompanies,
  type Penalty,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calculator, Printer } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";

export default function PenaltiesPage() {
  const STATUS = enumOptions(["pending", "paid", "waived"]);
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const calculate = useCalculatePenalties();
  const { data: allPenalties } = useListPenalties({ pageSize: 1000 });

  const fields: ResourceField[] = [
    { name: "amount", label: "Amount", labelAr: "المبلغ", type: "money" },
    { name: "daysOverdue", label: "Days Overdue", labelAr: "أيام التأخير", type: "number" },
    { name: "assessedDate", label: "Assessed Date", labelAr: "تاريخ التقييم", type: "date", required: true },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", required: true, options: STATUS },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<Penalty>[] = [
    { header: "Assessed Date", headerAr: "تاريخ التقييم", render: (r) => r.assessedDate },
    { header: "Amount", headerAr: "المبلغ", render: (r) => r.amount },
    { header: "Days Overdue", headerAr: "أيام التأخير", render: (r) => r.daysOverdue },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  const handleCalculate = () => {
    calculate.mutate(
      { data: companyId ? { companyId } : {} },
      {
        onSuccess: (res) => {
          toast({
            title: language === "ar" ? "تم احتساب الغرامات" : "Penalties calculated",
            description:
              language === "ar"
                ? `${res.created} غرامة بإجمالي ${res.totalAmount ?? "0"}`
                : `${res.created} created, total ${res.totalAmount ?? "0"}`,
          });
          queryClient.invalidateQueries({ queryKey: getListPenaltiesQueryKey() });
        },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );
  };

  const printReport = () => {
    const ar = language === "ar";
    const esc = (v: unknown) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    const rows = allPenalties?.data ?? [];
    const companyName = ar ? companies?.[0]?.nameAr ?? companies?.[0]?.name ?? "" : companies?.[0]?.name ?? "";
    const total = rows.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
    const L = ar
      ? { title: "تقرير الغرامات", company: "الشركة", date: "التاريخ", days: "أيام التأخير", amount: "المبلغ", status: "الحالة", total: "الإجمالي", count: "عدد الغرامات", generated: "تاريخ الإصدار" }
      : { title: "Penalty Report", company: "Company", date: "Assessed Date", days: "Days Overdue", amount: "Amount", status: "Status", total: "Total", count: "Penalties", generated: "Generated" };
    const body = rows
      .map(
        (p) =>
          `<tr><td>${esc(p.assessedDate)}</td><td>${esc(p.daysOverdue ?? "-")}</td><td class="num">${esc(p.amount ?? "0")}</td><td>${esc(p.status ?? "-")}</td></tr>`,
      )
      .join("");
    const html = `<!doctype html><html dir="${ar ? "rtl" : "ltr"}" lang="${ar ? "ar" : "en"}"><head><meta charset="utf-8"><title>${L.title}</title>
      <style>
        * { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; box-sizing: border-box; }
        body { margin: 0; padding: 40px; color: #1a1a1a; }
        .head { border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 24px; display:flex; justify-content:space-between; align-items:flex-end; }
        .company { font-size: 20px; font-weight: 700; }
        .title { font-size: 22px; font-weight: 700; }
        .meta { color:#666; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px 8px; border-bottom: 1px solid #eee; font-size: 14px; text-align: ${ar ? "right" : "left"}; }
        th { background:#f5f5f5; font-weight:700; }
        td.num, th.num { text-align: ${ar ? "left" : "right"}; }
        .summary { margin-top: 24px; display:flex; gap:32px; font-size:16px; font-weight:700; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <div class="head"><div><div class="company">${esc(companyName)}</div><div class="meta">${L.generated}: ${new Date().toISOString().slice(0, 10)}</div></div><div class="title">${L.title}</div></div>
      <table>
        <thead><tr><th>${L.date}</th><th>${L.days}</th><th class="num">${L.amount}</th><th>${L.status}</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      <div class="summary"><div>${L.count}: ${rows.length}</div><div>${L.total}: ${total.toFixed(2)}</div></div>
      <script>window.onload = function(){ window.print(); }</script>
      </body></html>`;
    const w = window.open("", "_blank", "width=860,height=900");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={printReport}>
          <Printer className="mr-2 h-4 w-4" />
          {language === "ar" ? "تقرير الغرامات" : "Penalty Report"}
        </Button>
        <Button variant="outline" onClick={handleCalculate} disabled={calculate.isPending}>
          <Calculator className="mr-2 h-4 w-4" />
          {language === "ar" ? "احتساب الغرامات" : "Calculate Penalties"}
        </Button>
      </div>
      <ResourceManager
        title="Penalties"
        titleAr="الغرامات"
        columns={columns}
        fields={fields}
        useList={useListPenalties}
        useCreate={useCreatePenalty}
        useUpdate={useUpdatePenalty}
        useDelete={useDeletePenalty}
        getListQueryKey={getListPenaltiesQueryKey}
        companyId={companyId}
        searchable={false}
        canCreate={false}
      />
    </div>
  );
}
