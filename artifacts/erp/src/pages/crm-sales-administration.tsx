import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { useAuth } from "@/lib/auth-provider";
import { useToast } from "@/hooks/use-toast";
import {
  useListLeads,
  useListLeadAssignments,
  useListLeadFollowUps,
  useListUsers,
  useListUnits,
  useListUnitStatuses,
  useListContracts,
  useListCustomers,
  useListCompanies,
  useUpdateUnit,
  useUpdateCustomer,
  useCreateContractCancellation,
  getListUnitsQueryKey,
  getListContractsQueryKey,
  getListCustomersQueryKey,
  type Contract,
} from "@workspace/api-client-react";
import { enumLabel } from "@/lib/enums";
import {
  saleStage,
  stageLabel,
  isLiveStage,
  trafficLight,
  TRAFFIC_DOT,
  TRAFFIC_RING,
  formatElapsed,
  formatRemaining,
  isManagerial,
  paymentMethodLabel,
} from "@/lib/sale-workflow";
import {
  UserCheck,
  ArrowRightLeft,
  Megaphone,
  Activity,
  Home,
  BarChart3,
  ShieldCheck,
  CalendarClock,
  Users,
  AlertTriangle,
  Inbox,
  ListChecks,
  Rocket,
  Gauge,
  Workflow,
  PlayCircle,
  FileX,
  UserCog,
} from "lucide-react";

const CLOSED_FOLLOWUP = new Set(["done", "completed", "closed", "cancelled"]);

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Ticks every 60s so SLA traffic lights and timers stay live. */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  alert,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  hint?: string;
  alert?: boolean;
}) {
  return (
    <Card className={alert && Number(value) > 0 ? "border-amber-400/60" : undefined}>
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Icon className={`h-4 w-4 ${alert && Number(value) > 0 ? "text-amber-500" : ""}`} />
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
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const now = useNow();
  const managerial = isManagerial(user);

  const p = { pageSize: 200 } as const;
  const { data: leadsData } = useListLeads(p);
  const { data: assignmentsData } = useListLeadAssignments(p);
  const { data: followUpsData } = useListLeadFollowUps(p);
  const { data: usersData } = useListUsers();
  const { data: unitsData } = useListUnits(p);
  const { data: unitStatusesData } = useListUnitStatuses(p);
  const { data: contractsData } = useListContracts(p);
  const { data: customersData } = useListCustomers(p);
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const updateUnit = useUpdateUnit();
  const updateCustomer = useUpdateCustomer();
  const cancelSale = useCreateContractCancellation();

  const leads = leadsData?.data ?? [];
  const assignments = assignmentsData?.data ?? [];
  const followUps = followUpsData?.data ?? [];
  const users = usersData ?? [];
  const units = unitsData?.data ?? [];
  const contracts = contractsData?.data ?? [];
  const customers = customersData?.data ?? [];
  const statusCodeById = new Map((unitStatusesData?.data ?? []).map((s) => [s.id, s.code]));

  const today = todayISO();

  // ---- Lead distribution ----
  const unassignedLeads = leads.filter((l) => !l.assignedToUserId);
  const activeAssignments = assignments.filter((a) => a.isActive);

  // ---- Follow-up monitoring ----
  const openFollowUps = followUps.filter((f) => !CLOSED_FOLLOWUP.has(f.status));
  const overdueFollowUps = openFollowUps.filter((f) => f.dueDate < today);
  const dueTodayFollowUps = openFollowUps.filter((f) => f.dueDate === today);

  // ---- Available units (mirror /available-units: status code "available" + salesAvailable) ----
  const availableUnits = units.filter(
    (u) =>
      u.salesAvailable === true &&
      (u.unitStatusId ? statusCodeById.get(u.unitStatusId) : undefined) === "available",
  );

  // ---- Active sales monitoring (read-only; management lives in the workflow board) ----
  const liveSales = contracts.filter((c) => isLiveStage(saleStage(c)));
  const overdueSales = liveSales.filter((c) => trafficLight(c, now) === "red");
  const slaAlerts = liveSales.filter((c) => {
    const light = trafficLight(c, now);
    return light === "red" || light === "orange";
  });

  const userName = (id: string | null | undefined) =>
    users.find((u) => u.id === id)?.fullName ?? (ar ? "غير مُسند" : "Unassigned");
  const customerName = (id: string) => customers.find((c) => c.id === id)?.fullName ?? id;
  const unitCode = (id: string) => units.find((u) => u.id === id)?.code ?? id;

  // ---- Team monitoring / employee performance ----
  const team = users
    .map((u) => {
      const assignedLeads = leads.filter((l) => l.assignedToUserId === u.id).length;
      const repFollowUps = openFollowUps.filter((f) => f.userId === u.id);
      const repOverdue = repFollowUps.filter((f) => f.dueDate < today).length;
      return {
        id: u.id,
        name: u.fullName,
        assignedLeads,
        openFollowUps: repFollowUps.length,
        overdue: repOverdue,
      };
    })
    .filter((r) => r.assignedLeads > 0 || r.openFollowUps > 0)
    .sort((a, b) => b.assignedLeads - a.assignedLeads);

  // Lead status distribution (CRM pipeline of leads, not contracts).
  const leadStatuses = Array.from(new Set(leads.map((l) => l.status)));
  const leadStatusCount = (s: string) => leads.filter((l) => l.status === s).length;
  const maxLeadStatus = Math.max(1, ...leadStatuses.map((s) => leadStatusCount(s)));

  // ---- Action dialogs (Cancel Sale / Reassign Salesperson) ----
  const [dialog, setDialog] = useState<{ type: "cancel" | "reassign"; contract: Contract } | null>(null);
  const [reason, setReason] = useState("");
  const [reassignTo, setReassignTo] = useState("");
  const [busy, setBusy] = useState(false);

  const openCancel = (c: Contract) => { setDialog({ type: "cancel", contract: c }); setReason(""); };
  const openReassign = (c: Contract) => {
    setDialog({ type: "reassign", contract: c });
    setReassignTo(customers.find((x) => x.id === c.customerId)?.assignedToUserId ?? "");
  };

  const refreshSales = () => {
    queryClient.invalidateQueries({ queryKey: getListContractsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListCustomersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListUnitsQueryKey() });
  };

  const submitCancel = () => {
    if (!dialog || !companyId) return;
    setBusy(true);
    cancelSale.mutate(
      { data: { companyId, contractId: dialog.contract.id, cancellationDate: today, reason: reason || undefined } },
      {
        onSuccess: () => {
          toast({ title: ar ? "تم إلغاء البيع" : "Sale cancelled" });
          refreshSales();
          setDialog(null);
          setBusy(false);
        },
        onError: () => { toast({ title: t("common.error"), variant: "destructive" }); setBusy(false); },
      },
    );
  };

  const submitReassign = () => {
    if (!dialog || !reassignTo) return;
    setBusy(true);
    updateCustomer.mutate(
      { id: dialog.contract.customerId, data: { assignedToUserId: reassignTo } },
      {
        onSuccess: () => {
          toast({ title: ar ? "تمت إعادة إسناد مندوب المبيعات" : "Salesperson reassigned" });
          refreshSales();
          setDialog(null);
          setBusy(false);
        },
        onError: () => { toast({ title: t("common.error"), variant: "destructive" }); setBusy(false); },
      },
    );
  };

  // ---- Unit publishing controls (toggle salesAvailable) ----
  const togglePublish = (unitId: string, next: boolean) => {
    updateUnit.mutate(
      { id: unitId, data: { salesAvailable: next } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUnitsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListUnitsQueryKey(p) });
        },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );
  };
  // Only units whose status is "available" can be published/unpublished for sale.
  const publishable = units.filter(
    (u) => (u.unitStatusId ? statusCodeById.get(u.unitStatusId) : undefined) === "available",
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.sales_administration")}</h1>
        <p className="text-sm text-muted-foreground">
          {ar
            ? "مركز إدارة المبيعات التشغيلي: توزيع العملاء، متابعة الفريق، مؤشرات الأداء، المتابعات، الوحدات المتاحة، التقارير، والصلاحيات."
            : "Operational sales management console: lead distribution, team monitoring, performance KPIs, follow-ups, available units, reports, and permissions."}
        </p>
      </div>

      {/* Managerial overdue-sales alert (red) */}
      {managerial && slaAlerts.length > 0 ? (
        <Card className="border-red-500/40 bg-red-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              {ar ? `تنبيهات بيع متأخرة (${slaAlerts.length})` : `Delayed sale alerts (${slaAlerts.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {slaAlerts.map((c) => {
              const light = trafficLight(c, now);
              return (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${TRAFFIC_DOT[light]}`} />
                    <span className="font-medium">{c.code}</span>
                    <span className="text-muted-foreground">{unitCode(c.unitId)} · {customerName(c.customerId)}</span>
                    <Badge variant="outline">{stageLabel(saleStage(c), ar)}</Badge>
                  </span>
                  <span className={light === "red" ? "font-medium text-red-500" : "text-orange-500"}>
                    {c.financeSlaDueAt ? formatRemaining(c.financeSlaDueAt, ar, now) : formatElapsed(c.submittedToFinanceAt ?? c.contractDate, ar, now)}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {/* KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={Inbox} label={ar ? "إجمالي العملاء" : "Total Leads"} value={leads.length} hint={ar ? "العملاء المحتملون" : "Prospective leads"} />
        <Kpi icon={AlertTriangle} label={ar ? "عملاء بدون إسناد" : "Unassigned Leads"} value={unassignedLeads.length} hint={ar ? "بحاجة لتوزيع" : "Need distribution"} alert />
        <Kpi icon={UserCheck} label={ar ? "إسنادات نشطة" : "Active Assignments"} value={activeAssignments.length} hint={ar ? "عملاء مُسندون" : "Leads assigned"} />
        <Kpi icon={CalendarClock} label={ar ? "متابعات متأخرة" : "Overdue Follow-ups"} value={overdueFollowUps.length} hint={`${dueTodayFollowUps.length} ${ar ? "اليوم" : "due today"}`} alert />
        <Kpi icon={Gauge} label={ar ? "مبيعات جارية" : "Active Sales"} value={liveSales.length} hint={`${overdueSales.length} ${ar ? "متأخرة" : "overdue"}`} />
        <Kpi icon={Home} label={ar ? "وحدات متاحة" : "Available Units"} value={availableUnits.length} hint={ar ? "جاهزة لبدء البيع" : "Ready to start sale"} />
      </section>

      {/* Active sales — SLA traffic lights & operational actions */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Workflow className="h-4 w-4 text-muted-foreground" />
              {ar ? "المبيعات الجارية — مؤشرات SLA" : "Active Sales — SLA Traffic Lights"}
            </CardTitle>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />{ar ? "في الوقت" : "On time"}</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />{ar ? "قريب من الحد" : "Near limit"}</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />{ar ? "متأخر" : "Overdue"}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {liveSales.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {ar ? "لا توجد مبيعات جارية حالياً. ابدأ من الوحدات المتاحة." : "No sales in progress. Start one from Available Units."}
            </p>
          ) : (
            <div className="space-y-2">
              {liveSales.map((c) => {
                const light = trafficLight(c, now);
                const stage = saleStage(c);
                return (
                  <div key={c.id} className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border p-3 ${TRAFFIC_RING[light]}`}>
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TRAFFIC_DOT[light]}`} title={light} />
                    <span className="font-medium">{c.code}</span>
                    <span className="text-xs text-muted-foreground">{unitCode(c.unitId)} · {customerName(c.customerId)}</span>
                    <Badge variant={stage === "returned" ? "destructive" : "outline"}>{stageLabel(stage, ar)}</Badge>
                    <span className="text-xs text-muted-foreground">{paymentMethodLabel(c.paymentMethod, ar)}</span>
                    <span className={`text-xs ${light === "red" ? "font-medium text-red-500" : "text-muted-foreground"}`}>
                      {c.financeSlaDueAt ? `SLA: ${formatRemaining(c.financeSlaDueAt, ar, now)}` : `${ar ? "المنقضي" : "Elapsed"}: ${formatElapsed(c.submittedToFinanceAt ?? c.contractDate, ar, now)}`}
                    </span>
                    <div className="ms-auto flex flex-wrap items-center gap-1.5">
                      <Link href="/crm-sales">
                        <Button variant="outline" size="sm"><Workflow className="h-3.5 w-3.5 me-1" />{ar ? "عرض المسار" : "View Workflow"}</Button>
                      </Link>
                      <Link href="/crm-sales">
                        <Button variant="outline" size="sm"><PlayCircle className="h-3.5 w-3.5 me-1" />{ar ? "متابعة البيع" : "Continue Sale"}</Button>
                      </Link>
                      {managerial ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => openReassign(c)}>
                            <UserCog className="h-3.5 w-3.5 me-1" />{ar ? "إعادة إسناد المندوب" : "Reassign Salesperson"}
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => openCancel(c)}>
                            <FileX className="h-3.5 w-3.5 me-1" />{ar ? "إلغاء البيع" : "Cancel Sale"}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Team monitoring / employee performance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-muted-foreground" />
              {ar ? "متابعة الفريق وأداء الموظفين" : "Team Monitoring & Performance"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {team.length === 0 ? (
              <p className="text-sm text-muted-foreground">{ar ? "لا توجد بيانات فريق بعد." : "No team activity yet."}</p>
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-2 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <span>{ar ? "الموظف" : "Employee"}</span>
                  <span className="text-end">{ar ? "عملاء" : "Leads"}</span>
                  <span className="text-end">{ar ? "متابعات" : "Open"}</span>
                  <span className="text-end">{ar ? "متأخر" : "Late"}</span>
                </div>
                {team.map((r) => (
                  <div key={r.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 rounded-md border p-2 text-sm">
                    <span className="truncate font-medium">{r.name}</span>
                    <span className="text-end tabular-nums">{r.assignedLeads}</span>
                    <span className="text-end tabular-nums">{r.openFollowUps}</span>
                    <span className={`text-end tabular-nums ${r.overdue > 0 ? "font-medium text-amber-500" : "text-muted-foreground"}`}>{r.overdue}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lead status distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              {ar ? "توزيع حالات العملاء" : "Lead Status Distribution"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {leadStatuses.length === 0 ? (
              <p className="text-sm text-muted-foreground">{ar ? "لا يوجد عملاء بعد." : "No leads yet."}</p>
            ) : (
              leadStatuses.map((s) => {
                const c = leadStatusCount(s);
                return (
                  <div key={s} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{enumLabel(s, language)}</span>
                      <span className="tabular-nums text-muted-foreground">{c}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(c / maxLeadStatus) * 100}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Follow-up monitoring alerts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            {ar ? "تنبيهات المتابعة" : "Follow-up Alerts"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overdueFollowUps.length === 0 && dueTodayFollowUps.length === 0 ? (
            <p className="text-sm text-muted-foreground">{ar ? "لا توجد متابعات متأخرة أو مستحقة اليوم." : "No overdue or due-today follow-ups."}</p>
          ) : (
            <div className="space-y-2">
              {[...overdueFollowUps, ...dueTodayFollowUps].slice(0, 12).map((f) => {
                const overdue = f.dueDate < today;
                return (
                  <div key={f.id} className={`flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm ${overdue ? "border-amber-400/50" : ""}`}>
                    <Badge variant={overdue ? "destructive" : "secondary"}>{overdue ? (ar ? "متأخر" : "Overdue") : (ar ? "اليوم" : "Today")}</Badge>
                    <span className="text-muted-foreground">{f.dueDate}</span>
                    <span className="font-medium">{userName(f.userId)}</span>
                    {f.notes ? <span className="truncate text-muted-foreground">{f.notes}</span> : null}
                    <Badge variant="outline" className="ms-auto">{enumLabel(f.status, language)}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unit publishing controls */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Home className="h-4 w-4 text-muted-foreground" />
            {ar ? "التحكم في نشر الوحدات" : "Unit Publishing Controls"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {publishable.length === 0 ? (
            <p className="text-sm text-muted-foreground">{ar ? "لا توجد وحدات بحالة متاحة للنشر." : "No units in available status to publish."}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {publishable.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{u.code}</div>
                    <div className="truncate text-xs text-muted-foreground">{u.salesAvailable ? (ar ? "منشورة للبيع" : "Published for sale") : (ar ? "غير منشورة" : "Unpublished")}</div>
                  </div>
                  <Switch
                    checked={u.salesAvailable === true}
                    onCheckedChange={(v) => togglePublish(u.id, v)}
                    aria-label={ar ? "نشر للبيع" : "Publish for sale"}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Operational tools */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {ar ? "توزيع العملاء والمتابعة" : "Lead Distribution & Follow-up"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AdminTile icon={UserCheck} title={ar ? "توزيع العملاء" : "Lead Distribution"} desc={ar ? "إسناد العملاء الجدد إلى الفريق" : "Assign new leads across the team"} href="/lead-assignments" />
          <AdminTile icon={ArrowRightLeft} title={ar ? "إعادة توزيع العملاء" : "Reassign Leads"} desc={ar ? "إعادة إسناد العملاء بين أعضاء الفريق" : "Redistribute leads between team members"} href="/lead-assignments" />
          <AdminTile icon={ListChecks} title={ar ? "متابعات العملاء" : "Follow-up Monitoring"} desc={ar ? "مراقبة المتابعات المستحقة والمتأخرة" : "Track due and overdue follow-ups"} href="/lead-follow-ups" />
          <AdminTile icon={ArrowRightLeft} title={ar ? "تحويل العملاء" : "Lead Conversions"} desc={ar ? "تحويل العملاء المحتملين إلى عملاء" : "Convert leads into customers"} href="/lead-conversions" />
          <AdminTile icon={Megaphone} title={ar ? "مصادر العملاء" : "Lead Sources"} desc={ar ? "إدارة مصادر وقنوات العملاء" : "Manage lead sources and channels"} href="/lead-sources" />
          <AdminTile icon={Activity} title={ar ? "أنشطة العملاء" : "Lead Activities"} desc={ar ? "سجل التواصل والأنشطة" : "Communication and activity log"} href="/lead-activities" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {ar ? "الوحدات المتاحة" : "Available Units"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AdminTile icon={Rocket} title={ar ? "الوحدات المتاحة وبدء البيع" : "Available Units & Start Sale"} desc={ar ? "استعراض الوحدات المتاحة وبدء عملية البيع" : "Review available units and launch the sales workflow"} href="/available-units" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {ar ? "التقارير والصلاحيات" : "Reports & Permissions"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AdminTile icon={BarChart3} title={ar ? "تقارير ومؤشرات" : "Reports & KPIs"} desc={ar ? "مؤشرات الأداء وتقارير المبيعات" : "Performance indicators and sales reports"} href="/crm-reports" />
          <AdminTile icon={ShieldCheck} title={ar ? "صلاحيات المبيعات" : "Sales Permissions"} desc={ar ? "إدارة أدوار وصلاحيات فريق المبيعات" : "Manage sales team roles and permissions"} href="/roles" />
        </div>
      </section>

      {/* Cancel Sale / Reassign Salesperson dialog */}
      <Dialog open={!!dialog} onOpenChange={(o) => { if (!busy && !o) setDialog(null); }}>
        <DialogContent>
          {dialog?.type === "cancel" ? (
            <>
              <DialogHeader>
                <DialogTitle>{ar ? `إلغاء البيع — ${dialog.contract.code}` : `Cancel Sale — ${dialog.contract.code}`}</DialogTitle>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label>{ar ? "سبب الإلغاء" : "Cancellation reason"}</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={ar ? "اختياري" : "Optional"} />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialog(null)} disabled={busy}>{t("common.cancel")}</Button>
                <Button variant="destructive" onClick={submitCancel} disabled={busy}>{ar ? "تأكيد الإلغاء" : "Confirm Cancel"}</Button>
              </DialogFooter>
            </>
          ) : dialog?.type === "reassign" ? (
            <>
              <DialogHeader>
                <DialogTitle>{ar ? `إعادة إسناد المندوب — ${dialog.contract.code}` : `Reassign Salesperson — ${dialog.contract.code}`}</DialogTitle>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label>{ar ? "مندوب المبيعات" : "Salesperson"}</Label>
                <Select value={reassignTo} onValueChange={setReassignTo}>
                  <SelectTrigger><SelectValue placeholder={ar ? "اختر المندوب" : "Select salesperson"} /></SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {ar ? "يُعاد إسناد العميل المرتبط بهذا البيع." : "Reassigns the customer linked to this sale."}
                </p>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDialog(null)} disabled={busy}>{t("common.cancel")}</Button>
                <Button onClick={submitReassign} disabled={busy || !reassignTo}>{ar ? "حفظ" : "Save"}</Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
