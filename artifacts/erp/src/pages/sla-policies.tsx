import {
  useListSlaPolicies,
  useCreateSlaPolicy,
  useUpdateSlaPolicy,
  useDeleteSlaPolicy,
  getListSlaPoliciesQueryKey,
  useListCompanies,
  type SlaPolicy,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { useLanguage } from "@/lib/language-provider";

export default function SlaPoliciesPage() {
  const { language } = useLanguage();
  const CHANNEL = enumOptions(["complaint", "maintenance", "support", "all"]);
  const { options: PRIORITY } = useLookupOptions("service_priority", ["low", "medium", "high", "urgent"]);
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", required: true, rtl: true },
    { name: "channel", label: "Channel", labelAr: "القناة", type: "select", options: CHANNEL },
    { name: "priority", label: "Priority", labelAr: "الأولوية", type: "select", options: PRIORITY },
    { name: "firstResponseHours", label: "First Response (Hours)", labelAr: "أول استجابة (ساعات)", type: "money" },
    { name: "resolutionHours", label: "Resolution (Hours)", labelAr: "الحل (ساعات)", type: "money" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<SlaPolicy>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => language === "ar" ? (r.nameAr ?? r.name) : r.name },
    { header: "Channel", headerAr: "القناة", render: (r) => <Badge variant="secondary">{enumLabel(r.channel, language)}</Badge> },
    { header: "Priority", headerAr: "الأولوية", render: (r) => <Badge variant="secondary">{enumLabel(r.priority, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="SLA Policies"
      titleAr="سياسات مستوى الخدمة"
      columns={columns}
      fields={fields}
      useList={useListSlaPolicies}
      useCreate={useCreateSlaPolicy}
      useUpdate={useUpdateSlaPolicy}
      useDelete={useDeleteSlaPolicy}
      getListQueryKey={getListSlaPoliciesQueryKey}
      companyId={companyId}
    />
  );
}
