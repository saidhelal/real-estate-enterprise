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
import { ReportExportButton } from "@/components/report-export-button";
import type { ReportExport } from "@/lib/report-export";
import { FileSpreadsheet } from "lucide-react";

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


  /**
   * Five figures and what they are called.
   *
   * This page has no table — it is a set of KPIs — so the report is one
   * section of label/value rows. The same engine, because a KPI sheet and a
   * ledger listing are the same problem once the numbers are chosen.
   */
  const buildReport = (): ReportExport => ({
    title: t("nav.crm_reports"),
    companyName: "",
    language: ar ? "ar" : "en",
    meta: [],
    columns: [{ header: t("bi.col_metric") }, { header: t("bi.col_value"), numeric: true }],
    sections: [
      {
        rows: [
          [ar ? "إجمالي العملاء المحتملين" : "Total Leads", leadCount],
          [ar ? "التحويلات" : "Conversions", conversionCount],
          [ar ? "نسبة التحويل" : "Conversion Rate", conversionRate],
          [ar ? "الحجوزات" : "Reservations", reservationCount],
          [ar ? "العقود" : "Contracts", contractCount],
        ],
      },
    ],
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title={t("nav.crm_reports")}
        description={ar ? "مؤشرات الأداء الرئيسية للمبيعات والتحويل" : "Key performance indicators for sales and conversion"}
        bordered={false}
        actions={
          <ReportExportButton
            build={buildReport}
            baseFilename={t("nav.crm_reports")}
            audit={{ reportType: "crm-reports", module: "leads", recordCount: leadCount }}
          />
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label={ar ? "إجمالي العملاء المحتملين" : "Total Leads"} value={leadCount} />
        <KpiCard label={ar ? "التحويلات" : "Conversions"} value={conversionCount} />
        <KpiCard label={ar ? "نسبة التحويل" : "Conversion Rate"} value={conversionRate} />
        <KpiCard label={ar ? "الحجوزات" : "Reservations"} value={reservationCount} />
        <KpiCard label={ar ? "العقود" : "Contracts"} value={contractCount} />
      </div>

      {/* CRM reporting links to CRM records. A card here used to open the
          financial statements, which are accounting's, not this department's —
          a report belongs to the domain that owns the question it answers, and
          reaching across for one is how the same report ends up in two places. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
