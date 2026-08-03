import {
  useListLeaveTypes,
  useCreateLeaveType,
  useUpdateLeaveType,
  useDeleteLeaveType,
  getListLeaveTypesQueryKey,
  useListCompanies,
  type LeaveType,
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

export default function LeaveTypesPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: t("common.code"), required: true, createOnly: true },
    { name: "name", label: t("common.name"), required: true },
    { name: "nameAr", label: t("common.name_ar"), required: true, rtl: true },
    { name: "daysPerYear", label: t("hr.days_per_year"), type: "number" },
    { name: "isPaid", label: t("hr.is_paid"), type: "boolean" },
    { name: "carryForward", label: t("hr.carry_forward"), type: "boolean" },
    { name: "description", label: t("common.description"), type: "textarea" },
    { name: "status", label: t("common.status"), type: "select", options: STATUS },
  ];

  const columns: ResourceColumn<LeaveType>[] = [
    { header: t("common.code"), render: (r) => r.code },
    { header: t("common.name"), render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: t("hr.days_per_year"), render: (r) => r.daysPerYear },
    { header: t("hr.is_paid"), render: (r) => (r.isPaid ? (language === "ar" ? "نعم" : "Yes") : (language === "ar" ? "لا" : "No")) },
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
      title={t("nav.leave_types")}
      columns={columns}
      fields={fields}
      useList={useListLeaveTypes}
      useCreate={useCreateLeaveType}
      useUpdate={useUpdateLeaveType}
      useDelete={useDeleteLeaveType}
      getListQueryKey={getListLeaveTypesQueryKey}
      companyId={companyId}
    />
  );
}
