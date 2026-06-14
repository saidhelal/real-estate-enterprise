import { useAuth } from "@/lib/auth-provider";
import { useLanguage } from "@/lib/language-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, MapPin, ShieldCheck, Activity, CalendarDays, Banknote, History } from "lucide-react";
import { useGetDashboardSummary, useGetRecentActivity } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: activity, isLoading: activityLoading } = useGetRecentActivity();

  if (!user) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("dashboard.title")}</h2>
        <p className="text-muted-foreground">
          {t("dashboard.welcome")}, {user.fullName}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  isLoading 
}: { 
  title: string; 
  value?: number; 
  icon: any;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-7 w-[60px]" />
        ) : (
          <div className="text-2xl font-bold">{value?.toLocaleString() || 0}</div>
        )}
      </CardContent>
    </Card>
  );
}
