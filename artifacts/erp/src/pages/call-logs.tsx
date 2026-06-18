import {
  useListCallLogs,
  useCreateCallLog,
  useUpdateCallLog,
  useDeleteCallLog,
  getListCallLogsQueryKey,
  useListCompanies,
  type CallLog,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function CallLogsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "customerId", label: "Customer ID", labelAr: "معرّف العميل" },
    { name: "direction", label: "Direction", labelAr: "الاتجاه", type: "select", options: enumOptions(["inbound", "outbound"]) },
    { name: "channel", label: "Channel", labelAr: "القناة", type: "select", options: enumOptions(["phone", "email", "whatsapp", "sms"]) },
    { name: "subject", label: "Subject", labelAr: "الموضوع", required: true },
    { name: "summary", label: "Summary", labelAr: "الملخص", type: "textarea" },
    { name: "callStatus", label: "Call Status", labelAr: "حالة المكالمة", type: "select", options: enumOptions(["completed", "missed", "no_answer", "voicemail"]) },
    { name: "durationMinutes", label: "Duration (min)", labelAr: "المدة (دقيقة)", type: "money" },
    { name: "agentUserId", label: "Agent (User ID)", labelAr: "الموظف (معرّف المستخدم)" },
    { name: "followUpRequired", label: "Follow-up Required", labelAr: "يتطلب متابعة", type: "boolean" },
    { name: "calledAt", label: "Called At", labelAr: "تاريخ المكالمة", type: "date" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<CallLog>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Subject", headerAr: "الموضوع", render: (r) => r.subject },
    { header: "Direction", headerAr: "الاتجاه", render: (r) => <Badge variant="secondary">{enumLabel(r.direction, language)}</Badge> },
    { header: "Channel", headerAr: "القناة", render: (r) => <Badge variant="secondary">{enumLabel(r.channel, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.callStatus, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Call Center"
      titleAr="مركز الاتصال"
      columns={columns}
      fields={fields}
      useList={useListCallLogs}
      useCreate={useCreateCallLog}
      useUpdate={useUpdateCallLog}
      useDelete={useDeleteCallLog}
      getListQueryKey={getListCallLogsQueryKey}
      companyId={companyId}
    />
  );
}
