import {
  useListHandoverMinutes,
  useCreateHandoverMinute,
  useUpdateHandoverMinute,
  useDeleteHandoverMinute,
  getListHandoverMinutesQueryKey,
  useListCompanies,
  useListHandoverRequests,
  type HandoverMinute,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function HandoverMinutesPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: requestIdData } = useListHandoverRequests({ pageSize: 200 });
  const requestIdOptions = (requestIdData?.data ?? []).map((x) => ({ value: x.id, label: x.code, labelAr: x.code }));

  const fields: ResourceField[] = [
    { name: "requestId", label: "Handover Request", labelAr: "طلب التسليم", type: "select", required: true, options: requestIdOptions },
    { name: "minuteDate", label: "Minute Date", labelAr: "تاريخ المحضر", type: "date" },
    { name: "summary", label: "Summary", labelAr: "الملخص", required: true },
    { name: "summaryAr", label: "Summary (Arabic)", labelAr: "الملخص بالعربية", rtl: true },
    { name: "attendees", label: "Attendees", labelAr: "الحضور" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<HandoverMinute>[] = [
    { header: "Date", headerAr: "التاريخ", render: (r) => r.minuteDate ?? "-" },
    { header: "Summary", headerAr: "الملخص", render: (r) => language === "ar" ? (r.summaryAr ?? r.summary) : r.summary },
    { header: "Attendees", headerAr: "الحضور", render: (r) => r.attendees ?? "-" },
  ];

  return (
    <ResourceManager
      title="Handover Minutes"
      titleAr="محاضر التسليم"
      columns={columns}
      fields={fields}
      useList={useListHandoverMinutes}
      useCreate={useCreateHandoverMinute}
      useUpdate={useUpdateHandoverMinute}
      useDelete={useDeleteHandoverMinute}
      getListQueryKey={getListHandoverMinutesQueryKey}
      companyId={companyId}
    />
  );
}
