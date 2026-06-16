import { useAuth } from "@/lib/auth-provider";
import { Link } from "wouter";
import {
  useGetRealEstateDashboard,
  useGetFinanceDashboard,
} from "@workspace/api-client-react";
import {
  Building,
  Users,
  Receipt,
  Calculator,
  Landmark,
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

type SubModule = { label: string; href: string };
type ModuleCard = {
  title: string;
  icon: LucideIcon;
  href: string;
  items: SubModule[];
};

const MODULES: ModuleCard[] = [
  {
    title: "العقارات والمشروعات",
    icon: Building,
    href: "/projects",
    items: [
      { label: "المشروعات", href: "/projects" },
      { label: "المراحل", href: "/phases" },
      { label: "المباني", href: "/buildings" },
      { label: "الأدوار", href: "/floors" },
      { label: "الوحدات", href: "/units" },
      { label: "أنواع الوحدات", href: "/unit-types" },
      { label: "حالات الوحدات", href: "/unit-statuses" },
      { label: "قوائم الأسعار", href: "/unit-price-lists" },
      { label: "تسعير الوحدات", href: "/unit-pricing" },
      { label: "خصومات الوحدات", href: "/unit-discounts" },
    ],
  },
  {
    title: "المبيعات والعملاء",
    icon: Users,
    href: "/customers",
    items: [
      { label: "العملاء المحتملون", href: "/leads" },
      { label: "مصادر العملاء", href: "/lead-sources" },
      { label: "العملاء", href: "/customers" },
      { label: "جهات اتصال العملاء", href: "/customer-contacts" },
      { label: "الحجوزات", href: "/reservations" },
      { label: "دفعات الحجز", href: "/reservation-payments" },
      { label: "العقود", href: "/contracts" },
      { label: "تعديلات العقود", href: "/contract-amendments" },
      { label: "إلغاء العقود", href: "/contract-cancellations" },
      { label: "تحويلات الوحدات", href: "/unit-transfers" },
    ],
  },
  {
    title: "الأقساط والتحصيلات",
    icon: Receipt,
    href: "/installment-schedules",
    items: [
      { label: "سندات القبض", href: "/receipts" },
      { label: "خطط الأقساط", href: "/installment-plans" },
      { label: "جداول الأقساط", href: "/installment-schedules" },
      { label: "تحصيل الأقساط", href: "/installment-collections" },
      { label: "قواعد الغرامات", href: "/penalty-rules" },
    ],
  },
  {
    title: "الإدارة المالية والحسابات",
    icon: Calculator,
    href: "/accounting-dashboard",
    items: [
      { label: "لوحة المحاسبة", href: "/accounting-dashboard" },
      { label: "دليل الحسابات", href: "/accounts" },
      { label: "القيود اليومية", href: "/journal-entries" },
      { label: "الأستاذ العام", href: "/general-ledger" },
      { label: "ميزان المراجعة", href: "/trial-balance" },
      { label: "الميزانية العمومية", href: "/balance-sheet" },
      { label: "قائمة الدخل", href: "/income-statement" },
      { label: "التدفقات النقدية", href: "/cash-flow" },
      { label: "الفترات المالية", href: "/fiscal-periods" },
      { label: "التقارير المالية", href: "/financial-reports" },
    ],
  },
  {
    title: "الخزينة والبنوك",
    icon: Landmark,
    href: "/cashboxes",
    items: [
      { label: "الخزائن", href: "/cashboxes" },
      { label: "حركات الخزينة", href: "/treasury-transactions" },
      { label: "الحسابات البنكية", href: "/bank-accounts" },
      { label: "الحركات البنكية", href: "/bank-transactions" },
      { label: "الشيكات", href: "/cheques" },
      { label: "تقارير الشيكات", href: "/cheque-reports" },
      { label: "الغرامات", href: "/penalties" },
    ],
  },
  {
    title: "المشتريات والمخازن",
    icon: ShoppingCart,
    href: "/procurement-dashboard",
    items: [
      { label: "لوحة المشتريات", href: "/procurement-dashboard" },
      { label: "الموردون", href: "/suppliers" },
      { label: "طلبات الشراء", href: "/purchase-requests" },
      { label: "طلبات عروض الأسعار", href: "/rfqs" },
      { label: "أوامر الشراء", href: "/purchase-orders" },
      { label: "أوامر التوريد", href: "/goods-receipt-notes" },
      { label: "المخازن", href: "/warehouses" },
      { label: "أصناف المخزون", href: "/inventory-items" },
      { label: "حركة المخزون", href: "/inventory-ledger" },
      { label: "تقارير المخزون", href: "/inventory-reports" },
    ],
  },
  {
    title: "الهندسة والتنفيذ",
    icon: Compass,
    href: "/engineering-dashboard",
    items: [
      { label: "لوحة الهندسة", href: "/engineering-dashboard" },
      { label: "الاستشاريون", href: "/consultants" },
      { label: "حزم التصميم", href: "/design-packages" },
      { label: "الرسومات", href: "/drawings" },
      { label: "جداول الكميات", href: "/boqs" },
      { label: "تقديرات التكلفة", href: "/cost-estimates" },
      { label: "طلبات الفحص", href: "/inspection-requests" },
      { label: "العيوب", href: "/defects" },
      { label: "طلبات المعلومات", href: "/rfis" },
      { label: "تقدم الأعمال", href: "/engineering-progress" },
    ],
  },
  {
    title: "المقاولون والتنفيذ",
    icon: HardHat,
    href: "/construction-dashboard",
    items: [
      { label: "لوحة التنفيذ", href: "/construction-dashboard" },
      { label: "المقاولون", href: "/contractors" },
      { label: "عقود المقاولين", href: "/contractor-contracts" },
      { label: "تحديثات التقدم", href: "/work-progress-updates" },
      { label: "شهادات الدفع", href: "/payment-certificates" },
      { label: "أوامر التغيير", href: "/variation-orders" },
      { label: "الدفعات المقدمة", href: "/advance-payments" },
      { label: "فواتير المقاولين", href: "/contractor-invoices" },
      { label: "تقارير التنفيذ", href: "/construction-reports" },
    ],
  },
  {
    title: "الموارد البشرية",
    icon: UserCog,
    href: "/hr-dashboard",
    items: [
      { label: "لوحة الموارد البشرية", href: "/hr-dashboard" },
      { label: "الأقسام", href: "/departments" },
      { label: "المسميات الوظيفية", href: "/job-titles" },
      { label: "الموظفون", href: "/employees" },
      { label: "الحضور والانصراف", href: "/attendance" },
      { label: "طلبات الإجازات", href: "/leave-requests" },
      { label: "مسيرات الرواتب", href: "/payroll-runs" },
      { label: "قسائم الرواتب", href: "/payslips" },
      { label: "التقييمات", href: "/employee-evaluations" },
      { label: "تقارير الموارد البشرية", href: "/hr-reports" },
    ],
  },
  {
    title: "الشؤون القانونية",
    icon: Scale,
    href: "/legal-dashboard",
    items: [
      { label: "لوحة الشؤون القانونية", href: "/legal-dashboard" },
      { label: "العقود القانونية", href: "/legal-contracts" },
      { label: "قوالب العقود", href: "/contract-templates" },
      { label: "مكاتب المحاماة", href: "/law-firms" },
      { label: "المستشارون القانونيون", href: "/legal-advisors" },
      { label: "القضايا", href: "/legal-cases" },
      { label: "الجلسات", href: "/legal-hearings" },
      { label: "المطالبات", href: "/legal-claims" },
      { label: "الإنذارات", href: "/legal-notices" },
      { label: "التقارير القانونية", href: "/legal-reports" },
    ],
  },
  {
    title: "خدمة العملاء",
    icon: MessageSquare,
    href: "/customer-service-dashboard",
    items: [
      { label: "لوحة خدمة العملاء", href: "/customer-service-dashboard" },
      { label: "سياسات مستوى الخدمة", href: "/sla-policies" },
      { label: "التصعيدات", href: "/service-escalations" },
      { label: "تقارير خدمة العملاء", href: "/customer-service-reports" },
    ],
  },
  {
    title: "بنك الأراضي",
    icon: LandPlot,
    href: "/land-bank-dashboard",
    items: [
      { label: "لوحة بنك الأراضي", href: "/land-bank-dashboard" },
      { label: "قطع الأراضي", href: "/land-parcels" },
      { label: "الملكيات", href: "/land-ownerships" },
      { label: "الأوضاع القانونية", href: "/land-legal-statuses" },
      { label: "الاستخدامات", href: "/land-utilizations" },
      { label: "المستندات", href: "/land-documents" },
      { label: "عمليات الاستحواذ", href: "/land-acquisitions" },
      { label: "تقارير بنك الأراضي", href: "/land-bank-reports" },
    ],
  },
  {
    title: "التسليم وخدمة ما بعد البيع",
    icon: PackageCheck,
    href: "/handover-dashboard",
    items: [
      { label: "لوحة التسليم", href: "/handover-dashboard" },
      { label: "طلبات التسليم", href: "/handover-requests" },
      { label: "جداول التسليم", href: "/handover-schedules" },
      { label: "قوائم الفحص", href: "/handover-checklist-items" },
      { label: "محاضر التسليم", href: "/handover-minutes" },
      { label: "الملاحظات", href: "/handover-snags" },
      { label: "اعتمادات التسليم", href: "/handover-approvals" },
      { label: "تقارير التسليم", href: "/handover-reports" },
    ],
  },
  {
    title: "التقارير وذكاء الأعمال",
    icon: BarChart3,
    href: "/executive-dashboard",
    items: [
      { label: "اللوحة التنفيذية", href: "/executive-dashboard" },
      { label: "تحليلات المبيعات", href: "/sales-analytics" },
      { label: "تحليلات التحصيل", href: "/collection-analytics" },
      { label: "تحليلات التنفيذ", href: "/construction-analytics" },
      { label: "تحليلات المشتريات", href: "/procurement-analytics" },
      { label: "تحليلات المخزون", href: "/inventory-analytics" },
      { label: "تحليلات الموارد البشرية", href: "/hr-analytics" },
      { label: "التحليلات المالية", href: "/financial-analytics" },
      { label: "محرك التقارير", href: "/reports-engine" },
    ],
  },
  {
    title: "الإدارة والإعدادات",
    icon: Settings,
    href: "/settings",
    items: [
      { label: "المستخدمون", href: "/users" },
      { label: "الأدوار والصلاحيات", href: "/roles" },
      { label: "الشركات", href: "/companies" },
      { label: "الفروع", href: "/branches" },
      { label: "السنوات المالية", href: "/fiscal-years" },
      { label: "العملات", href: "/currencies" },
      { label: "تسلسل الأرقام", href: "/number-sequences" },
      { label: "سجل التدقيق", href: "/audit-logs" },
      { label: "سجل الدخول", href: "/login-history" },
      { label: "الإعدادات", href: "/settings" },
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
  const { data: re, isLoading: reLoading } = useGetRealEstateDashboard();
  const { data: fin, isLoading: finLoading } = useGetFinanceDashboard();

  if (!user) return null;

  const kpis: { label: string; value: string; icon: LucideIcon; loading: boolean }[] = [
    { label: "عدد العملاء", value: formatCount(re?.customers), icon: Users, loading: reLoading },
    { label: "عدد الوحدات", value: formatCount(re?.units), icon: HomeIcon, loading: reLoading },
    { label: "عدد العقود", value: formatCount(re?.contracts), icon: FileSignature, loading: reLoading },
    { label: "إجمالي المبيعات", value: formatMoney(fin?.totalSales), icon: TrendingUp, loading: finLoading },
    { label: "إجمالي التحصيلات", value: formatMoney(fin?.totalCollections), icon: CircleDollarSign, loading: finLoading },
    { label: "عدد المشروعات", value: formatCount(re?.projects), icon: Building, loading: reLoading },
  ];

  return (
    <div
      dir="rtl"
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
              نظام تخطيط موارد المؤسسة
            </p>
            <h1 className="text-4xl font-extrabold leading-tight text-white md:text-5xl">
              اللوحة الرئيسية التنفيذية
            </h1>
            <p className="mt-3 text-base font-medium text-slate-400 md:text-lg">
              مرحباً، {user.fullName}
            </p>
          </header>

          {/* KPI strip */}
          <section className="mb-12 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
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
          </section>

          {/* Module cards */}
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {MODULES.map((mod) => (
              <div
                key={mod.title}
                className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-xl shadow-black/20 transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/40 hover:bg-white/[0.06]"
              >
                <Link
                  href={mod.href}
                  className="mb-5 flex items-center gap-4"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-500/5 text-amber-300 ring-1 ring-amber-400/20 transition-colors group-hover:text-amber-200">
                    <mod.icon className="h-6 w-6" />
                  </span>
                  <h2 className="text-2xl font-extrabold leading-tight text-white transition-colors group-hover:text-amber-200">
                    {mod.title}
                  </h2>
                </Link>

                <ul className="grid grid-cols-1 gap-x-5 gap-y-2.5 sm:grid-cols-2">
                  {mod.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-2 text-[15px] font-bold text-slate-300 transition-colors hover:text-amber-300"
                      >
                        <span className="text-amber-400/70">•</span>
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
