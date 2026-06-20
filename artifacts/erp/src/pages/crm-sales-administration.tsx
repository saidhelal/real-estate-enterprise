import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";
import {
  useListContracts,
  useListReservations,
  useListCheques,
  useListUnits,
  useListCustomers,
  getListContractsQueryKey,
  type Contract,
} from "@workspace/api-client-react";
import {
  saleStage,
  stageLabel,
  isLiveStage,
  trafficLight,
  formatElapsed,
  formatRemaining,
  TRAFFIC_DOT,
  TRAFFIC_RING,
  type SaleStage,
} from "@/lib/sale-workflow";
import { enumLabel } from "@/lib/enums";
import {
  UserCheck,
  ArrowRightLeft,
  Megaphone,
  Activity,
  SlidersHorizontal,
  Home,
  BarChart3,
  FileSpreadsheet,
  FileText,
  Banknote,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

/** Ticks every 60s so elapsed / remaining timers stay live. */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const PIPELINE: SaleStage[] = ["returned", "draft", "pending_finance", "finance_approved", "active"];

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Icon className="h-4 w-4" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function AdminTile({
  icon: Icon,
  title,
  desc,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-sm text-muted-foreground">{desc}</CardContent>
      </Card>
    </Link>
  );
}

export default function SalesAdministrationPage() {
  const { language, t } = useLanguage();
  const ar = language === "ar";
  const now = useNow();

  const p = { pageSize: 200 } as const;
  const { data: contractsData } = useListContracts(p, { query: { queryKey: getListContractsQueryKey(p) } });
  const { data: reservationsData } = useListReservations(p);
  const { data: chequesData } = useListCheques(p);
  const { data: unitsData } = useListUnits(p);
  const { data: customersData } = useListCustomers(p);

  const contracts = contractsData?.data ?? [];
  const reservations = reservationsData?.data ?? [];
  const cheques = chequesData?.data ?? [];
  const units = unitsData?.data ?? [];
  const customers = customersData?.data ?? [];

  const customerName = (id: string) => customers.find((c) => c.id === id)?.fullName ?? id;
  const unitCode = (id: string) => units.find((u) => u.id === id)?.code ?? id;

  // Contract stage distribution.
  const stageCount = (s: SaleStage) => contracts.filter((c) => saleStage(c) === s).length;
  const liveContracts = contracts.filter((c) => isLiveStage(saleStage(c)));
  const activeCount = stageCount("active");

  // Pipeline value across live + active contracts.
  const num = (v: string | null | undefined) => {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
  };
  const pipelineValue = [...liveContracts, ...contracts.filter((c) => saleStage(c) === "active")]
    .reduce((sum, c) => sum + num(c.totalPrice), 0);
  const fmtMoney = (n: number) => n.toLocaleString(ar ? "ar-EG" : "en-US", { maximumFractionDigits: 0 });

  // SLA / traffic-light escalations: live contracts that are red or orange.
  const alerts = liveContracts
    .filter((c) => {
      const light = trafficLight(c, now);
      return light === "red" || light === "orange";
    })
    .sort((a, b) => {
      const order = { red: 0, orange: 1, yellow: 2, green: 3 } as const;
      return order[trafficLight(a, now)] - order[trafficLight(b, now)];
    });

  // Cheque status breakdown.
  const chequeStatuses = ["received", "post_dated", "under_collection", "deposited", "cleared", "returned", "cancelled", "replaced"];
  const chequeCount = (s: string) => cheques.filter((c) => c.status === s).length;
  const activeReservations = reservations.filter((r) => r.status === "active" || r.status === "confirmed").length;

  const elapsedFrom = (c: Contract) => c.submittedToFinanceAt ?? c.contractDate;
  const maxStage = Math.max(1, ...PIPELINE.map((s) => stageCount(s)));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.sales_administration")}</h1>
        <p className="text-sm text-muted-foreground">
          {ar
            ? "لوحة متابعة المبيعات: المؤشرات، مسار الصفقات، تنبيهات اتفاقية الخدمة، وأدوات التشغيل."
            : "Sales operations cockpit: KPIs, deal pipeline, SLA alerts, and operational tools."}
        </p>
      </div>

      {/* KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={FileText} label={ar ? "مبيعات نشطة" : "Active Sales"} value={activeCount} hint={ar ? "عقود مفعّلة" : "Activated contracts"} />
        <Kpi icon={Banknote} label={ar ? "بانتظار المالية" : "In Finance"} value={stageCount("pending_finance")} hint={ar ? "صندوق وارد المالية" : "Finance inbox"} />
        <Kpi icon={CheckCircle2} label={ar ? "بانتظار القانونية" : "In Legal"} value={stageCount("finance_approved")} hint={ar ? "معتمد ماليًا" : "Finance approved"} />
        <Kpi icon={ArrowRightLeft} label={ar ? "مسودة / معاد" : "Draft / Returned"} value={stageCount("draft") + stageCount("returned")} hint={ar ? "لدى المبيعات" : "With sales"} />
        <Kpi icon={Home} label={ar ? "حجوزات نشطة" : "Active Reservations"} value={activeReservations} hint={`${units.length} ${ar ? "وحدة" : "units"}`} />
        <Kpi icon={BarChart3} label={ar ? "قيمة المسار" : "Pipeline Value"} value={fmtMoney(pipelineValue)} hint={ar ? "عقود حيّة ونشطة" : "Live + active"} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pipeline distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              {ar ? "توزيع مسار الصفقات" : "Deal Pipeline"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {PIPELINE.map((s) => {
              const c = stageCount(s);
              return (
                <div key={s} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{stageLabel(s, ar)}</span>
                    <span className="tabular-nums text-muted-foreground">{c}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(c / maxStage) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Cheque status breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Banknote className="h-4 w-4 text-muted-foreground" />
              {ar ? "حالة الشيكات" : "Cheque Status"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cheques.length === 0 ? (
              <p className="text-sm text-muted-foreground">{ar ? "لا توجد شيكات" : "No cheques"}</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {chequeStatuses.filter((s) => chequeCount(s) > 0).map((s) => (
                  <div key={s} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <span>{enumLabel(s, language)}</span>
                    <Badge variant="secondary" className="tabular-nums">{chequeCount(s)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SLA / traffic-light escalations */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            {ar ? "تنبيهات المتابعة (اتفاقية الخدمة)" : "SLA Escalations"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{ar ? "لا توجد تنبيهات — كل الصفقات ضمن المدة." : "No alerts — all deals within SLA."}</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((c) => {
                const light = trafficLight(c, now);
                const stage = saleStage(c);
                return (
                  <div key={c.id} className={`rounded-md border p-3 ${TRAFFIC_RING[light]}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 font-medium">
                        <span className={`h-2.5 w-2.5 rounded-full ${TRAFFIC_DOT[light]}`} title={light} />
                        {c.code}
                      </span>
                      <Badge variant={stage === "returned" ? "destructive" : "outline"}>{stageLabel(stage, ar)}</Badge>
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{ar ? "العميل" : "Customer"}: {customerName(c.customerId)}</span>
                      <span>{ar ? "الوحدة" : "Unit"}: {unitCode(c.unitId)}</span>
                      <span>{ar ? "المنقضي" : "Elapsed"}: {formatElapsed(elapsedFrom(c), ar, now)}</span>
                      {stage === "pending_finance" && c.financeSlaDueAt ? (
                        <span className={light === "red" ? "font-medium text-red-500" : ""}>
                          SLA: {formatRemaining(c.financeSlaDueAt, ar, now)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Operational tools */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {ar ? "إدارة العملاء المحتملين" : "Lead Operations"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AdminTile icon={UserCheck} title={ar ? "إسناد العملاء" : "Lead Assignment"} desc={ar ? "إسناد وإعادة إسناد العملاء للمندوبين" : "Assign and reassign leads to representatives"} href="/lead-assignments" />
          <AdminTile icon={ArrowRightLeft} title={ar ? "تحويل العملاء" : "Lead Conversions"} desc={ar ? "تحويل العملاء المحتملين إلى عملاء" : "Convert leads into customers"} href="/lead-conversions" />
          <AdminTile icon={Megaphone} title={ar ? "مصادر العملاء" : "Lead Sources"} desc={ar ? "إدارة مصادر وقنوات العملاء" : "Manage lead sources and channels"} href="/lead-sources" />
          <AdminTile icon={Activity} title={ar ? "أنشطة العملاء" : "Lead Activities"} desc={ar ? "سجل التواصل والأنشطة" : "Communication and activity log"} href="/lead-activities" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {ar ? "المخزون والوحدات" : "Inventory & Units"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AdminTile icon={SlidersHorizontal} title={ar ? "نشر الوحدات المتاحة" : "Available Unit Publishing"} desc={ar ? "نشر الوحدات للبيع عبر مركز إدخال البيانات" : "Publish units for sale via the Data Entry Center"} href="/data-entry-center" />
          <AdminTile icon={Home} title={ar ? "تعديل وحدة (طوارئ)" : "Emergency Unit Correction"} desc={ar ? "تصحيح بيانات الوحدة عند تعذر مركز إدخال البيانات" : "Correct unit data when the Data Entry Center is unavailable"} href="/units" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {ar ? "التقارير" : "Reports"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AdminTile icon={BarChart3} title={ar ? "تقارير ومؤشرات" : "Reports & KPIs"} desc={ar ? "مؤشرات الأداء وتقارير المبيعات" : "Performance indicators and sales reports"} href="/crm-reports" />
          <AdminTile icon={FileSpreadsheet} title={ar ? "التقارير المالية" : "Financial Reports"} desc={ar ? "تقارير مالية مع تصدير PDF و Excel" : "Financial reports with PDF and Excel export"} href="/financial-reports" />
        </div>
      </section>
    </div>
  );
}
