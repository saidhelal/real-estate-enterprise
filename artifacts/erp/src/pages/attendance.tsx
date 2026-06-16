import {
  useListAttendanceRecords,
  useCreateAttendanceRecord,
  useUpdateAttendanceRecord,
  useDeleteAttendanceRecord,
  getListAttendanceRecordsQueryKey,
  useListEmployees,
  useListShifts,
  useListCompanies,
  type AttendanceRecord,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

const STATUS = enumOptions(["present", "absent", "late", "on_leave", "holiday", "weekend"]);

export default function AttendancePage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: employees } = useListEmployees({ pageSize: 200 });
  const { data: shifts } = useListShifts({ pageSize: 200 });

  const employeeOptions = (employees?.data ?? []).map((e) => ({
    value: e.id,
    label: `${e.code} - ${e.firstName} ${e.lastName}`,
    labelAr: `${e.code} - ${e.firstNameAr ?? e.firstName} ${e.lastNameAr ?? e.lastName}`,
  }));
  const shiftOptions = (shifts?.data ?? []).map((s) => ({ value: s.id, label: s.name, labelAr: s.nameAr }));
  const employeeName = (id: string | null | undefined) => {
    const e = (employees?.data ?? []).find((x) => x.id === id);
    return e ? `${e.firstName} ${e.lastName}` : "-";
  };

  const fields: ResourceField[] = [
    { name: "employeeId", label: t("nav.employees"), type: "select", options: employeeOptions, required: true },
    { name: "shiftId", label: t("nav.shifts"), type: "select", options: shiftOptions },
    { name: "attendanceDate", label: t("hr.attendance_date"), type: "date", required: true },
    { name: "status", label: t("common.status"), type: "select", options: STATUS },
    { name: "lateMinutes", label: t("hr.late_minutes"), type: "number" },
    { name: "overtimeHours", label: t("hr.overtime_hours"), type: "number" },
    { name: "workedHours", label: t("hr.worked_hours"), type: "number" },
    { name: "notes", label: t("common.notes"), type: "textarea" },
  ];

  const columns: ResourceColumn<AttendanceRecord>[] = [
    { header: t("nav.employees"), render: (r) => employeeName(r.employeeId) },
    { header: t("hr.attendance_date"), render: (r) => r.attendanceDate },
    {
      header: t("common.status"),
      render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge>,
    },
    { header: t("hr.late_minutes"), render: (r) => r.lateMinutes },
    { header: t("hr.overtime_hours"), render: (r) => r.overtimeHours },
  ];

  return (
    <ResourceManager
      title={t("nav.attendance")}
      columns={columns}
      fields={fields}
      useList={useListAttendanceRecords}
      useCreate={useCreateAttendanceRecord}
      useUpdate={useUpdateAttendanceRecord}
      useDelete={useDeleteAttendanceRecord}
      getListQueryKey={getListAttendanceRecordsQueryKey}
      companyId={companyId}
    />
  );
}
