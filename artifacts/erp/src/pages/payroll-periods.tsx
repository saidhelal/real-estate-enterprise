import {
  useListPayrollPeriods,
  useCreatePayrollPeriod,
  useUpdatePayrollPeriod,
  useDeletePayrollPeriod,
  getListPayrollPeriodsQueryKey,
  useListCompanies,
  type PayrollPeriod,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

const STATUS = enumOptions(["open", "processing", "closed"]);

export default function PayrollPeriodsPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence on save; shown here beforehand.
      generated: true,
      generatorKey: "payrollPeriod",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "name", label: t("common.name"), required: true },
    { name: "year", label: t("hr.year"), type: "number", required: true },
    { name: "month", label: t("hr.month"), type: "number", required: true },
    { name: "startDate", label: t("acc.start_date"), type: "date", required: true },
    { name: "endDate", label: t("acc.end_date"), type: "date", required: true },
    { name: "payDate", label: t("hr.pay_date"), type: "date" },
    { name: "status", label: t("common.status"), type: "select", options: STATUS },
  ];

  const columns: ResourceColumn<PayrollPeriod>[] = [
    { header: t("common.code"), render: (r) => r.code },
    { header: t("common.name"), render: (r) => r.name },
    { header: t("hr.year"), render: (r) => r.year },
    { header: t("hr.month"), render: (r) => r.month },
    {
      header: t("common.status"),
      render: (r) => (
        <Badge variant={r.status === "open" ? "secondary" : "outline"}>
          {enumLabel(r.status, language)}
        </Badge>
      ),
    },
  ];

  return (
    <ResourceManager
      title={t("nav.payroll_periods")}
      columns={columns}
      fields={fields}
      useList={useListPayrollPeriods}
      useCreate={useCreatePayrollPeriod}
      useUpdate={useUpdatePayrollPeriod}
      useDelete={useDeletePayrollPeriod}
      getListQueryKey={getListPayrollPeriodsQueryKey}
      companyId={companyId}
    />
  );
}
