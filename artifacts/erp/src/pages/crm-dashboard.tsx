import {
  useListLeads,
  getListLeadsQueryKey,
  useListUnits,
  getListUnitsQueryKey,
  useListUnitStatuses,
  useListReservations,
  getListReservationsQueryKey,
  useListContracts,
  getListContractsQueryKey,
  useListLeadFollowUps,
  getListLeadFollowUpsQueryKey,
} from "@workspace/api-client-react";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { useLanguage } from "@/lib/language-provider";

const todayKey = () => new Date().toISOString().slice(0, 10);

export default function CrmDashboardPage() {
  const { language, t } = useLanguage();
  const ar = language === "ar";

  const p = { pageSize: 200 } as const;
  const { data: leads, isLoading } = useListLeads(p, { query: { queryKey: getListLeadsQueryKey(p) } });
  const { data: units } = useListUnits(p, { query: { queryKey: getListUnitsQueryKey(p) } });
  const { data: unitStatuses } = useListUnitStatuses({ pageSize: 200 });
  const { data: reservations } = useListReservations(p, { query: { queryKey: getListReservationsQueryKey(p) } });
  const { data: contracts } = useListContracts(p, { query: { queryKey: getListContractsQueryKey(p) } });
  const { data: followUps } = useListLeadFollowUps(p, { query: { queryKey: getListLeadFollowUpsQueryKey(p) } });

  const statusCodeById = new Map((unitStatuses?.data ?? []).map((s) => [s.id, s.code]));
  const availableUnits = (units?.data ?? []).filter(
    (u) => (u.unitStatusId ? statusCodeById.get(u.unitStatusId) : undefined) === "available",
  );
  const today = todayKey();
  const dueFollowUps = (followUps?.data ?? []).filter(
    (f) =>
      f.status !== "done" &&
      f.status !== "completed" &&
      f.status !== "cancelled" &&
      f.dueDate &&
      f.dueDate.slice(0, 10) <= today,
  );
  const pendingFinance = (contracts?.data ?? []).filter((c) => c.status === "pending_finance");
  const pendingLegal = (contracts?.data ?? []).filter((c) => c.status === "finance_approved");

  if (isLoading) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title={t("nav.crm_dashboard")}
        description={ar ? "نظرة عامة على نشاط المبيعات وإدارة العلاقات" : "Overview of sales activity and relationship management"}
        bordered={false}
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label={ar ? "العملاء المحتملون" : "Leads"} value={leads?.total ?? leads?.data.length ?? 0} href="/leads" />
        <KpiCard label={ar ? "وحدات متاحة" : "Available Units"} value={availableUnits.length} href="/available-units" />
        <KpiCard label={ar ? "الحجوزات" : "Reservations"} value={reservations?.total ?? reservations?.data.length ?? 0} href="/reservations" />
        <KpiCard label={ar ? "العقود" : "Contracts"} value={contracts?.total ?? contracts?.data.length ?? 0} href="/contracts" />
        <KpiCard label={ar ? "متابعات مستحقة" : "Follow-ups Due"} value={dueFollowUps.length} href="/lead-follow-ups" />
        <KpiCard label={ar ? "بانتظار المالية" : "Pending Finance"} value={pendingFinance.length} href="/finance-inbox" />
        <KpiCard label={ar ? "بانتظار القانونية" : "Pending Legal"} value={pendingLegal.length} href="/legal-approvals" />
      </div>
    </div>
  );
}
