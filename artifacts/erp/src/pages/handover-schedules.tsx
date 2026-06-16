import {
  useListHandoverSchedules,
  useCreateHandoverSchedule,
  useUpdateHandoverSchedule,
  useDeleteHandoverSchedule,
  getListHandoverSchedulesQueryKey,
  useListCompanies,
  useListHandoverRequests,
  type HandoverSchedule,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function HandoverSchedulesPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: requestIdData } = useListHandoverRequests({ pageSize: 200 });
  const requestIdOptions = (requestIdData?.data ?? []).map((x) => ({ value: x.id, label: x.code, labelAr: x.code }));

  const fields: ResourceField[] = [
    { name: "requestId", label: "Handover Request", labelAr: "طلب التسليم", type: "select", required: true, options: requestIdOptions },
    { name: "scheduledDate", label: "Scheduled Date", labelAr: "التاريخ المجدول", type: "date" },
    { name: "scheduledTime", label: "Scheduled Time", labelAr: "الوقت المجدول" },
    { name: "location", label: "Location", labelAr: "الموقع" },
    { name: "locationAr", label: "Location (Arabic)", labelAr: "الموقع بالعربية", rtl: true },
    { name: "assignedToUserId", label: "Assigned To (User ID)", labelAr: "مُسند إلى (معرّف المستخدم)" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["scheduled", "rescheduled", "done", "cancelled"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<HandoverSchedule>[] = [
    { header: "Scheduled Date", headerAr: "التاريخ المجدول", render: (r) => r.scheduledDate ?? "-" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Location", headerAr: "الموقع", render: (r) => r.location ?? "-" },
  ];

  return (
    <ResourceManager
      title="Handover Schedules"
      titleAr="مواعيد التسليم"
      columns={columns}
      fields={fields}
      useList={useListHandoverSchedules}
      useCreate={useCreateHandoverSchedule}
      useUpdate={useUpdateHandoverSchedule}
      useDelete={useDeleteHandoverSchedule}
      getListQueryKey={getListHandoverSchedulesQueryKey}
      companyId={companyId}
    />
  );
}
