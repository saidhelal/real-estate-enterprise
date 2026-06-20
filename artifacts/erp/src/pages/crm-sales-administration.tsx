import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/language-provider";
import {
  UserCheck,
  ArrowRightLeft,
  Megaphone,
  Activity,
  SlidersHorizontal,
  Home,
  BarChart3,
  FileSpreadsheet,
} from "lucide-react";

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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.sales_administration")}</h1>
        <p className="text-sm text-muted-foreground">
          {ar
            ? "أدوات إدارة المبيعات: توزيع العملاء، النشر، والتقارير. تعديل الوحدات للطوارئ فقط عبر مركز إدخال البيانات."
            : "Sales operations tools: lead distribution, publishing and reports. Emergency unit edits go through the Data Entry Center only."}
        </p>
      </div>

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
