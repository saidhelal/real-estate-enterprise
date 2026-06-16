import {
  useListShifts,
  useCreateShift,
  useUpdateShift,
  useDeleteShift,
  getListShiftsQueryKey,
  useListCompanies,
  type Shift,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

const STATUS = enumOptions(["active", "inactive"]);

export default function ShiftsPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: t("common.code"), required: true, createOnly: true },
    { name: "name", label: t("common.name"), required: true },
    { name: "nameAr", label: t("common.name_ar"), required: true, rtl: true },
    { name: "startTime", label: t("hr.start_time") },
    { name: "endTime", label: t("hr.end_time") },
    { name: "breakMinutes", label: t("hr.break_minutes"), type: "number" },
    { name: "workHours", label: t("hr.work_hours"), type: "number" },
    { name: "status", label: t("common.status"), type: "select", options: STATUS },
  ];

  const columns: ResourceColumn<Shift>[] = [
    { header: t("common.code"), render: (r) => r.code },
    { header: t("common.name"), render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: t("hr.start_time"), render: (r) => r.startTime ?? "-" },
    { header: t("hr.end_time"), render: (r) => r.endTime ?? "-" },
    { header: t("hr.work_hours"), render: (r) => r.workHours },
    {
      header: t("common.status"),
      render: (r) => (
        <Badge variant={r.status === "active" ? "secondary" : "outline"}>
          {enumLabel(r.status, language)}
        </Badge>
      ),
    },
  ];

  return (
    <ResourceManager
      title={t("nav.shifts")}
      columns={columns}
      fields={fields}
      useList={useListShifts}
      useCreate={useCreateShift}
      useUpdate={useUpdateShift}
      useDelete={useDeleteShift}
      getListQueryKey={getListShiftsQueryKey}
      companyId={companyId}
    />
  );
}
