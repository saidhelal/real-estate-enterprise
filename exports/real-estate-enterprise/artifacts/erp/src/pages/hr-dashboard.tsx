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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel } from "@/lib/enums";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

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
      <h2 className="text-2xl font-bold tracking-tight">{t("nav.hr_dashboard")}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label={t("hr.employees_count")} value={data.employeesCount} />
        <Stat label={t("hr.active_employees")} value={data.activeEmployees} />
        <Stat label={t("hr.departments_count")} value={data.departmentsCount} />
        <Stat label={t("hr.pending_leave_requests")} value={data.pendingLeaveRequests} />
        <Stat label={t("hr.open_loans")} value={data.openLoans} />
        <Stat label={t("hr.pending_payroll_runs")} value={data.pendingPayrollRuns} />
        <Stat label={t("hr.payroll_posted")} value={data.payrollPosted} />
        <Stat label={t("hr.loan_outstanding")} value={data.loanOutstanding} />
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
                  <TableHead className="text-right">{t("common.count")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byStatus.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="text-center h-24">{t("hr.no_data")}</TableCell></TableRow>
                ) : (
                  byStatus.map((r) => (
                    <TableRow key={r.key ?? "none"}>
                      <TableCell><Badge variant="secondary">{enumLabel(r.key, language)}</Badge></TableCell>
                      <TableCell className="text-right">{r.count}</TableCell>
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
                  <TableHead className="text-right">{t("common.count")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byDepartment.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="text-center h-24">{t("hr.no_data")}</TableCell></TableRow>
                ) : (
                  byDepartment.map((r) => (
                    <TableRow key={r.key ?? "none"}>
                      <TableCell>{departmentName(r.key)}</TableCell>
                      <TableCell className="text-right">{r.count}</TableCell>
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
                  <TableHead className="text-right">{t("common.count")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byType.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="text-center h-24">{t("hr.no_data")}</TableCell></TableRow>
                ) : (
                  byType.map((r) => (
                    <TableRow key={r.key ?? "none"}>
                      <TableCell>{enumLabel(r.key, language)}</TableCell>
                      <TableCell className="text-right">{r.count}</TableCell>
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
