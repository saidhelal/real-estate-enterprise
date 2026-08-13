import { useAuth } from "@/lib/auth-provider";
import { PageHeader } from "@/components/ui/page-header";
import { useLanguage } from "@/lib/language-provider";
import { Link } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { accentClass } from "@/lib/design-tokens";
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
  href: string;
  /**
   * Which entry of the shared categorical ramp this module owns. Declared per
   * module rather than derived from array position, so inserting or reordering
   * a module never recolours the ones after it — a module keeps its accent for
   * as long as it exists. Repeats past the eighth are deliberate: the icon is
   * the identifier here, the colour only helps the eye group things.
   */
  accent: number;
  countKey?: CountKey;
};

const MODULES: ModuleCard[] = [
  { titleKey: "home.mod.real_estate", icon: Building, href: "/projects", accent: 0, countKey: "real_estate" },
  { titleKey: "home.mod.sales", icon: Users, href: "/customers", accent: 1, countKey: "crm" },
  { titleKey: "home.mod.finance", icon: Calculator, href: "/accounting-dashboard", accent: 2, countKey: "finance" },
  { titleKey: "home.mod.procurement", icon: ShoppingCart, href: "/procurement-dashboard", accent: 3, countKey: "procurement" },
  { titleKey: "home.mod.engineering", icon: Compass, href: "/engineering-dashboard", accent: 4 },
  { titleKey: "home.mod.hr", icon: UserCog, href: "/hr-dashboard", accent: 5, countKey: "hr" },
  { titleKey: "home.mod.legal", icon: Scale, href: "/legal-dashboard", accent: 6, countKey: "legal" },
  { titleKey: "home.mod.customer_service", icon: MessageSquare, href: "/customer-service-dashboard", accent: 7, countKey: "customer_service" },
  { titleKey: "home.mod.land_bank", icon: LandPlot, href: "/land-bank-dashboard", accent: 8 },
  { titleKey: "home.mod.general_admin", icon: Briefcase, href: "/general-admin-dashboard", accent: 9, countKey: "general_admin" },
  { titleKey: "home.mod.marketing", icon: Megaphone, href: "/marketing-dashboard", accent: 10, countKey: "marketing" },
  { titleKey: "home.mod.insurance", icon: ShieldCheck, href: "/insurance-dashboard", accent: 11, countKey: "insurance" },
  { titleKey: "home.mod.notifications", icon: Bell, href: "/notifications", accent: 12, countKey: "notifications" },
  { titleKey: "home.mod.executive_oversight", icon: Gauge, href: "/executive-oversight", accent: 13 },
  { titleKey: "home.mod.reports", icon: BarChart3, href: "/executive-dashboard", accent: 14 },
  { titleKey: "home.mod.administration", icon: Settings, href: "/settings", accent: 15 },
  { titleKey: "home.mod.edms", icon: FolderArchive, href: "/documents-dashboard", accent: 16 },
  { titleKey: "home.mod.system_administration", icon: Database, href: "/master-data", accent: 17 },
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
      label: t(mod.titleKey),
      accentClassName: accentClass(mod.accent),
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
              className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Card
                interactive
                className="flex h-full flex-col items-center gap-3 p-4 text-center"
              >
                <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${mod.accentClassName}`}>
                  <mod.icon className="h-6 w-6" />
                </span>
                <span className="text-sm font-medium leading-snug text-foreground">
                  {mod.label}
                </span>
                {mod.countKey ? (
                  counts[mod.countKey].loading ? (
                    <Skeleton className="h-4 w-10" />
                  ) : (
                    <span className="text-base font-semibold tabular-nums text-foreground">
                      {formatCount(counts[mod.countKey].value)}
                    </span>
                  )
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
