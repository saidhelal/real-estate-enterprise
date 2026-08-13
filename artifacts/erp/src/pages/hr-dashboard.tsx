import {
  useGetHrDashboard,
  getGetHrDashboardQueryKey,
  useListCompanies,
  useListDepartments,
} from "@workspace/api-client-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel } from "@/lib/enums";

export default function HrDashboardPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: departments } = useListDepartments({ pageSize: 200 });

  const params = { companyId };
  const { data, isLoading } = useGetHrDashboard(params, {
    query: { enabled: !!companyId, queryKey: getGetHrDashboardQueryKey(params) },
  });

  const departmentName = (id: string | null | undefined) => {
    const d = (departments?.data ?? []).find((x) => x.id === id);
    return d ? (language === "ar" ? d.nameAr : d.name) : "-";
  };

  if (isLoading) {
    return <p className="text-muted-foreground">{t("common.loading")}</p>;
  }
  if (!data) {
    return <p className="text-muted-foreground">{t("hr.no_data")}</p>;
  }

  const byStatus = data.employeesByStatus ?? [];
  const byDepartment = data.employeesByDepartment ?? [];
  const byType = data.employeesByType ?? [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader title={t("nav.hr_dashboard")} bordered={false} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={t("hr.employees_count")} value={data.employeesCount} />
        <KpiCard label={t("hr.active_employees")} value={data.activeEmployees} />
        <KpiCard label={t("hr.departments_count")} value={data.departmentsCount} />
        <KpiCard label={t("hr.pending_leave_requests")} value={data.pendingLeaveRequests} />
        <KpiCard label={t("hr.open_loans")} value={data.openLoans} />
        <KpiCard label={t("hr.pending_payroll_runs")} value={data.pendingPayrollRuns} />
        <KpiCard label={t("hr.payroll_posted")} value={data.payrollPosted} />
        <KpiCard label={t("hr.loan_outstanding")} value={data.loanOutstanding} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("hr.employees_by_status")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-end">{t("common.count")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byStatus.length === 0 ? (
                  <TableState colSpan={2} isEmpty emptyTitle={t("hr.no_data")} />
                ) : (
                  byStatus.map((r) => (
                    <TableRow key={r.key ?? "none"}>
                      <TableCell><Badge variant="secondary">{enumLabel(r.key, language)}</Badge></TableCell>
                      <TableCell className="text-end">{r.count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("hr.employees_by_department")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("nav.departments")}</TableHead>
                  <TableHead className="text-end">{t("common.count")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byDepartment.length === 0 ? (
                  <TableState colSpan={2} isEmpty emptyTitle={t("hr.no_data")} />
                ) : (
                  byDepartment.map((r) => (
                    <TableRow key={r.key ?? "none"}>
                      <TableCell>{departmentName(r.key)}</TableCell>
                      <TableCell className="text-end">{r.count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("hr.employees_by_type")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("hr.employment_type")}</TableHead>
                  <TableHead className="text-end">{t("common.count")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byType.length === 0 ? (
                  <TableState colSpan={2} isEmpty emptyTitle={t("hr.no_data")} />
                ) : (
                  byType.map((r) => (
                    <TableRow key={r.key ?? "none"}>
                      <TableCell>{enumLabel(r.key, language)}</TableCell>
                      <TableCell className="text-end">{r.count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
