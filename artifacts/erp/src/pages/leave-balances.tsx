import {
  useListLeaveBalances,
  useCreateLeaveBalance,
  useUpdateLeaveBalance,
  useDeleteLeaveBalance,
  getListLeaveBalancesQueryKey,
  useListEmployees,
  useListLeaveTypes,
  useListCompanies,
  type LeaveBalance,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function LeaveBalancesPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: employees } = useListEmployees({ pageSize: 200 });
  const { data: leaveTypes } = useListLeaveTypes({ pageSize: 200 });

  const employeeOptions = (employees?.data ?? []).map((e) => ({
    value: e.id,
    label: `${e.code} - ${e.firstName} ${e.lastName}`,
    labelAr: `${e.code} - ${e.firstNameAr ?? e.firstName} ${e.lastNameAr ?? e.lastName}`,
  }));
  const leaveTypeOptions = (leaveTypes?.data ?? []).map((l) => ({ value: l.id, label: l.name, labelAr: l.nameAr }));
  const employeeName = (id: string | null | undefined) => {
    const e = (employees?.data ?? []).find((x) => x.id === id);
    return e ? `${e.firstName} ${e.lastName}` : "-";
  };
  const leaveTypeName = (id: string | null | undefined) => {
    const l = (leaveTypes?.data ?? []).find((x) => x.id === id);
    return l ? (language === "ar" ? l.nameAr : l.name) : "-";
  };

  const fields: ResourceField[] = [
    { name: "employeeId", label: t("nav.employees"), type: "select", options: employeeOptions, required: true },
    { name: "leaveTypeId", label: t("nav.leave_types"), type: "select", options: leaveTypeOptions, required: true },
    { name: "year", label: t("hr.year"), type: "number", required: true },
    { name: "entitled", label: t("hr.entitled"), type: "number" },
    { name: "used", label: t("hr.used"), type: "number" },
    { name: "remaining", label: t("hr.remaining"), type: "number" },
  ];

  const columns: ResourceColumn<LeaveBalance>[] = [
    { header: t("nav.employees"), render: (r) => employeeName(r.employeeId) },
    { header: t("nav.leave_types"), render: (r) => leaveTypeName(r.leaveTypeId) },
    { header: t("hr.year"), render: (r) => r.year },
    { header: t("hr.entitled"), render: (r) => r.entitled },
    { header: t("hr.used"), render: (r) => r.used },
    { header: t("hr.remaining"), render: (r) => r.remaining },
  ];

  return (
    <ResourceManager
      title={t("nav.leave_balances")}
      columns={columns}
      fields={fields}
      useList={useListLeaveBalances}
      useCreate={useCreateLeaveBalance}
      useUpdate={useUpdateLeaveBalance}
      useDelete={useDeleteLeaveBalance}
      getListQueryKey={getListLeaveBalancesQueryKey}
      companyId={companyId}
    />
  );
}
