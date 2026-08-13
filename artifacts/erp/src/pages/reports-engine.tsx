import { useMemo, useState } from "react";
import {
  useGetExecutiveDashboard,
  getGetExecutiveDashboardQueryKey,
  useGetSalesAnalytics,
  getGetSalesAnalyticsQueryKey,
  useGetCollectionAnalytics,
  getGetCollectionAnalyticsQueryKey,
  useGetConstructionAnalytics,
  getGetConstructionAnalyticsQueryKey,
  useGetProcurementAnalytics,
  getGetProcurementAnalyticsQueryKey,
  useGetInventoryAnalytics,
  getGetInventoryAnalyticsQueryKey,
  useGetHrAnalytics,
  getGetHrAnalyticsQueryKey,
  useGetFinancialAnalytics,
  getGetFinancialAnalyticsQueryKey,
  useListCompanies,
  useListProjects,
  useListBranches,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, FileSpreadsheet, Printer } from "lucide-react";
import { useLanguage } from "@/lib/language-provider";

type ReportType =
  | "executive"
  | "sales"
  | "collection"
  | "construction"
  | "procurement"
  | "inventory"
  | "hr"
  | "financial";

interface KeyValue {
  label: string;
  value: string;
}

interface ReportTable {
  columns: string[];
  rows: string[][];
}

interface ReportModel {
  title: string;
  kpis: KeyValue[];
  table: ReportTable;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function csvCell(value: unknown): string {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export default function ReportsEnginePage() {
  const { t, language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const [reportType, setReportType] = useState<ReportType>("executive");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("all");
  const [branchId, setBranchId] = useState<string>("all");

  const { data: projectsData } = useListProjects({ companyId });
  const { data: branchesData } = useListBranches({ companyId });

  const projects = projectsData?.data ?? [];
  const branches = branchesData ?? [];

  const params = {
    companyId,
    from: from || undefined,
    to: to || undefined,
    projectId: projectId !== "all" ? projectId : undefined,
    branchId: branchId !== "all" ? branchId : undefined,
  };

  const executive = useGetExecutiveDashboard(params, {
    query: { enabled: !!companyId && reportType === "executive", queryKey: getGetExecutiveDashboardQueryKey(params) },
  });
  const sales = useGetSalesAnalytics(params, {
    query: { enabled: !!companyId && reportType === "sales", queryKey: getGetSalesAnalyticsQueryKey(params) },
  });
  const collection = useGetCollectionAnalytics(params, {
    query: { enabled: !!companyId && reportType === "collection", queryKey: getGetCollectionAnalyticsQueryKey(params) },
  });
  const construction = useGetConstructionAnalytics(params, {
    query: { enabled: !!companyId && reportType === "construction", queryKey: getGetConstructionAnalyticsQueryKey(params) },
  });
  const procurement = useGetProcurementAnalytics(params, {
    query: { enabled: !!companyId && reportType === "procurement", queryKey: getGetProcurementAnalyticsQueryKey(params) },
  });
  const inventory = useGetInventoryAnalytics(params, {
    query: { enabled: !!companyId && reportType === "inventory", queryKey: getGetInventoryAnalyticsQueryKey(params) },
  });
  const hr = useGetHrAnalytics(params, {
    query: { enabled: !!companyId && reportType === "hr", queryKey: getGetHrAnalyticsQueryKey(params) },
  });
  const financial = useGetFinancialAnalytics(params, {
    query: { enabled: !!companyId && reportType === "financial", queryKey: getGetFinancialAnalyticsQueryKey(params) },
  });

  const kv = (label: string, value: unknown): KeyValue => ({ label, value: String(value ?? "0") });
  const groupRows = (
    rows: { key: string; label?: string | null; value: string; count?: number }[] | undefined,
  ): string[][] =>
    (rows ?? []).map((r) => [String(r.label ?? r.key), String(r.value ?? "0"), String(r.count ?? "")]);

  const model: ReportModel = useMemo(() => {
    switch (reportType) {
      case "sales": {
        const d = sales.data;
        return {
          title: t("bi.sales_analytics"),
          kpis: [
            kv(t("bi.total_contracts"), d?.totalContracts),
            kv(t("bi.total_contract_value"), d?.totalContractValue),
            kv(t("bi.total_down_payments"), d?.totalDownPayments),
            kv(t("bi.avg_contract_value"), d?.avgContractValue),
            kv(t("bi.reservations_count"), d?.reservationsCount),
            kv(t("bi.reservations_value"), d?.reservationsValue),
            kv(t("bi.leads_count"), d?.leadsCount),
          ],
          table: {
            columns: [t("bi.col_name"), t("bi.col_value"), t("bi.col_count")],
            rows: groupRows(d?.salesByProject),
          },
        };
      }
      case "collection": {
        const d = collection.data;
        return {
          title: t("bi.collection_analytics"),
          kpis: [
            kv(t("bi.total_due"), d?.totalDue),
            kv(t("bi.total_paid"), d?.totalPaid),
            kv(t("bi.total_outstanding"), d?.totalOutstanding),
            kv(t("bi.overdue_amount"), d?.overdueAmount),
            kv(t("bi.overdue_count"), d?.overdueCount),
            kv(t("bi.collection_rate"), d?.collectionRate),
          ],
          table: {
            columns: [t("bi.col_name"), t("bi.col_value"), t("bi.col_count")],
            rows: groupRows(d?.installmentsByStatus),
          },
        };
      }
      case "construction": {
        const d = construction.data;
        return {
          title: t("bi.construction_analytics"),
          kpis: [
            kv(t("bi.contractor_contracts"), d?.contractorContracts),
            kv(t("bi.total_contract_value"), d?.totalContractValue),
            kv(t("bi.avg_progress"), d?.avgProgress),
            kv(t("bi.payment_certificates_value"), d?.paymentCertificatesValue),
          ],
          table: {
            columns: [t("bi.col_name"), t("bi.col_value")],
            rows: (d?.progressByProject ?? []).map((r) => [String(r.label ?? r.key), String(r.value ?? "0")]),
          },
        };
      }
      case "procurement": {
        const d = procurement.data;
        return {
          title: t("bi.procurement_analytics"),
          kpis: [
            kv(t("bi.purchase_orders"), d?.purchaseOrders),
            kv(t("bi.total_po_value"), d?.totalPoValue),
            kv(t("bi.avg_supplier_rating"), d?.avgSupplierRating),
            kv(t("bi.suppliers_count"), d?.suppliersCount),
          ],
          table: {
            columns: [t("bi.col_name"), t("bi.col_value"), t("bi.col_count")],
            rows: groupRows(d?.topSuppliers),
          },
        };
      }
      case "inventory": {
        const d = inventory.data;
        return {
          title: t("bi.inventory_analytics"),
          kpis: [
            kv(t("bi.total_items"), d?.totalItems),
            kv(t("bi.low_stock_count"), d?.lowStockCount),
            kv(t("bi.out_of_stock_count"), d?.outOfStockCount),
            kv(t("bi.total_stock_value"), d?.totalStockValue),
          ],
          table: {
            columns: [t("bi.col_name"), t("bi.col_value")],
            rows: (d?.valueByItem ?? []).map((r) => [String(r.label ?? r.key), String(r.value ?? "0")]),
          },
        };
      }
      case "hr": {
        const d = hr.data;
        return {
          title: t("bi.hr_analytics"),
          kpis: [
            kv(t("bi.employee_count"), d?.employeeCount),
            kv(t("bi.active_employees"), d?.activeEmployees),
            kv(t("bi.departments_count"), d?.departmentsCount),
            kv(t("bi.total_payroll"), d?.totalPayroll),
            kv(t("bi.avg_salary"), d?.avgSalary),
          ],
          table: {
            columns: [t("bi.col_name"), t("bi.col_value"), t("bi.col_count")],
            rows: groupRows(d?.headcountByDepartment),
          },
        };
      }
      case "financial": {
        const d = financial.data;
        return {
          title: t("bi.financial_analytics"),
          kpis: [
            kv(t("bi.cash_balance"), d?.cashBalance),
            kv(t("bi.bank_balance"), d?.bankBalance),
            kv(t("bi.total_revenue"), d?.totalRevenue),
            kv(t("bi.total_expenses"), d?.totalExpenses),
            kv(t("bi.net_income"), d?.netIncome),
            kv(t("bi.ar_outstanding"), d?.arOutstanding),
            kv(t("bi.ap_outstanding"), d?.apOutstanding),
          ],
          table: {
            columns: [t("bi.col_name"), t("bi.col_value")],
            rows: (d?.accountTypeBreakdown ?? []).map((r) => [String(r.key), String(r.value ?? "0")]),
          },
        };
      }
      case "executive":
      default: {
        const d = executive.data;
        return {
          title: t("bi.executive_dashboard"),
          kpis: [
            kv(t("bi.total_sales_value"), d?.totalSalesValue),
            kv(t("bi.total_collected"), d?.totalCollected),
            kv(t("bi.total_outstanding"), d?.totalOutstanding),
            kv(t("bi.units_sold"), d?.unitsSold),
            kv(t("bi.units_available"), d?.unitsAvailable),
            kv(t("bi.units_reserved"), d?.unitsReserved),
            kv(t("bi.active_projects"), d?.activeProjects),
            kv(t("bi.active_contracts"), d?.activeContracts),
            kv(t("bi.cash_on_hand"), d?.cashOnHand),
            kv(t("bi.bank_balance"), d?.bankBalance),
            kv(t("bi.employee_count"), d?.employeeCount),
          ],
          table: {
            columns: [t("bi.col_name"), t("bi.col_value")],
            rows: (d?.unitStatusBreakdown ?? []).map((r) => [String(r.key), String(r.value ?? "0")]),
          },
        };
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, executive.data, sales.data, collection.data, construction.data, procurement.data, inventory.data, hr.data, financial.data, t]);

  const companyName = companies?.[0]?.name ?? "";
  const generatedAt = new Date().toISOString().slice(0, 10);

  const handleExportPdf = () => {
    const ar = language === "ar";
    const dir = ar ? "rtl" : "ltr";
    const kpiHtml = model.kpis
      .map((k) => `<div class="kpi"><span>${escapeHtml(k.label)}</span><strong>${escapeHtml(k.value)}</strong></div>`)
      .join("");
    const headHtml = model.table.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("");
    const bodyHtml = model.table.rows.length
      ? model.table.rows
          .map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
          .join("")
      : `<tr><td colspan="${model.table.columns.length}" class="empty">—</td></tr>`;

    const html = `<!doctype html><html dir="${dir}" lang="${ar ? "ar" : "en"}"><head><meta charset="utf-8"><title>${escapeHtml(model.title)}</title>
      <style>
        * { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; box-sizing: border-box; }
        /* Standalone print document: this stylesheet ships inside a new window
           with none of the app CSS loaded, so design tokens would resolve to
           nothing. The literal colours below are correct and intentional. */
        body { margin: 0; padding: 40px; color: #1a1a1a; }
        .head { border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 20px; }
        .company { font-size: 20px; font-weight: 700; }
        .title { font-size: 18px; font-weight: 700; margin-top: 4px; }
        .meta { color:#666; font-size: 13px; margin-top:6px; }
        .kpis { display:flex; flex-wrap:wrap; gap:20px; margin-bottom:24px; }
        .kpi { display:flex; flex-direction:column; min-width:140px; }
        .kpi span { color:#666; font-size:12px; }
        .kpi strong { font-size:18px; }
        table { width:100%; border-collapse: collapse; }
        th, td { padding: 9px 8px; border-bottom: 1px solid #eee; font-size: 13px; text-align: ${ar ? "right" : "left"}; }
        th { background:#f5f5f5; font-weight:700; }
        td.empty { text-align:center; color:#999; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <div class="head">
        <div class="company">${escapeHtml(companyName)}</div>
        <div class="title">${escapeHtml(model.title)}</div>
        <div class="meta">${escapeHtml(t("bi.generated_at"))}: ${escapeHtml(generatedAt)}</div>
      </div>
      <div class="kpis">${kpiHtml}</div>
      <table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>
      <script>window.onload = function(){ window.print(); }</script>
      </body></html>`;

    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const handleExportExcel = () => {
    const lines: string[] = [];
    lines.push([model.title].map(csvCell).join(","));
    lines.push([companyName].map(csvCell).join(","));
    lines.push([`${t("bi.generated_at")}: ${generatedAt}`].map(csvCell).join(","));
    lines.push("");
    lines.push([t("bi.col_metric"), t("bi.col_value")].map(csvCell).join(","));
    for (const k of model.kpis) {
      lines.push([k.label, k.value].map(csvCell).join(","));
    }
    lines.push("");
    lines.push(model.table.columns.map(csvCell).join(","));
    for (const row of model.table.rows) {
      lines.push(row.map(csvCell).join(","));
    }
    const csv = "\uFEFF" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}-report-${generatedAt}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title={t("bi.reports_engine")}
        description={t("bi.reports_subtitle")}
        bordered={false}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("bi.filters")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label>{t("bi.report_type")}</Label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="executive">{t("bi.executive_dashboard")}</SelectItem>
                  <SelectItem value="sales">{t("bi.sales_analytics")}</SelectItem>
                  <SelectItem value="collection">{t("bi.collection_analytics")}</SelectItem>
                  <SelectItem value="construction">{t("bi.construction_analytics")}</SelectItem>
                  <SelectItem value="procurement">{t("bi.procurement_analytics")}</SelectItem>
                  <SelectItem value="inventory">{t("bi.inventory_analytics")}</SelectItem>
                  <SelectItem value="hr">{t("bi.hr_analytics")}</SelectItem>
                  <SelectItem value="financial">{t("bi.financial_analytics")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("bi.from_date")}</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("bi.to_date")}</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("bi.project")}</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("bi.all")}</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {language === "ar" ? p.nameAr : p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("bi.branch")}</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("bi.all")}</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {language === "ar" ? b.nameAr : b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={handleExportPdf} variant="outline">
              <FileText className="h-4 w-4" />
              {t("bi.export_pdf")}
            </Button>
            <Button onClick={handleExportExcel} variant="outline">
              <FileSpreadsheet className="h-4 w-4" />
              {t("bi.export_excel")}
            </Button>
            <Button onClick={handlePrint} variant="outline">
              <Printer className="h-4 w-4" />
              {t("bi.print")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{model.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {model.kpis.map((k) => (
              <div key={k.label} className="rounded-lg border p-4">
                <div className="text-sm text-muted-foreground">{k.label}</div>
                <div className="text-xl font-bold">{k.value}</div>
              </div>
            ))}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                {model.table.columns.map((c) => (
                  <TableHead key={c}>{c}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {model.table.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={model.table.columns.length} className="text-center text-muted-foreground">
                    {t("bi.no_data")}
                  </TableCell>
                </TableRow>
              ) : (
                model.table.rows.map((row, idx) => (
                  <TableRow key={idx}>
                    {row.map((cell, ci) => (
                      <TableCell key={ci}>{cell}</TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
