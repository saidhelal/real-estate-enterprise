import { useAuth } from "@/lib/auth-provider";
import { useLanguage } from "@/lib/language-provider";
import { Link } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  useGetRealEstateDashboard,
  useGetFinanceDashboard,
  useGetHrDashboard,
  useGetLegalDashboard,
  useGetProcurementDashboard,
  useGetCustomerServiceDashboard,
  useGetGeneralAdminDashboard,
  useListCompanies,
  getGetRealEstateDashboardQueryKey,
  getGetFinanceDashboardQueryKey,
  getGetHrDashboardQueryKey,
  getGetLegalDashboardQueryKey,
  getGetProcurementDashboardQueryKey,
  getGetCustomerServiceDashboardQueryKey,
  getGetGeneralAdminDashboardQueryKey,
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
  Package,
  FileBox,
  Database,
  Briefcase,
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
  | "general_admin";

type ModuleCard = {
  titleKey: string;
  icon: LucideIcon;
  href: string;
  accent: string;
  countKey?: CountKey;
};

const MODULES: ModuleCard[] = [
  { titleKey: "home.mod.real_estate", icon: Building, href: "/projects", accent: "text-sky-600 bg-sky-500/10 dark:text-sky-400", countKey: "real_estate" },
  { titleKey: "home.mod.sales", icon: Users, href: "/customers", accent: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400", countKey: "crm" },
  { titleKey: "home.mod.finance", icon: Calculator, href: "/accounting-dashboard", accent: "text-amber-600 bg-amber-500/10 dark:text-amber-400", countKey: "finance" },
  { titleKey: "home.mod.procurement", icon: ShoppingCart, href: "/procurement-dashboard", accent: "text-orange-600 bg-orange-500/10 dark:text-orange-400", countKey: "procurement" },
  { titleKey: "home.mod.inventory", icon: Package, href: "/inventory-dashboard", accent: "text-teal-600 bg-teal-500/10 dark:text-teal-400" },
  { titleKey: "home.mod.engineering", icon: Compass, href: "/engineering-dashboard", accent: "text-cyan-600 bg-cyan-500/10 dark:text-cyan-400" },
  { titleKey: "home.mod.construction", icon: HardHat, href: "/construction-dashboard", accent: "text-yellow-600 bg-yellow-500/10 dark:text-yellow-400" },
  { titleKey: "home.mod.hr", icon: UserCog, href: "/hr-dashboard", accent: "text-violet-600 bg-violet-500/10 dark:text-violet-400", countKey: "hr" },
  { titleKey: "home.mod.legal", icon: Scale, href: "/legal-dashboard", accent: "text-indigo-600 bg-indigo-500/10 dark:text-indigo-400", countKey: "legal" },
  { titleKey: "home.mod.customer_service", icon: MessageSquare, href: "/customer-service-dashboard", accent: "text-rose-600 bg-rose-500/10 dark:text-rose-400", countKey: "customer_service" },
  { titleKey: "home.mod.land_bank", icon: LandPlot, href: "/land-bank-dashboard", accent: "text-lime-600 bg-lime-500/10 dark:text-lime-400" },
  { titleKey: "home.mod.fixed_assets", icon: FileBox, href: "/fixed-assets-dashboard", accent: "text-stone-600 bg-stone-500/10 dark:text-stone-300" },
  { titleKey: "home.mod.general_admin", icon: Briefcase, href: "/general-admin-dashboard", accent: "text-blue-600 bg-blue-500/10 dark:text-blue-400", countKey: "general_admin" },
  { titleKey: "home.mod.reports", icon: BarChart3, href: "/executive-dashboard", accent: "text-fuchsia-600 bg-fuchsia-500/10 dark:text-fuchsia-400" },
  { titleKey: "home.mod.administration", icon: Settings, href: "/settings", accent: "text-slate-600 bg-slate-500/10 dark:text-slate-300" },
  { titleKey: "home.mod.system_administration", icon: Database, href: "/master-data", accent: "text-zinc-600 bg-zinc-500/10 dark:text-zinc-300" },
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
  };

  const apps = useMemo(() => {
    const q = query.trim().toLowerCase();
    const mapped = MODULES.map((mod) => ({ ...mod, label: t(mod.titleKey) }));
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
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t("home.apps_heading")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("home.welcome")}{user.fullName}
          </p>
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground rtl:left-auto rtl:right-3" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("home.search_placeholder")}
            className="h-9 pl-9 rtl:pl-3 rtl:pr-9"
          />
        </div>
      </div>

      {/* Odoo-style app tiles */}
      {apps.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("home.no_apps")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {apps.map((mod) => (
            <Link
              key={mod.titleKey}
              href={mod.href}
              className="group flex flex-col items-center gap-3 rounded-lg border bg-card p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${mod.accent}`}>
                <mod.icon className="h-6 w-6" />
              </span>
              <span className="text-sm font-medium leading-snug text-foreground">
                {mod.label}
              </span>
              {mod.countKey ? (
                counts[mod.countKey].loading ? (
                  <span className="inline-block h-4 w-10 animate-pulse rounded bg-muted" />
                ) : (
                  <span className="text-base font-semibold tabular-nums text-foreground">
                    {formatCount(counts[mod.countKey].value)}
                  </span>
                )
              ) : null}
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
            <div
              key={kpi.label}
              className="rounded-lg border bg-card p-3 shadow-sm"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-muted-foreground">{kpi.label}</span>
                <kpi.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
              <div className="text-xl font-semibold tracking-tight">
                {kpi.loading ? (
                  <span className="inline-block h-6 w-16 animate-pulse rounded bg-muted" />
                ) : (
                  kpi.value
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
