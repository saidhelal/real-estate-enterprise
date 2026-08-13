import {
  useGetExecutiveOversight,
  getGetExecutiveOversightQueryKey,
  useListCompanies,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { TONE_TEXT, type StatusTone } from "@/lib/design-tokens";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  RefreshCw,
  TrendingUp,
  CircleDollarSign,
  Wallet,
  Calculator,
  Users,
  Building,
  HardHat,
  ShoppingCart,
  Package,
  UserCog,
  Scale,
  MessageSquare,
  FileBox,
  ShieldCheck,
  AlertTriangle,
  LayoutDashboard,
  ListChecks,
  FolderKanban,
  History,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import { useLanguage } from "@/lib/language-provider";

type Kpi = { key: string; value: string; kind: string; tone?: string | null };

const DEPT_ICONS: Record<string, LucideIcon> = {
  sales: TrendingUp,
  collections: CircleDollarSign,
  finance: Wallet,
  accounting: Calculator,
  crm: Users,
  realEstate: Building,
  construction: HardHat,
  procurement: ShoppingCart,
  inventory: Package,
  hr: UserCog,
  legal: Scale,
  customerService: MessageSquare,
  fixedAssets: FileBox,
  insurance: ShieldCheck,
};

// The oversight API speaks in warning/danger/success; the design system speaks
// in warning/error/success. Translate once here, at the boundary, rather than
// letting the API's vocabulary reach into the styling.
const TONE_CLASS: Record<string, string> = {
  warning: TONE_TEXT.warning,
  danger: TONE_TEXT.error,
  success: TONE_TEXT.success,
};

const DEPARTMENT_STATUS_TONE: Record<string, StatusTone> = {
  healthy: "success",
  attention: "warning",
  critical: "error",
};

export default function ExecutiveOversightPage() {
  const { t, language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId };
  const { data, isLoading, refetch, isRefetching } = useGetExecutiveOversight(params, {
    query: { enabled: !!companyId, queryKey: getGetExecutiveOversightQueryKey(params) },
  });

  const locale = language === "ar" ? "ar-EG" : "en-US";
  const moneyFmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const countFmt = new Intl.NumberFormat(locale);

  const formatValue = (value: string, kind: string): string => {
    if (kind === "money") return moneyFmt.format(Number(value) || 0);
    if (kind === "percent") return `${value}%`;
    if (kind === "hours") return `${value} ${t("eo.unit.hours")}`;
    return countFmt.format(Number(value) || 0);
  };

  const generatedAt = data?.generatedAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(data.generatedAt),
      )
    : null;

  const dtFmt = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" });

  // Compact KPI tile used across the section grids. Delegates to the canonical
  // metric tile so an oversight figure and a dashboard figure are the same
  // object; only the tone translation is local to this screen.
  const KpiTile = ({ kpi, scope }: { kpi: Kpi; scope: string }) => (
    <KpiCard
      data-testid={`kpi-${scope}-${kpi.key}`}
      label={t(`eo.kpi.${kpi.key}`)}
      value={
        <span className={kpi.tone ? TONE_CLASS[kpi.tone] ?? "" : ""}>
          {formatValue(kpi.value, kpi.kind)}
        </span>
      }
    />
  );

  const KpiGrid = ({ kpis, scope }: { kpis: Kpi[]; scope: string }) => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <KpiTile key={kpi.key} kpi={kpi} scope={scope} />
      ))}
    </div>
  );

  const SectionCard = ({
    title,
    icon: Icon,
    children,
  }: {
    title: string;
    icon: LucideIcon;
    children: React.ReactNode;
  }) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );

  const TABS = [
    { key: "summary", icon: LayoutDashboard },
    { key: "departments", icon: ListChecks },
    { key: "projects", icon: FolderKanban },
    { key: "financial", icon: Wallet },
    { key: "sales", icon: TrendingUp },
    { key: "execution", icon: HardHat },
    { key: "hr", icon: UserCog },
    { key: "customerService", icon: MessageSquare },
    { key: "insurance", icon: ShieldCheck },
    { key: "alerts", icon: AlertTriangle },
    { key: "eventLog", icon: History },
  ] as const;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <PageHeader
            title={t("eo.title")}
            description={t("eo.subtitle")}
            bordered={false}
          />
          {data?.scope?.level === "department" ? (
            <p className={`mt-1 text-xs ${TONE_CLASS.warning}`}>{t("eo.scope.department_note")}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {generatedAt ? (
            <span className="text-xs text-muted-foreground">
              {t("eo.generated_at")}: {generatedAt}
            </span>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isLoading || isRefetching}
            data-testid="button-refresh-oversight"
          >
            <RefreshCw className={`me-2 h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
            {t("eo.refresh")}
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue="summary" className="space-y-4">
          <div className="overflow-x-auto">
            <TabsList className="inline-flex h-auto flex-wrap justify-start gap-1">
              {TABS.map((tab) => (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className="gap-1.5"
                  data-testid={`tab-${tab.key}`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {t(`eo.section.${tab.key}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* 1. Executive dashboard / summary */}
          <TabsContent value="summary" className="space-y-4">
            <KpiGrid kpis={data.summary} scope="summary" />
            <div className="grid gap-4 lg:grid-cols-3">
              {(
                [
                  { key: "today", icon: CalendarClock, kpis: data.today },
                  { key: "week", icon: CalendarClock, kpis: data.week },
                  { key: "month", icon: CalendarClock, kpis: data.month },
                ] as const
              ).map((w) => (
                <SectionCard key={w.key} title={t(`eo.section.${w.key}`)} icon={w.icon}>
                  <dl className="divide-y divide-border">
                    {w.kpis.map((kpi) => (
                      <div
                        key={kpi.key}
                        className="flex items-center justify-between py-2"
                        data-testid={`kpi-${w.key}-${kpi.key}`}
                      >
                        <dt className="text-sm text-muted-foreground">{t(`eo.kpi.${kpi.key}`)}</dt>
                        <dd className="text-sm font-semibold tabular-nums">
                          {formatValue(kpi.value, kpi.kind)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </SectionCard>
              ))}
            </div>
          </TabsContent>

          {/* 2. Departments tracking */}
          <TabsContent value="departments" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.departments.map((dept) => {
                const Icon = DEPT_ICONS[dept.key] ?? TrendingUp;
                return (
                  <Card key={dept.key} data-testid={`card-dept-${dept.key}`}>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between gap-2 text-base">
                        <span className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Icon className="h-4 w-4" />
                          </span>
                          {t(`eo.dept.${dept.key}`)}
                        </span>
                        <StatusBadge
                          tone={DEPARTMENT_STATUS_TONE[dept.status] ?? "neutral"}
                          label={t(`eo.status.${dept.status}`)}
                          data-testid={`status-${dept.key}`}
                          withDot
                        />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-md bg-muted/50 p-2">
                          <div className="text-base font-bold tabular-nums">
                            {dept.completionRate != null ? `${dept.completionRate}%` : "—"}
                          </div>
                          <div className="text-[10px] text-muted-foreground">{t("eo.meta.completionRate")}</div>
                        </div>
                        <div className="rounded-md bg-muted/50 p-2">
                          <div className="text-base font-bold tabular-nums">{countFmt.format(dept.completedOps)}</div>
                          <div className="text-[10px] text-muted-foreground">{t("eo.meta.completedOps")}</div>
                        </div>
                        <div className="rounded-md bg-muted/50 p-2">
                          <div
                            className={`text-base font-bold tabular-nums ${dept.overdueTasks > 0 ? TONE_CLASS.warning : ""}`}
                          >
                            {countFmt.format(dept.overdueTasks)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">{t("eo.meta.overdueTasks")}</div>
                        </div>
                      </div>
                      <dl className="divide-y divide-border">
                        {dept.kpis.map((kpi) => (
                          <div
                            key={kpi.key}
                            className="flex items-center justify-between py-2"
                            data-testid={`kpi-${dept.key}-${kpi.key}`}
                          >
                            <dt className="text-sm text-muted-foreground">{t(`eo.kpi.${kpi.key}`)}</dt>
                            <dd className={`text-sm font-semibold tabular-nums ${kpi.tone ? TONE_CLASS[kpi.tone] ?? "" : ""}`}>
                              {formatValue(kpi.value, kpi.kind)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* 3. Projects tracking */}
          <TabsContent value="projects" className="space-y-4">
            <KpiGrid kpis={data.projects.kpis} scope="projects" />
            <SectionCard title={t("eo.projects.at_risk")} icon={AlertTriangle}>
              {data.projects.atRisk.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t("eo.projects.none_at_risk")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("eo.col.project")}</TableHead>
                      <TableHead>{t("eo.col.status")}</TableHead>
                      <TableHead>{t("eo.col.issue")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.projects.atRisk.map((p) => (
                      <TableRow key={p.id} data-testid={`risk-${p.id}`}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{t(`eo.projectStatus.${p.status}`)}</TableCell>
                        <TableCell>
                          <span className={p.tone ? TONE_CLASS[p.tone] ?? "" : ""}>{t(`eo.issue.${p.issue}`)}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </SectionCard>
          </TabsContent>

          {/* 4-9. Single-grid sections */}
          <TabsContent value="financial">
            <KpiGrid kpis={data.financial} scope="financial" />
          </TabsContent>
          <TabsContent value="sales">
            <KpiGrid kpis={data.sales} scope="sales" />
          </TabsContent>
          <TabsContent value="execution">
            <KpiGrid kpis={data.execution} scope="execution" />
          </TabsContent>
          <TabsContent value="hr">
            <KpiGrid kpis={data.hr} scope="hr" />
          </TabsContent>
          <TabsContent value="customerService">
            <KpiGrid kpis={data.customerService} scope="customerService" />
          </TabsContent>
          <TabsContent value="insurance">
            <KpiGrid kpis={data.insurance} scope="insurance" />
          </TabsContent>

          {/* 10. Critical executive alerts */}
          <TabsContent value="alerts">
            <SectionCard title={t("eo.section.alerts")} icon={AlertTriangle}>
              {data.criticalAlerts.length === 0 ? (
                <p className={`py-6 text-center text-sm ${TONE_CLASS.success}`}>
                  {t("eo.alerts.none")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.criticalAlerts.map((a) => (
                    <li
                      key={a.key}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3"
                      data-testid={`alert-${a.key}`}
                    >
                      <div className="flex items-center gap-3">
                        <AlertTriangle
                          className={`h-4 w-4 ${a.severity === "danger" ? TONE_CLASS.danger : TONE_CLASS.warning}`}
                        />
                        <div>
                          <div className="text-sm font-medium">{t(`eo.alert.${a.key}`)}</div>
                          <div className="text-xs text-muted-foreground">{t(`eo.dept.${a.department}`)}</div>
                        </div>
                      </div>
                      <div className="text-end">
                        <div
                          className={`text-sm font-bold tabular-nums ${a.severity === "danger" ? TONE_CLASS.danger : TONE_CLASS.warning}`}
                        >
                          {a.value != null && a.kind
                            ? formatValue(a.value, a.kind)
                            : countFmt.format(a.count)}
                        </div>
                        {a.value != null && a.kind && a.count > 0 ? (
                          <div className="text-xs text-muted-foreground">
                            {countFmt.format(a.count)} {t("eo.alerts.items")}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </TabsContent>

          {/* 11. Executive event log */}
          <TabsContent value="eventLog">
            <SectionCard title={t("eo.section.eventLog")} icon={History}>
              {data.eventLog.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t("eo.events.none")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("eo.col.time")}</TableHead>
                      <TableHead>{t("eo.col.user")}</TableHead>
                      <TableHead>{t("eo.col.action")}</TableHead>
                      <TableHead>{t("eo.col.entity")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.eventLog.map((e) => (
                      <TableRow key={e.id} data-testid={`event-${e.id}`}>
                        <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                          {dtFmt.format(new Date(e.timestamp))}
                        </TableCell>
                        <TableCell className="font-medium">{e.user}</TableCell>
                        <TableCell>{t(`eo.action.${e.action}`)}</TableCell>
                        <TableCell>{t(`eo.entity.${e.entity}`)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </SectionCard>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
