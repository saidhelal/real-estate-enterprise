import {
  useGetHrAnalytics,
  getGetHrAnalyticsQueryKey,
  useListCompanies,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, Building2, Wallet, BadgeDollarSign } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { BiBarChart } from "@/components/charts/BiBarChart";
import { BiAreaChart } from "@/components/charts/BiAreaChart";
import { BiPieChart } from "@/components/charts/BiPieChart";
import { useLanguage } from "@/lib/language-provider";
import { type ChartConfig } from "@/components/ui/chart";

export default function HrAnalyticsPage() {
  const { t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const params = { companyId };
  const { data, isLoading } = useGetHrAnalytics(params, {
    query: { enabled: !!companyId, queryKey: getGetHrAnalyticsQueryKey(params) },
  });

  const headcountConfig: ChartConfig = {
    value: { label: t("bi.headcount"), color: "hsl(var(--chart-1))" },
  };
  const payrollConfig: ChartConfig = {
    value: { label: t("bi.payroll"), color: "hsl(var(--chart-2))" },
  };
  const attendanceConfig: ChartConfig = {
    value: { label: t("bi.value"), color: "hsl(var(--chart-3))" },
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("bi.hr_analytics")}</h2>
        <p className="text-muted-foreground">{t("bi.hr_subtitle")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title={t("bi.employee_count")} value={data?.employeeCount} icon={Users} isLoading={isLoading} />
        <StatCard title={t("bi.active_employees")} value={data?.activeEmployees} icon={UserCheck} isLoading={isLoading} />
        <StatCard title={t("bi.departments_count")} value={data?.departmentsCount} icon={Building2} isLoading={isLoading} />
        <StatCard title={t("bi.total_payroll")} value={data?.totalPayroll} icon={Wallet} isLoading={isLoading} />
        <StatCard title={t("bi.avg_salary")} value={data?.avgSalary} icon={BadgeDollarSign} isLoading={isLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("bi.payroll_by_month")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BiAreaChart data={data?.payrollByMonth ?? []} dataKeys={["value"]} config={payrollConfig} xKey="period" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("bi.headcount_by_department")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BiBarChart data={data?.headcountByDepartment ?? []} dataKeys={["value"]} config={headcountConfig} xKey="label" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("bi.attendance_breakdown")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BiPieChart data={data?.attendanceBreakdown ?? []} dataKey="value" nameKey="key" config={attendanceConfig} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
