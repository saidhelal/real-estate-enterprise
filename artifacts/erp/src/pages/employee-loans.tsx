import { useQueryClient } from "@tanstack/react-query";
import {
  useListEmployeeLoans,
  useCreateEmployeeLoan,
  useUpdateEmployeeLoan,
  useDeleteEmployeeLoan,
  getListEmployeeLoansQueryKey,
  useApproveEmployeeLoan,
  useDisburseEmployeeLoan,
  useListEmployees,
  useListCompanies,
  type EmployeeLoan,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumLabel, enumOptions } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";

export default function EmployeeLoansPage() {
  const { language, t } = useLanguage();
  const LOAN_TYPE = enumOptions(["personal", "housing", "car", "emergency", "other"]);
  const { options: PAYMENT_METHOD } = useLookupOptions("payment_method", ["cash", "bank_transfer"]);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: employees } = useListEmployees({ pageSize: 200 });

  const approveMutation = useApproveEmployeeLoan();
  const disburseMutation = useDisburseEmployeeLoan();

  const employeeOptions = (employees?.data ?? []).map((e) => ({
    value: e.id,
    label: `${e.code} - ${e.firstName} ${e.lastName}`,
    labelAr: `${e.code} - ${e.firstNameAr ?? e.firstName} ${e.lastNameAr ?? e.lastName}`,
  }));
  const employeeName = (id: string | null | undefined) => {
    const e = (employees?.data ?? []).find((x) => x.id === id);
    return e ? `${e.firstName} ${e.lastName}` : "-";
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListEmployeeLoansQueryKey() });

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
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence on save; shown here beforehand.
      generated: true,
      generatorKey: "employeeLoan",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "employeeId", label: t("nav.employees"), type: "select", options: employeeOptions, required: true },
    { name: "loanType", label: t("hr.loan_type"), type: "select", options: LOAN_TYPE },
    { name: "amount", label: t("hr.amount"), type: "money", required: true },
    { name: "installmentAmount", label: t("hr.installment_amount"), type: "money" },
    { name: "installmentsCount", label: t("hr.installments_count"), type: "number" },
    { name: "startDate", label: t("hr.start_date"), type: "date" },
    { name: "paymentMethod", label: t("hr.payment_method"), type: "select", options: PAYMENT_METHOD },
    { name: "reason", label: t("hr.reason"), type: "textarea" },
  ];

  const columns: ResourceColumn<EmployeeLoan>[] = [
    { header: t("common.code"), render: (r) => r.code },
    { header: t("nav.employees"), render: (r) => employeeName(r.employeeId) },
    { header: t("hr.loan_type"), render: (r) => enumLabel(r.loanType, language) },
    { header: t("hr.amount"), render: (r) => r.amount },
    { header: t("hr.outstanding_amount"), render: (r) => r.outstandingAmount },
    {
      header: t("common.status"),
      render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge>,
    },
  ];

  return (
    <ResourceManager
      title={t("nav.employee_loans")}
      columns={columns}
      fields={fields}
      useList={useListEmployeeLoans}
      useCreate={useCreateEmployeeLoan}
      useUpdate={useUpdateEmployeeLoan}
      useDelete={useDeleteEmployeeLoan}
      getListQueryKey={getListEmployeeLoansQueryKey}
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
            <Button variant="outline" size="sm" disabled={disburseMutation.isPending} onClick={() => runAction(disburseMutation, r.id)}>
              {t("hr.disburse")}
            </Button>
          )}
        </>
      )}
    />
  );
}
