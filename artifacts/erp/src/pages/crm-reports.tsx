import {
  useListLeads,
  getListLeadsQueryKey,
  useListReservations,
  getListReservationsQueryKey,
  useListContracts,
  getListContractsQueryKey,
  useListLeadConversions,
  getListLeadConversionsQueryKey,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { useLanguage } from "@/lib/language-provider";
import { BarChart3, FileSpreadsheet } from "lucide-react";

export default function CrmReportsPage() {
  const { language, t } = useLanguage();
  const ar = language === "ar";

  const p = { pageSize: 200 } as const;
  const { data: leads, isLoading } = useListLeads(p, { query: { queryKey: getListLeadsQueryKey(p) } });
  const { data: reservations } = useListReservations(p, { query: { queryKey: getListReservationsQueryKey(p) } });
  const { data: contracts } = useListContracts(p, { query: { queryKey: getListContractsQueryKey(p) } });
  const { data: conversions } = useListLeadConversions(p, { query: { queryKey: getListLeadConversionsQueryKey(p) } });

  const leadCount = leads?.total ?? leads?.data.length ?? 0;
  const reservationCount = reservations?.total ?? reservations?.data.length ?? 0;
  const contractCount = contracts?.total ?? contracts?.data.length ?? 0;
  const conversionCount = conversions?.total ?? conversions?.data.length ?? 0;
  const conversionRate = leadCount > 0 ? `${Math.round((conversionCount / leadCount) * 100)}%` : "—";

  if (isLoading) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title={t("nav.crm_reports")}
        description={ar ? "مؤشرات الأداء الرئيسية للمبيعات والتحويل" : "Key performance indicators for sales and conversion"}
        bordered={false}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label={ar ? "إجمالي العملاء المحتملين" : "Total Leads"} value={leadCount} />
        <KpiCard label={ar ? "التحويلات" : "Conversions"} value={conversionCount} />
        <KpiCard label={ar ? "نسبة التحويل" : "Conversion Rate"} value={conversionRate} />
        <KpiCard label={ar ? "الحجوزات" : "Reservations"} value={reservationCount} />
        <KpiCard label={ar ? "العقود" : "Contracts"} value={contractCount} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/financial-reports">
          <Card interactive>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                {ar ? "التقارير المالية" : "Financial Reports"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              {ar ? "تقارير مالية تفصيلية مع تصدير" : "Detailed financial reports with export"}
            </CardContent>
          </Card>
        </Link>
        <Link href="/lead-conversions">
          <Card interactive>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                {ar ? "تحويلات العملاء" : "Lead Conversions"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              {ar ? "سجل تحويل العملاء المحتملين إلى عملاء" : "Record of leads converted to customers"}
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
