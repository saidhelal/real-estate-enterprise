import { useQueryClient } from "@tanstack/react-query";
import {
  useListFiscalPeriods,
  useCreateFiscalPeriod,
  useUpdateFiscalPeriod,
  useDeleteFiscalPeriod,
  getListFiscalPeriodsQueryKey,
  useCloseFiscalPeriod,
  useReopenFiscalPeriod,
  useListCompanies,
  useListFiscalYears,
  type FiscalPeriodDetail,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";

const STATUS = enumOptions(["open", "closed"]);

export default function FiscalPeriodsPage() {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: years } = useListFiscalYears();

  const closeMutation = useCloseFiscalPeriod();
  const reopenMutation = useReopenFiscalPeriod();

  const yearOptions = (years ?? []).map((y) => ({
    value: y.id,
    label: y.name,
    labelAr: y.name,
  }));

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListFiscalPeriodsQueryKey() });

  const runAction = (
    mutation: typeof closeMutation,
    id: string,
  ) => {
    mutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: t("common.saved") });
          invalidate();
        },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );
  };

  const fields: ResourceField[] = [
    { name: "name", label: t("common.name"), required: true },
    { name: "nameAr", label: t("common.name_ar"), required: true, rtl: true },
    { name: "fiscalYearId", label: t("acc.fiscal_year"), type: "select", required: true, options: yearOptions },
    { name: "periodNumber", label: t("acc.period_number"), type: "number" },
    { name: "startDate", label: t("acc.start_date"), type: "date", required: true },
    { name: "endDate", label: t("acc.end_date"), type: "date", required: true },
    { name: "status", label: t("common.status"), type: "select", options: STATUS },
  ];

  const columns: ResourceColumn<FiscalPeriodDetail>[] = [
    { header: t("acc.period_number"), render: (r) => r.periodNumber },
    { header: t("common.name"), render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: t("acc.start_date"), render: (r) => r.startDate },
    { header: t("acc.end_date"), render: (r) => r.endDate },
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
      title={t("nav.fiscal_periods")}
      columns={columns}
      fields={fields}
      useList={useListFiscalPeriods}
      useCreate={useCreateFiscalPeriod}
      useUpdate={useUpdateFiscalPeriod}
      useDelete={useDeleteFiscalPeriod}
      getListQueryKey={getListFiscalPeriodsQueryKey}
      companyId={companyId}
      rowActions={(r) =>
        r.status === "open" ? (
          <Button
            variant="outline"
            size="sm"
            disabled={closeMutation.isPending}
            onClick={() => runAction(closeMutation, r.id)}
          >
            {t("acc.close")}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={reopenMutation.isPending}
            onClick={() => runAction(reopenMutation, r.id)}
          >
            {t("acc.reopen")}
          </Button>
        )
      }
    />
  );
}
