import { useQueryClient } from "@tanstack/react-query";
import {
  useListLeaveRequests,
  useCreateLeaveRequest,
  useUpdateLeaveRequest,
  useDeleteLeaveRequest,
  getListLeaveRequestsQueryKey,
  useSubmitLeaveRequest,
  useApproveLeaveRequest,
  useRejectLeaveRequest,
  useListEmployees,
  useListLeaveTypes,
  useListCompanies,
  type LeaveRequest,
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

const STATUS = enumOptions(["draft", "submitted", "approved", "rejected", "cancelled"]);

export default function LeaveRequestsPage() {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: employees } = useListEmployees({ pageSize: 200 });
  const { data: leaveTypes } = useListLeaveTypes({ pageSize: 200 });

  const submitMutation = useSubmitLeaveRequest();
  const approveMutation = useApproveLeaveRequest();
  const rejectMutation = useRejectLeaveRequest();

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

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListLeaveRequestsQueryKey() });

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
      generatorKey: "leaveRequest",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "employeeId", label: t("nav.employees"), type: "select", options: employeeOptions, required: true },
    { name: "leaveTypeId", label: t("nav.leave_types"), type: "select", options: leaveTypeOptions, required: true },
    { name: "startDate", label: t("hr.start_date"), type: "date", required: true },
    { name: "endDate", label: t("hr.end_date"), type: "date", required: true },
    { name: "days", label: t("hr.days"), type: "number" },
    { name: "reason", label: t("hr.reason"), type: "textarea" },
  ];

  const columns: ResourceColumn<LeaveRequest>[] = [
    { header: t("common.code"), render: (r) => r.code },
    { header: t("nav.employees"), render: (r) => employeeName(r.employeeId) },
    { header: t("hr.start_date"), render: (r) => r.startDate },
    { header: t("hr.end_date"), render: (r) => r.endDate },
    { header: t("hr.days"), render: (r) => r.days },
    {
      header: t("common.status"),
      render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge>,
    },
  ];

  return (
    <ResourceManager
      title={t("nav.leave_requests")}
      columns={columns}
      fields={fields}
      useList={useListLeaveRequests}
      useCreate={useCreateLeaveRequest}
      useUpdate={useUpdateLeaveRequest}
      useDelete={useDeleteLeaveRequest}
      getListQueryKey={getListLeaveRequestsQueryKey}
      companyId={companyId}
      canEdit={(r) => r.status === "draft"}
      canDelete={(r) => r.status === "draft"}
      rowActions={(r) => (
        <>
          {r.status === "draft" && (
            <Button variant="outline" size="sm" disabled={submitMutation.isPending} onClick={() => runAction(submitMutation, r.id)}>
              {t("hr.submit")}
            </Button>
          )}
          {r.status === "submitted" && (
            <>
              <Button variant="outline" size="sm" disabled={approveMutation.isPending} onClick={() => runAction(approveMutation, r.id)}>
                {t("hr.approve")}
              </Button>
              <Button variant="outline" size="sm" disabled={rejectMutation.isPending} onClick={() => runAction(rejectMutation, r.id)}>
                {t("hr.reject")}
              </Button>
            </>
          )}
        </>
      )}
    />
  );
}
