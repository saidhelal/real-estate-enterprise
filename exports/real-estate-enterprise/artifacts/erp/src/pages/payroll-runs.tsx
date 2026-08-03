import { useQueryClient } from "@tanstack/react-query";
import {
  useListPayrollRuns,
  useCreatePayrollRun,
  useUpdatePayrollRun,
  useDeletePayrollRun,
  getListPayrollRunsQueryKey,
  useApprovePayrollRun,
  usePostPayrollRun,
  useReversePayrollRun,
  useListPayrollPeriods,
  useListCompanies,
  type PayrollRun,
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

const STATUS = enumOptions(["draft", "approved", "posted", "reversed"]);

export default function PayrollRunsPage() {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: periods } = useListPayrollPeriods({ pageSize: 200 });

  const approveMutation = useApprovePayrollRun();
  const postMutation = usePostPayrollRun();
  const reverseMutation = useReversePayrollRun();

  const periodOptions = (periods?.data ?? []).map((p) => ({ value: p.id, label: p.name, labelAr: p.name }));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListPayrollRunsQueryKey() });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runAction = (mutation: any, id: string) => {
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
    { name: "code", label: t("common.code"), required: true, createOnly: true },
    { name: "payrollPeriodId", label: t("nav.payroll_periods"), type: "select", options: periodOptions },
    { name: "runDate", label: t("hr.run_date"), type: "date", required: true },
    { name: "description", label: t("common.description"), type: "textarea" },
    { name: "totalEarnings", label: t("hr.total_earnings"), type: "money" },
    { name: "totalDeductions", label: t("hr.total_deductions"), type: "money" },
    { name: "totalNet", label: t("hr.total_net"), type: "money" },
    { name: "employeeCount", label: t("hr.employee_count"), type: "number" },
  ];

  const columns: ResourceColumn<PayrollRun>[] = [
    { header: t("common.code"), render: (r) => r.code },
    { header: t("hr.run_date"), render: (r) => r.runDate },
    { header: t("hr.total_net"), render: (r) => r.totalNet },
    { header: t("hr.employee_count"), render: (r) => r.employeeCount },
    {
      header: t("common.status"),
      render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge>,
    },
  ];

  return (
    <ResourceManager
      title={t("nav.payroll_runs")}
      columns={columns}
      fields={fields}
      useList={useListPayrollRuns}
      useCreate={useCreatePayrollRun}
      useUpdate={useUpdatePayrollRun}
      useDelete={useDeletePayrollRun}
      getListQueryKey={getListPayrollRunsQueryKey}
      companyId={companyId}
      canEdit={(r) => r.status === "draft"}
      canDelete={(r) => r.status === "draft"}
      rowActions={(r) => (
        <>
          {r.status === "draft" && (
            <Button variant="outline" size="sm" disabled={approveMutation.isPending} onClick={() => runAction(approveMutation, r.id)}>
              {t("hr.approve")}
            </Button>
          )}
          {r.status === "approved" && (
            <Button variant="outline" size="sm" disabled={postMutation.isPending} onClick={() => runAction(postMutation, r.id)}>
              {t("hr.post")}
            </Button>
          )}
          {r.status === "posted" && (
            <Button variant="outline" size="sm" disabled={reverseMutation.isPending} onClick={() => runAction(reverseMutation, r.id)}>
              {t("hr.reverse")}
            </Button>
          )}
        </>
      )}
    />
  );
}
