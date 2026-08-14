import {
  useListCorrespondence,
  useCreateCorrespondence,
  useUpdateCorrespondence,
  useDeleteCorrespondence,
  getListCorrespondenceQueryKey,
  useListCompanies,
  type Correspondence,
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

export default function CorrespondencePage() {
  // Domain owned by the lookup engine. The literal is the fallback used
  // until the registry is seeded, so behaviour is unchanged either way.
  const { options: lk_urgency_level } = useLookupOptions("urgency_level", ["low", "medium", "high", "urgent"]);
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
      generatorKey: "correspondence",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "subject", label: "Subject", labelAr: "الموضوع", required: true },
    { name: "direction", label: "Direction", labelAr: "الاتجاه", type: "select", options: enumOptions(["incoming", "outgoing", "internal"]) },
    { name: "correspondenceType", label: "Type", labelAr: "النوع", type: "select", options: enumOptions(["letter", "memo", "email", "fax"]) },
    { name: "senderName", label: "Sender", labelAr: "المُرسِل" },
    { name: "recipientName", label: "Recipient", labelAr: "المُستلِم" },
    { name: "refNumber", label: "Reference No.", labelAr: "رقم المرجع" },
    { name: "correspondenceDate", label: "Date", labelAr: "التاريخ", type: "date" },
    { name: "priority", label: "Priority", labelAr: "الأولوية", type: "select", options: lk_urgency_level },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["received", "in_progress", "replied", "archived", "closed"]) },
    { name: "assignedToEmployeeId", label: "Assigned To (Employee ID)", labelAr: "مُسند إلى (معرّف الموظف)" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<Correspondence>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Subject", headerAr: "الموضوع", render: (r) => r.subject },
    { header: "Direction", headerAr: "الاتجاه", render: (r) => <Badge variant="secondary">{enumLabel(r.direction, language)}</Badge> },
    { header: "Type", headerAr: "النوع", render: (r) => <Badge variant="secondary">{enumLabel(r.correspondenceType, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Correspondence"
      titleAr="المراسلات"
      columns={columns}
      fields={fields}
      useList={useListCorrespondence}
      useCreate={useCreateCorrespondence}
      useUpdate={useUpdateCorrespondence}
      useDelete={useDeleteCorrespondence}
      getListQueryKey={getListCorrespondenceQueryKey}
      companyId={companyId}
    />
  );
}
