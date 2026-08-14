import {
  useListSecurityPoints,
  useCreateSecurityPoint,
  useUpdateSecurityPoint,
  useDeleteSecurityPoint,
  getListSecurityPointsQueryKey,
  useListCompanies,
  type SecurityPoint,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

/**
 * Security Points.
 *
 * The posts that have to be manned. A post is not a person and not a
 * shift: it is the place, its standing orders and who is accountable for it.
 *
 * Built on the shared ResourceManager, like every other register in the
 * system — the list, the form, the filters and the delete confirmation are
 * the same component, so this file describes the fields and nothing else.
 */
export default function SecurityPointsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence engine on save; the input is locked
      // and labelled so nobody types a number the system owns.
      generated: true,
      // Names the server-side sequence, so the form can show the number
      // before it is issued.
      generatorKey: "securityPoint",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية" },
    { name: "pointType", label: "Point Type", labelAr: "نوع النقطة", type: "select", options: enumOptions(["gate", "lobby", "perimeter", "parking", "floor", "site"]) },
    { name: "location", label: "Location", labelAr: "الموقع" },
    { name: "branchId", label: "Branch", labelAr: "الفرع" },
    { name: "supervisorEmployeeId", label: "Supervisor (Employee ID)", labelAr: "المسؤول (معرّف الموظف)" },
    { name: "instructions", label: "Standing Orders", labelAr: "التعليمات", type: "textarea" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["active", "suspended", "closed"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<SecurityPoint>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? (r.nameAr ?? r.name) : r.name) },
    { header: "Type", headerAr: "النوع", render: (r) => <Badge variant="secondary">{enumLabel(r.pointType, language)}</Badge> },
    { header: "Location", headerAr: "الموقع", render: (r) => r.location ?? "—" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Security Points"
      titleAr="نقاط الحراسة"
      columns={columns}
      fields={fields}
      useList={useListSecurityPoints}
      useCreate={useCreateSecurityPoint}
      useUpdate={useUpdateSecurityPoint}
      useDelete={useDeleteSecurityPoint}
      getListQueryKey={getListSecurityPointsQueryKey}
      companyId={companyId}
    />
  );
}
