import {
  useListMeetings,
  useCreateMeeting,
  useUpdateMeeting,
  useDeleteMeeting,
  getListMeetingsQueryKey,
  useListCompanies,
  type Meeting,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function MeetingsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "title", label: "Title", labelAr: "العنوان", required: true },
    { name: "meetingType", label: "Type", labelAr: "النوع", type: "select", options: enumOptions(["management", "board", "committee", "department"]) },
    { name: "scheduledAt", label: "Scheduled At", labelAr: "موعد الانعقاد", type: "date" },
    { name: "location", label: "Location", labelAr: "المكان" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["scheduled", "held", "completed", "postponed", "cancelled"]) },
    { name: "chairpersonEmployeeId", label: "Chairperson (Employee ID)", labelAr: "رئيس الاجتماع (معرّف الموظف)" },
    { name: "attendees", label: "Attendees", labelAr: "الحضور", type: "textarea" },
    { name: "agenda", label: "Agenda", labelAr: "جدول الأعمال", type: "textarea" },
    { name: "minutes", label: "Minutes", labelAr: "محضر الاجتماع", type: "textarea" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<Meeting>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Title", headerAr: "العنوان", render: (r) => r.title },
    { header: "Type", headerAr: "النوع", render: (r) => <Badge variant="secondary">{enumLabel(r.meetingType, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Meetings"
      titleAr="الاجتماعات"
      columns={columns}
      fields={fields}
      useList={useListMeetings}
      useCreate={useCreateMeeting}
      useUpdate={useUpdateMeeting}
      useDelete={useDeleteMeeting}
      getListQueryKey={getListMeetingsQueryKey}
      companyId={companyId}
    />
  );
}
