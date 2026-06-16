import { useAuth } from "@/lib/auth-provider";
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
  title: string;
  icon: LucideIcon;
  href: string;
  items: string[];
};

const MODULES: ModuleCard[] = [
  {
    title: "العقارات والمشروعات",
    icon: Building,
    href: "/projects",
    items: [
      "المشروعات",
      "المراحل",
      "المباني",
      "الطوابق",
      "الوحدات",
      "أنواع الوحدات",
      "حالات الوحدات",
      "التسعير",
      "قوائم الأسعار",
    ],
  },
  {
    title: "المبيعات والعملاء",
    icon: Users,
    href: "/customers",
    items: [
      "إدارة علاقات العملاء",
      "العملاء",
      "جهات الاتصال",
      "العملاء المحتملون",
      "الحجوزات",
      "العقود",
      "التعديلات",
      "الإلغاءات",
      "التحويلات",
    ],
  },
  {
    title: "الإدارة المالية والحسابات",
    icon: Calculator,
    href: "/accounting-dashboard",
    items: [
      "دليل الحسابات",
      "القيود اليومية",
      "الحسابات العامة",
      "الذمم المدينة",
      "الذمم الدائنة",
      "العملاء",
      "الموردون",
      "مراكز التكلفة",
      "الموازنات",
      "التقارير المالية",
      "الأقساط",
      "جداول الأقساط",
      "التحصيلات",
      "إيصالات القبض",
      "سندات الصرف",
      "الخزائن",
      "البنوك",
      "الشيكات",
      "التحويلات البنكية",
      "التسويات البنكية",
    ],
  },
  {
    title: "المشتريات والمخازن",
    icon: ShoppingCart,
    href: "/procurement-dashboard",
    items: [
      "الموردون",
      "طلبات الشراء",
      "عروض الأسعار",
      "أوامر الشراء",
      "العقود",
      "المستودعات",
      "الأصناف",
      "الجرد",
      "حركات المخزون",
    ],
  },
  {
    title: "الهندسة والتنفيذ",
    icon: Compass,
    href: "/engineering-dashboard",
    items: [
      "جداول الكميات",
      "بنود الكميات",
      "التقديرات",
      "طلبات الفحص",
      "تقارير الفحص",
      "العيوب",
      "الإجراءات التصحيحية",
      "طلبات المعلومات",
      "التقديمات الفنية",
    ],
  },
  {
    title: "المقاولون والتنفيذ",
    icon: HardHat,
    href: "/construction-dashboard",
    items: [
      "المقاولون",
      "عقود المقاولين",
      "المستخلصات",
      "أوامر التغيير",
      "الدفعات المقدمة",
      "الفواتير",
      "تقارير التنفيذ",
    ],
  },
  {
    title: "الموارد البشرية",
    icon: UserCog,
    href: "/hr-dashboard",
    items: [
      "الإدارات",
      "الأقسام",
      "الموظفون",
      "الحضور",
      "الإجازات",
      "الرواتب",
      "السلف",
      "القروض",
      "التقييمات",
    ],
  },
  {
    title: "الشؤون القانونية",
    icon: Scale,
    href: "/legal-dashboard",
    items: [
      "العقود القانونية",
      "القضايا",
      "الجلسات",
      "المطالبات",
      "الإشعارات",
      "المستشارون",
      "مكاتب المحاماة",
    ],
  },
  {
    title: "خدمة العملاء",
    icon: MessageSquare,
    href: "/customer-service-dashboard",
    items: [
      "الشكاوى",
      "التذاكر",
      "الطلبات",
      "الصيانة",
      "الدعم الفني",
    ],
  },
  {
    title: "بنك الأراضي",
    icon: LandPlot,
    href: "/land-bank-dashboard",
    items: [
      "الأراضي",
      "الملكيات",
      "الموقف القانوني",
      "الاستغلال",
      "المستندات",
    ],
  },
  {
    title: "التسليم وخدمة ما بعد البيع",
    icon: PackageCheck,
    href: "/handover-dashboard",
    items: [
      "طلبات التسليم",
      "الفحص النهائي",
      "النواقص",
      "محاضر التسليم",
      "إغلاق التسليم",
    ],
  },
  {
    title: "التقارير وذكاء الأعمال",
    icon: BarChart3,
    href: "/executive-dashboard",
    items: [
      "اللوحة التنفيذية",
      "مؤشرات الأداء",
      "التحليلات المالية",
      "تحليلات المبيعات",
      "تحليلات المشروعات",
      "تحليلات الموارد البشرية",
    ],
  },
  {
    title: "الإدارة والإعدادات",
    icon: Settings,
    href: "/settings",
    items: [
      "المستخدمون",
      "الصلاحيات",
      "الفروع",
      "الشركات",
      "العملات",
      "السنوات المالية",
      "الإعدادات العامة",
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

          {/* Main ERP module cards (primary focus) */}
          <section className="mb-14">
            <div className="mb-6 flex items-center gap-3">
              <span className="h-7 w-1.5 rounded-full bg-amber-400" />
              <h2 className="text-2xl font-extrabold text-white md:text-3xl">
                الأقسام الرئيسية
              </h2>
            </div>
            <div className="grid auto-rows-fr grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {MODULES.map((mod) => (
                <Link
                  key={mod.title}
                  href={mod.href}
                  className="group flex h-full cursor-pointer flex-col rounded-2xl border border-white/[0.06] bg-[#13203b] p-7 shadow-lg shadow-black/30 transition-all duration-300 hover:scale-[1.02] hover:border-amber-400/25 hover:bg-[#182a4d] hover:shadow-2xl hover:shadow-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060b1a] md:p-8"
                >
                  <div className="mb-6 flex flex-col items-center text-center">
                    <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/15 transition-colors group-hover:text-amber-200">
                      <mod.icon className="h-7 w-7" />
                    </span>
                    <h3 className="text-2xl font-extrabold leading-snug text-white md:text-[26px]">
                      {mod.title}
                    </h3>
                  </div>

                  <ul className="flex flex-1 flex-col gap-2.5 border-t border-white/[0.06] pt-5">
                    {mod.items.map((label) => (
                      <li
                        key={label}
                        className="flex items-center gap-2.5 text-[17px] font-bold leading-relaxed text-slate-300"
                      >
                        <span className="text-amber-400/60">•</span>
                        <span>{label}</span>
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
                مؤشرات الأداء الرئيسية
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
