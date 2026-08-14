import {
  useListPayslips,
  useCreatePayslip,
  useUpdatePayslip,
  useDeletePayslip,
  getListPayslipsQueryKey,
  useListEmployees,
  useListPayrollRuns,
  useListCompanies,
  type Payslip,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

const STATUS = enumOptions(["draft", "approved", "posted"]);

export default function PayslipsPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: employees } = useListEmployees({ pageSize: 200 });
  const { data: runs } = useListPayrollRuns({ pageSize: 200 });

  const employeeOptions = (employees?.data ?? []).map((e) => ({
    value: e.id,
    label: `${e.code} - ${e.firstName} ${e.lastName}`,
    labelAr: `${e.code} - ${e.firstNameAr ?? e.firstName} ${e.lastNameAr ?? e.lastName}`,
  }));
  const runOptions = (runs?.data ?? []).map((r) => ({ value: r.id, label: r.code, labelAr: r.code }));
  const employeeName = (id: string | null | undefined) => {
    const e = (employees?.data ?? []).find((x) => x.id === id);
    return e ? `${e.firstName} ${e.lastName}` : "-";
  };

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence on save; shown here beforehand.
      generated: true,
      generatorKey: "payslip",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "payrollRunId", label: t("nav.payroll_runs"), type: "select", options: runOptions },
    { name: "employeeId", label: t("nav.employees"), type: "select", options: employeeOptions, required: true },
    { name: "basicSalary", label: t("hr.basic_salary"), type: "money" },
    { name: "totalEarnings", label: t("hr.total_earnings"), type: "money" },
    { name: "totalDeductions", label: t("hr.total_deductions"), type: "money" },
    { name: "netPay", label: t("hr.net_pay"), type: "money" },
    { name: "status", label: t("common.status"), type: "select", options: STATUS },
    { name: "notes", label: t("common.notes"), type: "textarea" },
  ];

  const columns: ResourceColumn<Payslip>[] = [
    { header: t("common.code"), render: (r) => r.code },
    { header: t("nav.employees"), render: (r) => employeeName(r.employeeId) },
    { header: t("hr.total_earnings"), render: (r) => r.totalEarnings },
    { header: t("hr.total_deductions"), render: (r) => r.totalDeductions },
    { header: t("hr.net_pay"), render: (r) => r.netPay },
    {
      header: t("common.status"),
      render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge>,
    },
  ];

  return (
    <ResourceManager
      title={t("nav.payslips")}
      columns={columns}
      fields={fields}
      useList={useListPayslips}
      useCreate={useCreatePayslip}
      useUpdate={useUpdatePayslip}
      useDelete={useDeletePayslip}
      getListQueryKey={getListPayslipsQueryKey}
      companyId={companyId}
    />
  );
}
