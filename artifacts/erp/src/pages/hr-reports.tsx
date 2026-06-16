import {
  useGetHrEmployeeReport,
  getGetHrEmployeeReportQueryKey,
  useGetHrLeaveReport,
  getGetHrLeaveReportQueryKey,
  useGetHrPayrollReport,
  getGetHrPayrollReportQueryKey,
  useGetHrAttendanceReport,
  getGetHrAttendanceReportQueryKey,
  useGetHrTurnoverReport,
  getGetHrTurnoverReportQueryKey,
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

type Group = { key?: string | null; count: number };

function GroupTable({
  rows,
  keyHeader,
  countHeader,
  noData,
  render,
}: {
  rows: Group[];
  keyHeader: string;
  countHeader: string;
  noData: string;
  render: (key: string | null | undefined) => React.ReactNode;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{keyHeader}</TableHead>
          <TableHead className="text-right">{countHeader}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow><TableCell colSpan={2} className="text-center h-24">{noData}</TableCell></TableRow>
        ) : (
          rows.map((r) => (
            <TableRow key={r.key ?? "none"}>
              <TableCell>{render(r.key)}</TableCell>
              <TableCell className="text-right">{r.count}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export default function HrReportsPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const enabled = !!companyId;
  const { data: departments } = useListDepartments({ pageSize: 200 });

  const departmentName = (id: string | null | undefined) => {
    const d = (departments?.data ?? []).find((x) => x.id === id);
    return d ? (language === "ar" ? d.nameAr : d.name) : "-";
  };

  const params = { companyId };
  const { data: employeeReport } = useGetHrEmployeeReport(params, {
    query: { enabled, queryKey: getGetHrEmployeeReportQueryKey(params) },
  });
  const { data: leaveReport } = useGetHrLeaveReport(params, {
    query: { enabled, queryKey: getGetHrLeaveReportQueryKey(params) },
  });
  const { data: payrollReport } = useGetHrPayrollReport(params, {
    query: { enabled, queryKey: getGetHrPayrollReportQueryKey(params) },
  });
  const { data: attendanceReport } = useGetHrAttendanceReport(params, {
    query: { enabled, queryKey: getGetHrAttendanceReportQueryKey(params) },
  });
  const { data: turnoverReport } = useGetHrTurnoverReport(params, {
    query: { enabled, queryKey: getGetHrTurnoverReportQueryKey(params) },
  });

  const noData = t("hr.no_data");

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("hr.reports")}</h2>
        <p className="text-muted-foreground">{t("hr.reports_subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("hr.report_employees_by_department")}</CardTitle>
          </CardHeader>
          <CardContent>
            <GroupTable
              rows={(employeeReport?.byDepartment ?? []) as Group[]}
              keyHeader={t("nav.departments")}
              countHeader={t("common.count")}
              noData={noData}
              render={(k) => departmentName(k)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("hr.report_leave_by_status")}</CardTitle>
          </CardHeader>
          <CardContent>
            <GroupTable
              rows={(leaveReport?.byStatus ?? []) as Group[]}
              keyHeader={t("common.status")}
              countHeader={t("common.count")}
              noData={noData}
              render={(k) => <Badge variant="secondary">{enumLabel(k, language)}</Badge>}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("hr.report_attendance_by_status")}</CardTitle>
          </CardHeader>
          <CardContent>
            <GroupTable
              rows={(attendanceReport?.byStatus ?? []) as Group[]}
              keyHeader={t("common.status")}
              countHeader={t("common.count")}
              noData={noData}
              render={(k) => <Badge variant="secondary">{enumLabel(k, language)}</Badge>}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("hr.report_payroll")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>{t("hr.total_earnings")}</TableCell>
                  <TableCell className="text-right">{payrollReport?.totalEarnings ?? "0"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("hr.total_deductions")}</TableCell>
                  <TableCell className="text-right">{payrollReport?.totalDeductions ?? "0"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("hr.total_net")}</TableCell>
                  <TableCell className="text-right">{payrollReport?.totalNet ?? "0"}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("hr.report_turnover")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell>{t("hr.hires")}</TableCell>
                  <TableCell className="text-right">{turnoverReport?.hires ?? 0}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("hr.terminations")}</TableCell>
                  <TableCell className="text-right">{turnoverReport?.terminations ?? 0}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t("hr.active_employees")}</TableCell>
                  <TableCell className="text-right">{turnoverReport?.active ?? 0}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
