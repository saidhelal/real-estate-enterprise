import { useGetPortalDashboard } from "@workspace/api-client-react";
import { useLanguage } from "@/lib/language-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Home, FileText, CreditCard, AlertCircle, Wrench, Bell } from "lucide-react";
import { Link } from "wouter";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { format } from "date-fns";

export default function Dashboard() {
  const { t, dir } = useLanguage();
  const { data: dashboard, isLoading } = useGetPortalDashboard();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("nav.dashboard")}</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[400px] rounded-xl w-full" />
      </div>
    );
  }

  if (!dashboard) return null;

  const stats = [
    {
      title: t("dash.total_value"),
      value: Number(dashboard.totalContractValue).toLocaleString(),
      icon: FileText,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: t("dash.paid"),
      value: Number(dashboard.totalPaid).toLocaleString(),
      icon: CreditCard,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      title: t("dash.outstanding"),
      value: Number(dashboard.totalOutstanding).toLocaleString(),
      icon: CreditCard,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      title: t("dash.overdue"),
      value: Number(dashboard.overdueAmount).toLocaleString(),
      icon: AlertCircle,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("nav.dashboard")}</h1>
        
        {dashboard.nextDueDate && (
          <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg flex items-center gap-3 border border-primary/20">
            <CreditCard className="h-5 w-5" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wider">{t("dash.next_payment")}</p>
              <p className="text-sm font-bold">
                {Number(dashboard.nextDueAmount).toLocaleString()} due {format(new Date(dashboard.nextDueDate), "MMM dd, yyyy")}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <Card key={i} className="overflow-hidden border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${stat.bg} ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2 border-border/50">
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              {dashboard.paymentTrend && dashboard.paymentTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dashboard.paymentTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="period" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      tickFormatter={(value) => `${value >= 1000 ? (value / 1000) + 'k' : value}`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                      formatter={(value: any) => [Number(value).toLocaleString(), 'Amount']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorValue)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl">
                  No payment data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Link href="/units">
            <Card className="border-border/50 hover:bg-muted/30 transition-colors cursor-pointer">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Home className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{dashboard.unitsCount}</h3>
                  <p className="text-sm font-medium text-muted-foreground">{t("dash.units_count")}</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/maintenance">
            <Card className="border-border/50 hover:bg-muted/30 transition-colors cursor-pointer">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                  <Wrench className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{dashboard.openRequests}</h3>
                  <p className="text-sm font-medium text-muted-foreground">Open Requests</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/notifications">
            <Card className="border-border/50 hover:bg-muted/30 transition-colors cursor-pointer">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                  <Bell className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{dashboard.unreadNotifications}</h3>
                  <p className="text-sm font-medium text-muted-foreground">Unread Notifications</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
