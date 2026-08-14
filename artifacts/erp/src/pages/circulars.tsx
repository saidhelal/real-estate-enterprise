import {
  useListCirculars,
  useCreateCircular,
  useUpdateCircular,
  useDeleteCircular,
  getListCircularsQueryKey,
  useListCompanies,
  type Circular,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function CircularsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence engine on save; shown in the form
      // before saving and never typed in.
      generated: true,
      generatorKey: "circular",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "title", label: "Title", labelAr: "العنوان", required: true },
    { name: "circularNumber", label: "Circular Number", labelAr: "رقم التعميم" },
    { name: "issueDate", label: "Issue Date", labelAr: "تاريخ الإصدار", type: "date" },
    { name: "effectiveDate", label: "Effective Date", labelAr: "تاريخ السريان", type: "date" },
    { name: "issuedByEmployeeId", label: "Issued By (Employee ID)", labelAr: "صادر عن (معرّف الموظف)" },
    { name: "audience", label: "Audience", labelAr: "الجهة المستهدفة", type: "select", options: enumOptions(["all", "management", "department", "branch"]) },
    { name: "departmentId", label: "Department ID", labelAr: "معرّف الإدارة" },
    { name: "body", label: "Body", labelAr: "النص", type: "textarea" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft", "published", "archived"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<Circular>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Title", headerAr: "العنوان", render: (r) => r.title },
    { header: "Audience", headerAr: "الجهة", render: (r) => <Badge variant="secondary">{enumLabel(r.audience, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Circulars"
      titleAr="التعاميم"
      columns={columns}
      fields={fields}
      useList={useListCirculars}
      useCreate={useCreateCircular}
      useUpdate={useUpdateCircular}
      useDelete={useDeleteCircular}
      getListQueryKey={getListCircularsQueryKey}
      companyId={companyId}
    />
  );
}
