import { useAuth } from "@/lib/auth-provider";
import { useLanguage } from "@/lib/language-provider";
import { Link } from "wouter";
import {
  useGetRealEstateDashboard,
  useGetFinanceDashboard,
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
  PackageCheck,
  BarChart3,
  Settings,
  Home as HomeIcon,
  FileSignature,
  TrendingUp,
  CircleDollarSign,
  type LucideIcon,
} from "lucide-react";

type ModuleCard = {
  titleKey: string;
  icon: LucideIcon;
  href: string;
  itemKeys: string[];
};

const MODULES: ModuleCard[] = [
  {
    titleKey: "home.mod.real_estate",
    icon: Building,
    href: "/projects",
    itemKeys: [
      "home.item.projects",
      "home.item.phases",
      "home.item.buildings",
      "home.item.floors",
      "home.item.units",
      "home.item.unit_types",
      "home.item.unit_statuses",
      "home.item.pricing",
      "home.item.price_lists",
    ],
  },
  {
    titleKey: "home.mod.sales",
    icon: Users,
    href: "/customers",
    itemKeys: [
      "home.item.crm",
      "home.item.customers",
      "home.item.contacts",
      "home.item.leads",
      "home.item.reservations",
      "home.item.contracts",
      "home.item.amendments",
      "home.item.cancellations",
      "home.item.transfers",
    ],
  },
  {
    titleKey: "home.mod.finance",
    icon: Calculator,
    href: "/accounting-dashboard",
    itemKeys: [
      "home.item.chart_of_accounts",
      "home.item.journal_entries",
      "home.item.general_ledger",
      "home.item.accounts_receivable",
      "home.item.accounts_payable",
      "home.item.customers",
      "home.item.suppliers",
      "home.item.cost_centers",
      "home.item.budgets",
      "home.item.financial_reports",
      "home.item.installments",
      "home.item.installment_schedules",
      "home.item.collections",
      "home.item.receipt_vouchers",
      "home.item.payment_vouchers",
      "home.item.cashboxes",
      "home.item.banks",
      "home.item.cheques",
      "home.item.bank_transfers",
      "home.item.bank_reconciliations",
    ],
  },
  {
    titleKey: "home.mod.procurement",
    icon: ShoppingCart,
    href: "/procurement-dashboard",
    itemKeys: [
      "home.item.suppliers",
      "home.item.purchase_requests",
      "home.item.quotations",
      "home.item.purchase_orders",
      "home.item.contracts",
      "home.item.warehouses",
      "home.item.items",
      "home.item.inventory",
      "home.item.stock_movements",
    ],
  },
  {
    titleKey: "home.mod.engineering",
    icon: Compass,
    href: "/engineering-dashboard",
    itemKeys: [
      "home.item.bills_of_quantities",
      "home.item.boq_items",
      "home.item.estimates",
      "home.item.inspection_requests",
      "home.item.inspection_reports",
      "home.item.defects",
      "home.item.corrective_actions",
      "home.item.information_requests",
      "home.item.technical_submittals",
    ],
  },
  {
    titleKey: "home.mod.construction",
    icon: HardHat,
    href: "/construction-dashboard",
    itemKeys: [
      "home.item.contractors",
      "home.item.contractor_contracts",
      "home.item.progress_claims",
      "home.item.change_orders",
      "home.item.advance_payments",
      "home.item.invoices",
      "home.item.execution_reports",
    ],
  },
  {
    titleKey: "home.mod.hr",
    icon: UserCog,
    href: "/hr-dashboard",
    itemKeys: [
      "home.item.departments",
      "home.item.sections",
      "home.item.employees",
      "home.item.attendance",
      "home.item.leaves",
      "home.item.payroll",
      "home.item.advances",
      "home.item.loans",
      "home.item.evaluations",
    ],
  },
  {
    titleKey: "home.mod.legal",
    icon: Scale,
    href: "/legal-dashboard",
    itemKeys: [
      "home.item.legal_contracts",
      "home.item.cases",
      "home.item.hearings",
      "home.item.claims",
      "home.item.notices",
      "home.item.advisors",
      "home.item.law_firms",
    ],
  },
  {
    titleKey: "home.mod.customer_service",
    icon: MessageSquare,
    href: "/customer-service-dashboard",
    itemKeys: [
      "home.item.complaints",
      "home.item.tickets",
      "home.item.requests",
      "home.item.maintenance",
      "home.item.technical_support",
    ],
  },
  {
    titleKey: "home.mod.land_bank",
    icon: LandPlot,
    href: "/land-bank-dashboard",
    itemKeys: [
      "home.item.land_parcels",
      "home.item.ownerships",
      "home.item.legal_status",
      "home.item.utilization",
      "home.item.documents",
    ],
  },
  {
    titleKey: "home.mod.handover",
    icon: PackageCheck,
    href: "/handover-dashboard",
    itemKeys: [
      "home.item.handover_requests",
      "home.item.final_inspection",
      "home.item.snags",
      "home.item.handover_minutes",
      "home.item.handover_closure",
    ],
  },
  {
    titleKey: "home.mod.reports",
    icon: BarChart3,
    href: "/executive-dashboard",
    itemKeys: [
      "home.item.executive_dashboard",
      "home.item.kpis",
      "home.item.financial_analytics",
      "home.item.sales_analytics",
      "home.item.project_analytics",
      "home.item.hr_analytics",
    ],
  },
  {
    titleKey: "home.mod.administration",
    icon: Settings,
    href: "/settings",
    itemKeys: [
      "home.item.users",
      "home.item.permissions",
      "home.item.branches",
      "home.item.companies",
      "home.item.currencies",
      "home.item.fiscal_years",
      "home.item.general_settings",
    ],
  },
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
  const { t, dir } = useLanguage();
  const { data: re, isLoading: reLoading } = useGetRealEstateDashboard();
  const { data: fin, isLoading: finLoading } = useGetFinanceDashboard();

  if (!user) return null;

  const kpis: { label: string; value: string; icon: LucideIcon; loading: boolean }[] = [
    { label: t("home.kpi.customers"), value: formatCount(re?.customers), icon: Users, loading: reLoading },
    { label: t("home.kpi.units"), value: formatCount(re?.units), icon: HomeIcon, loading: reLoading },
    { label: t("home.kpi.contracts"), value: formatCount(re?.contracts), icon: FileSignature, loading: reLoading },
    { label: t("home.kpi.total_sales"), value: formatMoney(fin?.totalSales), icon: TrendingUp, loading: finLoading },
    { label: t("home.kpi.total_collections"), value: formatMoney(fin?.totalCollections), icon: CircleDollarSign, loading: finLoading },
    { label: t("home.kpi.projects"), value: formatCount(re?.projects), icon: Building, loading: reLoading },
  ];

  return (
    <div
      dir={dir}
      className="-m-4 md:-m-6 min-h-[calc(100vh-3.5rem)] lg:min-h-[calc(100vh-60px)] bg-[#060b1a] text-slate-100"
    >
      <div className="relative overflow-hidden">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0b1733] via-[#091126] to-[#060b1a]" />
        <div className="pointer-events-none absolute -top-40 right-1/4 h-96 w-96 rounded-full bg-amber-500/10 blur-[120px]" />
        <div className="pointer-events-none absolute -top-20 left-1/4 h-96 w-96 rounded-full bg-sky-500/10 blur-[120px]" />

        <div className="relative px-5 py-8 md:px-10 md:py-12">
          {/* Header */}
          <header className="mb-10">
            <p className="mb-2 text-sm font-bold tracking-[0.3em] text-amber-400/90">
              {t("home.system_label")}
            </p>
            <h1 className="text-4xl font-extrabold leading-tight text-white md:text-5xl">
              {t("home.title")}
            </h1>
            <p className="mt-3 text-base font-medium text-slate-400 md:text-lg">
              {t("home.welcome")}{user.fullName}
            </p>
          </header>

          {/* Main ERP module cards (primary focus) */}
          <section className="mb-14">
            <div className="mb-6 flex items-center gap-3">
              <span className="h-7 w-1.5 rounded-full bg-amber-400" />
              <h2 className="text-2xl font-extrabold text-white md:text-3xl">
                {t("home.sections")}
              </h2>
            </div>
            <div className="grid auto-rows-fr grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {MODULES.map((mod) => (
                <Link
                  key={mod.titleKey}
                  href={mod.href}
                  className="group flex h-full cursor-pointer flex-col rounded-2xl border border-white/[0.06] bg-[#13203b] p-7 shadow-lg shadow-black/30 transition-all duration-300 hover:scale-[1.02] hover:border-amber-400/25 hover:bg-[#182a4d] hover:shadow-2xl hover:shadow-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060b1a] md:p-8"
                >
                  <div className="mb-6 flex flex-col items-center text-center">
                    <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/15 transition-colors group-hover:text-amber-200">
                      <mod.icon className="h-7 w-7" />
                    </span>
                    <h3 className="text-2xl font-extrabold leading-snug text-white md:text-[26px]">
                      {t(mod.titleKey)}
                    </h3>
                  </div>

                  <ul className="flex flex-1 flex-col gap-2.5 border-t border-white/[0.06] pt-5">
                    {mod.itemKeys.map((itemKey) => (
                      <li
                        key={itemKey}
                        className="flex items-center gap-2.5 text-[17px] font-bold leading-relaxed text-slate-300"
                      >
                        <span className="text-amber-400/60">•</span>
                        <span>{t(itemKey)}</span>
                      </li>
                    ))}
                  </ul>
                </Link>
              ))}
            </div>
          </section>

          {/* KPI section (secondary, below modules) */}
          <section>
            <div className="mb-6 flex items-center gap-3">
              <span className="h-7 w-1.5 rounded-full bg-amber-400" />
              <h2 className="text-2xl font-extrabold text-white md:text-3xl">
                {t("home.kpis_heading")}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              {kpis.map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm transition-colors hover:border-amber-400/40"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-400">{kpi.label}</span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">
                      <kpi.icon className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="text-3xl font-extrabold tracking-tight text-white">
                    {kpi.loading ? (
                      <span className="inline-block h-8 w-20 animate-pulse rounded-md bg-white/10" />
                    ) : (
                      kpi.value
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
