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
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/language-provider";

function Stat({ label, value, href }: { label: string; value: string | number; href: string }) {
  return (
    <Link href={href}>
      <Card className="cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{value}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("nav.crm_dashboard")}</h1>
        <p className="text-sm text-muted-foreground">
          {ar ? "نظرة عامة على نشاط المبيعات وإدارة العلاقات" : "Overview of sales activity and relationship management"}
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Stat label={ar ? "العملاء المحتملون" : "Leads"} value={leads?.total ?? leads?.data.length ?? 0} href="/leads" />
        <Stat label={ar ? "وحدات متاحة" : "Available Units"} value={availableUnits.length} href="/available-units" />
        <Stat label={ar ? "الحجوزات" : "Reservations"} value={reservations?.total ?? reservations?.data.length ?? 0} href="/reservations" />
        <Stat label={ar ? "العقود" : "Contracts"} value={contracts?.total ?? contracts?.data.length ?? 0} href="/contracts" />
        <Stat label={ar ? "متابعات مستحقة" : "Follow-ups Due"} value={dueFollowUps.length} href="/lead-follow-ups" />
        <Stat label={ar ? "بانتظار المالية" : "Pending Finance"} value={pendingFinance.length} href="/finance-inbox" />
        <Stat label={ar ? "بانتظار القانونية" : "Pending Legal"} value={pendingLegal.length} href="/legal-approvals" />
      </div>
    </div>
  );
}
