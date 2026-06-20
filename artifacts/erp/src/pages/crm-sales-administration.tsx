import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";
import {
  useListLeads,
  useListLeadAssignments,
  useListLeadFollowUps,
  useListUsers,
  useListUnits,
  useListUnitStatuses,
} from "@workspace/api-client-react";
import { enumLabel } from "@/lib/enums";
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
} from "lucide-react";

const CLOSED_FOLLOWUP = new Set(["done", "completed", "closed", "cancelled"]);

function todayISO() {
  return new Date().toISOString().slice(0, 10);
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

  const p = { pageSize: 200 } as const;
  const { data: leadsData } = useListLeads(p);
  const { data: assignmentsData } = useListLeadAssignments(p);
  const { data: followUpsData } = useListLeadFollowUps(p);
  const { data: usersData } = useListUsers();
  const { data: unitsData } = useListUnits(p);
  const { data: unitStatusesData } = useListUnitStatuses(p);

  const leads = leadsData?.data ?? [];
  const assignments = assignmentsData?.data ?? [];
  const followUps = followUpsData?.data ?? [];
  const users = usersData ?? [];
  const units = unitsData?.data ?? [];
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

  const userName = (id: string | null | undefined) =>
    users.find((u) => u.id === id)?.fullName ?? (ar ? "غير مُسند" : "Unassigned");

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

      {/* KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={Inbox} label={ar ? "إجمالي العملاء" : "Total Leads"} value={leads.length} hint={ar ? "العملاء المحتملون" : "Prospective leads"} />
        <Kpi icon={AlertTriangle} label={ar ? "عملاء بدون إسناد" : "Unassigned Leads"} value={unassignedLeads.length} hint={ar ? "بحاجة لتوزيع" : "Need distribution"} alert />
        <Kpi icon={UserCheck} label={ar ? "إسنادات نشطة" : "Active Assignments"} value={activeAssignments.length} hint={ar ? "عملاء مُسندون" : "Leads assigned"} />
        <Kpi icon={CalendarClock} label={ar ? "متابعات مفتوحة" : "Open Follow-ups"} value={openFollowUps.length} hint={`${dueTodayFollowUps.length} ${ar ? "اليوم" : "due today"}`} />
        <Kpi icon={AlertTriangle} label={ar ? "متابعات متأخرة" : "Overdue Follow-ups"} value={overdueFollowUps.length} hint={ar ? "تجاوزت الموعد" : "Past due date"} alert />
        <Kpi icon={Home} label={ar ? "وحدات متاحة" : "Available Units"} value={availableUnits.length} hint={ar ? "جاهزة لبدء البيع" : "Ready to start sale"} />
      </section>

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

      {/* Alerts: follow-up monitoring */}
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

      {/* Operational tools */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {ar ? "توزيع العملاء والمتابعة" : "Lead Distribution & Follow-up"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AdminTile icon={UserCheck} title={ar ? "توزيع العملاء" : "Lead Distribution"} desc={ar ? "إسناد وإعادة توزيع العملاء على الفريق" : "Assign and redistribute leads across the team"} href="/lead-assignments" />
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
          <AdminTile icon={ShieldCheck} title={ar ? "الأدوار والصلاحيات" : "Role Permissions"} desc={ar ? "إدارة أدوار وصلاحيات فريق المبيعات" : "Manage sales team roles and permissions"} href="/roles" />
        </div>
      </section>
    </div>
  );
}
