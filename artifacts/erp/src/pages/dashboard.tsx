import { useAuth } from "@/lib/auth-provider";
import { useLanguage } from "@/lib/language-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, MapPin, ShieldCheck, Activity, CalendarDays, Banknote, History, Building, Home, BadgeCheck, BookMarked, FileSignature, UserPlus, AlertTriangle, Banknote as BanknoteIcon, Wallet, Receipt, TrendingUp, Landmark, CircleDollarSign } from "lucide-react";
import { useGetDashboardSummary, useGetRecentActivity, useGetRealEstateDashboard, useGetFinanceDashboard } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/stat-card";
import { format } from "date-fns";

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();
  const { data: re, isLoading: reLoading } = useGetRealEstateDashboard();
  const { data: fin, isLoading: finLoading } = useGetFinanceDashboard();

  if (!user) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("dashboard.title")}</h2>
        <p className="text-muted-foreground">
          {t("dashboard.welcome")}, {user.fullName}
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard
          title={t("dashboard.users")}
          value={summary?.users}
          icon={Users}
          isLoading={summaryLoading}
        />
        <StatCard
          title={t("dashboard.companies")}
          value={summary?.companies}
          icon={Building2}
          isLoading={summaryLoading}
        />
        <StatCard
          title={t("dashboard.branches")}
          value={summary?.branches}
          icon={MapPin}
          isLoading={summaryLoading}
        />
        <StatCard
          title={t("dashboard.roles")}
          value={summary?.roles}
          icon={ShieldCheck}
          isLoading={summaryLoading}
        />
        <StatCard
          title={t("dashboard.active_sessions")}
          value={summary?.activeSessions}
          icon={Activity}
          isLoading={summaryLoading}
        />
        <StatCard
          title={t("dashboard.fiscal_years")}
          value={summary?.fiscalYears}
          icon={CalendarDays}
          isLoading={summaryLoading}
        />
        <StatCard
          title={t("dashboard.currencies")}
          value={summary?.currencies}
          icon={Banknote}
          isLoading={summaryLoading}
        />
        <StatCard
          title={t("dashboard.audit_events")}
          value={summary?.auditEvents}
          icon={History}
          isLoading={summaryLoading}
        />
      </div>

      <div>
        <h3 className="mb-3 text-lg font-semibold tracking-tight">{t("dashboard.real_estate")}</h3>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          <StatCard title={t("dashboard.projects")} value={re?.projects} icon={Building} isLoading={reLoading} />
          <StatCard title={t("dashboard.buildings")} value={re?.buildings} icon={Building2} isLoading={reLoading} />
          <StatCard title={t("dashboard.units")} value={re?.units} icon={Home} isLoading={reLoading} />
          <StatCard title={t("dashboard.available_units")} value={re?.availableUnits} icon={BadgeCheck} isLoading={reLoading} />
          <StatCard title={t("dashboard.reserved_units")} value={re?.reservedUnits} icon={BookMarked} isLoading={reLoading} />
          <StatCard title={t("dashboard.sold_units")} value={re?.soldUnits} icon={Home} isLoading={reLoading} />
          <StatCard title={t("dashboard.leads")} value={re?.leads} icon={UserPlus} isLoading={reLoading} />
          <StatCard title={t("dashboard.customers")} value={re?.customers} icon={Users} isLoading={reLoading} />
          <StatCard title={t("dashboard.reservations")} value={re?.reservations} icon={BookMarked} isLoading={reLoading} />
          <StatCard title={t("dashboard.contracts")} value={re?.contracts} icon={FileSignature} isLoading={reLoading} />
          <StatCard title={t("dashboard.overdue_installments")} value={re?.overdueInstallments} icon={AlertTriangle} isLoading={reLoading} />
          <StatCard title={t("dashboard.total_contract_value")} value={re?.totalContractValue} icon={BanknoteIcon} isLoading={reLoading} />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-lg font-semibold tracking-tight">{t("dashboard.finance")}</h3>
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          <StatCard title={t("dashboard.total_sales")} value={fin?.totalSales} icon={TrendingUp} isLoading={finLoading} />
          <StatCard title={t("dashboard.total_collections")} value={fin?.totalCollections} icon={CircleDollarSign} isLoading={finLoading} />
          <StatCard title={t("dashboard.outstanding_installments")} value={fin?.outstandingInstallments} icon={BanknoteIcon} isLoading={finLoading} />
          <StatCard title={t("dashboard.overdue_amount")} value={fin?.overdueAmount} icon={AlertTriangle} isLoading={finLoading} />
          <StatCard title={t("dashboard.treasury_balance")} value={fin?.treasuryBalance} icon={Wallet} isLoading={finLoading} />
          <StatCard title={t("dashboard.bank_balance")} value={fin?.bankBalance} icon={Landmark} isLoading={finLoading} />
          <StatCard title={t("dashboard.receipts")} value={fin?.receipts} icon={Receipt} isLoading={finLoading} />
          <StatCard title={t("dashboard.pending_penalties")} value={fin?.pendingPenalties} icon={AlertTriangle} isLoading={finLoading} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.recent_activity")}</CardTitle>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : activity?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            <div className="space-y-4">
              {activity?.map((log) => (
                <div key={log.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium">
                      <span className="capitalize">{log.action}</span> {log.entity}
                    </p>
                    <p className="text-xs text-muted-foreground">by {log.userName}</p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(log.createdAt), 'PP p')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
