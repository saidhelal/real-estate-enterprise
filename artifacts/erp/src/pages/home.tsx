import { useAuth } from "@/lib/auth-provider";
import { PageHeader } from "@/components/ui/page-header";
import { useLanguage } from "@/lib/language-provider";
import { Link } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { accentChipClass, accentBarClass, accentSurfaceClass } from "@/lib/design-tokens";
import { departmentPath } from "@/components/layout/app-shell";
import {
  useGetRealEstateDashboard,
  useGetFinanceDashboard,
  useGetHrDashboard,
  useGetLegalDashboard,
  useGetProcurementDashboard,
  useGetCustomerServiceDashboard,
  useGetGeneralAdminDashboard,
  useGetInsuranceDashboard,
  useGetNotificationsDashboard,
  useGetMarketingDashboard,
  useListCompanies,
  getGetRealEstateDashboardQueryKey,
  getGetFinanceDashboardQueryKey,
  getGetHrDashboardQueryKey,
  getGetLegalDashboardQueryKey,
  getGetProcurementDashboardQueryKey,
  getGetCustomerServiceDashboardQueryKey,
  getGetGeneralAdminDashboardQueryKey,
  getGetInsuranceDashboardQueryKey,
  getGetNotificationsDashboardQueryKey,
  getGetMarketingDashboardQueryKey,
} from "@workspace/api-client-react";
import {
  Building,
  Users,
  Calculator,
  ShoppingCart,
  Compass,
  HardHat,
  UserCog,
  Scale,
  MessageSquare,
  LandPlot,
  BarChart3,
  Settings,
  Home as HomeIcon,
  LayoutDashboard,
  FileSignature,
  TrendingUp,
  CircleDollarSign,
  Search,
  FolderArchive,
  Database,
  Briefcase,
  ShieldCheck,
  Bell,
  Gauge,
  Megaphone,
  type LucideIcon,
} from "lucide-react";

type CountKey =
  | "real_estate"
  | "crm"
  | "finance"
  | "procurement"
  | "hr"
  | "legal"
  | "customer_service"
  | "general_admin"
  | "insurance"
  | "notifications"
  | "marketing";

type ModuleCard = {
  titleKey: string;
  icon: LucideIcon;
  /**
   * Which entry of the shared categorical ramp this module owns. Declared per
   * module rather than derived from array position, so inserting or reordering
   * a module never recolours the ones after it — a module keeps its accent for
   * as long as it exists. Repeats past the eighth are deliberate: the icon is
   * the identifier here, the colour only helps the eye group things.
   */
  accent: number;
  countKey?: CountKey;
  /**
   * A department. The tile opens the department's workspace, which lists the
   * department's screens as cards — read from the navigation SSOT, so this
   * file names the department and never its contents.
   */
  group?: string;
  /**
   * A single screen rather than a department, opened directly. Kept for the
   * few tiles that are genuinely one screen; a department must use `group` so
   * its tile cannot silently become a shortcut to one of its screens again.
   */
  href?: string;
};

/**
 * Where a tile goes.
 *
 * A department's URL is derived, never written here — `departmentPath` is the
 * one place that shape exists, shared with the breadcrumb, so a tile cannot
 * point somewhere the rest of the app does not recognise.
 */
function moduleHref(mod: ModuleCard): string {
  return mod.group ? departmentPath(mod.group) : (mod.href ?? "/");
}

/**
 * The launcher grid.
 *
 * Every department tile now names its department and nothing else. It used to
 * carry a hand-written href, and each one had drifted to whichever screen the
 * department happened to open with — usually its dashboard. That answered "how
 * is this department doing" when the question a launcher asks is "what can I
 * do here", and it made the dashboard the department's only visible screen.
 * The tile opens the department's workspace instead, which lists the
 * department's screens from the navigation SSOT; the dashboard is one of them.
 *
 * The home tile is gone from this grid. Home is the grid — a tile leading back
 * to the page you are on is not a way in to anything. Its route and its place
 * in the top navigation are untouched.
 *
 * General Administration leads, taking the slot the home tile held.
 */
export const MODULES: ModuleCard[] = [
  { titleKey: "home.mod.general_admin", icon: Briefcase, group: "nav.group.general_admin", accent: 9, countKey: "general_admin" },
  // The cross-company dashboard: one screen, not a department, so it opens
  // directly. Accent 0, the identity blue, marks it as a system entry.
  { titleKey: "nav.dashboard", icon: LayoutDashboard, href: "/dashboard", accent: 0 },
  { titleKey: "home.mod.real_estate", icon: Building, group: "nav.group.real_estate", accent: 0, countKey: "real_estate" },
  { titleKey: "home.mod.sales", icon: Users, group: "nav.group.sales_crm", accent: 1, countKey: "crm" },
  { titleKey: "home.mod.finance", icon: Calculator, group: "nav.group.finance_parent", accent: 2, countKey: "finance" },
  { titleKey: "home.mod.procurement", icon: ShoppingCart, group: "nav.group.procurement", accent: 3, countKey: "procurement" },
  { titleKey: "home.mod.engineering", icon: Compass, group: "nav.group.engineering", accent: 4 },
  { titleKey: "home.mod.hr", icon: UserCog, group: "nav.group.hr", accent: 5, countKey: "hr" },
  { titleKey: "nav.group.contracts", icon: FileSignature, group: "nav.group.contracts", accent: 3 },
  { titleKey: "home.mod.legal", icon: Scale, group: "nav.group.legal", accent: 6, countKey: "legal" },
  { titleKey: "home.mod.customer_service", icon: MessageSquare, group: "nav.group.customer_service", accent: 7, countKey: "customer_service" },
  { titleKey: "home.mod.land_bank", icon: LandPlot, group: "nav.group.land_bank", accent: 8 },
  { titleKey: "home.mod.marketing", icon: Megaphone, group: "nav.group.marketing", accent: 10, countKey: "marketing" },
  { titleKey: "home.mod.insurance", icon: ShieldCheck, group: "nav.group.insurance", accent: 11, countKey: "insurance" },
  // Two screens that earn a tile of their own without being departments. Each
  // also appears inside the department that owns it — Administration and
  // Business Intelligence — so this is a shortcut to one screen, not a second
  // copy of it.
  { titleKey: "home.mod.notifications", icon: Bell, href: "/notifications", accent: 12, countKey: "notifications" },
  { titleKey: "home.mod.executive_oversight", icon: Gauge, href: "/executive-oversight", accent: 13 },
  { titleKey: "home.mod.reports", icon: BarChart3, group: "nav.group.business_intelligence", accent: 14 },
  { titleKey: "home.mod.administration", icon: Settings, group: "nav.group.administration", accent: 15 },
  { titleKey: "home.mod.edms", icon: FolderArchive, group: "nav.group.edms", accent: 16 },
  { titleKey: "home.mod.system_administration", icon: Database, group: "nav.group.system_administration", accent: 17 },
];

function formatCount(value?: number | string): string {
  if (value === undefined || value === null) return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString("en-US");
}

function formatMoney(value?: number | string): string {
  if (value === undefined || value === null) return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default function Home() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const params = { companyId };
  const enabled = !!companyId;

  const { data: re, isLoading: reLoading } = useGetRealEstateDashboard(params, {
    query: { enabled, queryKey: getGetRealEstateDashboardQueryKey(params) },
  });
  const { data: fin, isLoading: finLoading } = useGetFinanceDashboard(params, {
    query: { enabled, queryKey: getGetFinanceDashboardQueryKey(params) },
  });
  const { data: hr, isLoading: hrLoading } = useGetHrDashboard(params, {
    query: { enabled, queryKey: getGetHrDashboardQueryKey(params) },
  });
  const { data: legal, isLoading: legalLoading } = useGetLegalDashboard(params, {
    query: { enabled, queryKey: getGetLegalDashboardQueryKey(params) },
  });
  const { data: proc, isLoading: procLoading } = useGetProcurementDashboard(params, {
    query: { enabled, queryKey: getGetProcurementDashboardQueryKey(params) },
  });
  const { data: cs, isLoading: csLoading } = useGetCustomerServiceDashboard(params, {
    query: { enabled, queryKey: getGetCustomerServiceDashboardQueryKey(params) },
  });
  const { data: ga, isLoading: gaLoading } = useGetGeneralAdminDashboard(params, {
    query: { enabled, queryKey: getGetGeneralAdminDashboardQueryKey(params) },
  });
  const { data: ins, isLoading: insLoading } = useGetInsuranceDashboard(params, {
    query: { enabled, queryKey: getGetInsuranceDashboardQueryKey(params) },
  });
  const { data: notif, isLoading: notifLoading } = useGetNotificationsDashboard(params, {
    query: { enabled, queryKey: getGetNotificationsDashboardQueryKey(params) },
  });
  const { data: mk, isLoading: mkLoading } = useGetMarketingDashboard(params, {
    query: { enabled, queryKey: getGetMarketingDashboardQueryKey(params) },
  });

  const [query, setQuery] = useState("");

  useEffect(() => {
    setQuery("");
  }, [language]);

  const counts: Record<CountKey, { value?: number; loading: boolean }> = {
    real_estate: { value: re?.units, loading: reLoading || !enabled },
    crm: { value: re?.customers, loading: reLoading || !enabled },
    finance: { value: fin?.receipts, loading: finLoading || !enabled },
    procurement: { value: proc?.suppliersCount, loading: procLoading || !enabled },
    hr: { value: hr?.employeesCount, loading: hrLoading || !enabled },
    legal: { value: legal?.contractsCount, loading: legalLoading || !enabled },
    customer_service: { value: cs?.complaints, loading: csLoading || !enabled },
    general_admin: { value: ga?.tasksCount, loading: gaLoading || !enabled },
    insurance: { value: ins?.insuredCount, loading: insLoading || !enabled },
    notifications: { value: notif?.unread, loading: notifLoading || !enabled },
    marketing: { value: mk?.campaignsCount, loading: mkLoading || !enabled },
  };

  const apps = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Accent is read off the module record, so it survives search, sorting,
    // filtering and pagination — the tile a user learned to look for keeps its
    // colour no matter what order it is rendered in.
    const mapped = MODULES.map((mod) => ({
      ...mod,
      href: moduleHref(mod),
      label: t(mod.titleKey),
      chipClassName: accentChipClass(mod.accent),
      barClassName: accentBarClass(mod.accent),
      surfaceClassName: accentSurfaceClass(mod.accent),
    }));
    if (!q) return mapped;
    return mapped.filter((mod) => mod.label.toLowerCase().includes(q));
  }, [query, t]);

  if (!user) return null;

  const kpis: { label: string; value: string; icon: LucideIcon; loading: boolean }[] = [
    { label: t("home.kpi.customers"), value: formatCount(re?.customers), icon: Users, loading: reLoading || !enabled },
    { label: t("home.kpi.units"), value: formatCount(re?.units), icon: HomeIcon, loading: reLoading || !enabled },
    { label: t("home.kpi.contracts"), value: formatCount(re?.contracts), icon: FileSignature, loading: reLoading || !enabled },
    { label: t("home.kpi.total_sales"), value: formatMoney(fin?.totalSales), icon: TrendingUp, loading: finLoading || !enabled },
    { label: t("home.kpi.total_collections"), value: formatMoney(fin?.totalCollections), icon: CircleDollarSign, loading: finLoading || !enabled },
    { label: t("home.kpi.projects"), value: formatCount(re?.projects), icon: Building, loading: reLoading || !enabled },
  ];

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Apps launcher header + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title={t("home.apps_heading")}
          description={`${t("home.welcome")}${user.fullName}`}
          bordered={false}
        />
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground rtl:left-auto rtl:right-3" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("home.search_placeholder")}
            className="h-9 ps-9 rtl:ps-3 rtl:pe-9"
          />
        </div>
      </div>

      {/* Odoo-style app tiles */}
      {apps.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("home.no_apps")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {apps.map((mod) => (
            // The link owns focus and the focus ring; the card owns the
            // surface. Both must share a radius or the ring cuts the corners.
            <Link
              key={mod.titleKey}
              href={mod.href}
              className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {/* The module owns its whole card: a soft tinted surface and a
                  matching border, then the solid accent bar and icon chip on
                  top. Text stays on `--foreground` because the tint sits at a
                  tenth of the hue — close enough to the canvas that contrast is
                  the same as it was on a white card. */}
              <Card
                interactive
                className={`relative flex h-full flex-col gap-2 overflow-hidden p-3 ${mod.surfaceClassName}`}
              >
                <span
                  aria-hidden
                  className={`absolute inset-y-0 start-0 w-1 transition-all group-hover:w-1.5 ${mod.barClassName}`}
                />

                <div className="flex items-start gap-2.5 ps-1.5">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md shadow-sm ${mod.chipClassName}`}
                  >
                    <mod.icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold leading-tight text-foreground">
                    {mod.label}
                  </span>
                </div>

                {mod.countKey ? (
                  <div className="mt-auto flex items-baseline gap-1.5 ps-1.5">
                    {counts[mod.countKey].loading ? (
                      <Skeleton className="h-5 w-12" />
                    ) : (
                      <span className="text-lg font-bold leading-none tabular-nums text-foreground">
                        {formatCount(counts[mod.countKey].value)}
                      </span>
                    )}
                    <span className="text-2xs text-muted-foreground">{t("common.total")}</span>
                  </div>
                ) : null}
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Compact KPI strip */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("home.kpis_heading")}
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {kpis.map((kpi) => (
            <KpiCard
              key={kpi.label}
              label={kpi.label}
              value={kpi.value}
              icon={kpi.icon}
              isLoading={kpi.loading}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
