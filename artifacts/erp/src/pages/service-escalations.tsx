import {
  useListServiceEscalations,
  useCreateServiceEscalation,
  useUpdateServiceEscalation,
  useDeleteServiceEscalation,
  getListServiceEscalationsQueryKey,
  useListCompanies,
  type ServiceEscalation,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function ServiceEscalationsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "sourceType", label: "Source Type", labelAr: "نوع المصدر", type: "select", required: true, options: enumOptions(["complaint", "maintenance", "support"]) },
    { name: "sourceId", label: "Source ID", labelAr: "معرّف المصدر", required: true },
    { name: "level", label: "Level", labelAr: "المستوى", type: "number" },
    { name: "escalatedToUserId", label: "Escalated To (User ID)", labelAr: "تم التصعيد إلى (معرّف المستخدم)" },
    { name: "reason", label: "Reason", labelAr: "السبب" },
    { name: "reasonAr", label: "Reason (Arabic)", labelAr: "السبب بالعربية", rtl: true },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["open", "acknowledged"]) },
    { name: "escalatedAt", label: "Escalated At", labelAr: "تاريخ التصعيد", type: "date" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<ServiceEscalation>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Source", headerAr: "المصدر", render: (r) => <Badge variant="secondary">{enumLabel(r.sourceType, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
    { header: "Escalated At", headerAr: "تاريخ التصعيد", render: (r) => r.escalatedAt ?? "-" },
  ];

  return (
    <ResourceManager
      title="Service Escalations"
      titleAr="تصعيدات الخدمة"
      columns={columns}
      fields={fields}
      useList={useListServiceEscalations}
      useCreate={useCreateServiceEscalation}
      useUpdate={useUpdateServiceEscalation}
      useDelete={useDeleteServiceEscalation}
      getListQueryKey={getListServiceEscalationsQueryKey}
      companyId={companyId}
    />
  );
}
