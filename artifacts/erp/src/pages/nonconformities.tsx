import {
  useListNonconformitys,
  useCreateNonconformity,
  useUpdateNonconformity,
  useDeleteNonconformity,
  getListNonconformitysQueryKey,
  useListCompanies,
  type Nonconformity,
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
 * Nonconformities.
 *
 * Findings that a rule was not followed. A finding cannot be closed while
 * its corrective actions are still open — the server refuses, because closing
 * one on the strength of work nobody has done records a problem as solved.
 *
 * Corrective actions are not managed here: they live in the one
 * `corrective_actions` register, reached from the Engineering module, and
 * reference this finding.
 *
 * Built on the shared ResourceManager, like every other register in the
 * system — the list, the form, the filters and the delete confirmation are
 * the same component, so this file describes the fields and nothing else.
 */
export default function NonconformitiesPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Code",
      labelAr: "الرقم",
      // Issued by the central sequence engine on save; the input is locked
      // and labelled so nobody types a number the system owns.
      generated: true,
      // Names the server-side sequence, so the form can show the number
      // before it is issued.
      generatorKey: "nonconformity",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "title", label: "Title", labelAr: "العنوان", required: true },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea", required: true },
    { name: "source", label: "Source", labelAr: "المصدر", type: "select", options: enumOptions(["internal_audit", "external_audit", "inspection", "complaint", "incident", "review"]) },
    { name: "raisedDate", label: "Raised", labelAr: "التاريخ", type: "date" },
    { name: "departmentId", label: "Department", labelAr: "الإدارة" },
    { name: "category", label: "Category", labelAr: "التصنيف", type: "select", options: enumOptions(["process", "product", "documentation", "safety", "compliance", "service"]) },
    { name: "severity", label: "Severity", labelAr: "درجة الخطورة", type: "select", options: enumOptions(["minor", "major", "critical"]) },
    { name: "policyId", label: "Related Policy", labelAr: "السياسة المرتبطة" },
    { name: "rootCause", label: "Root Cause", labelAr: "السبب الجذري", type: "textarea" },
    { name: "ownerEmployeeId", label: "Owner (Employee ID)", labelAr: "المسؤول (معرّف الموظف)" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["open", "investigating", "action_pending", "verifying", "closed", "rejected"]) },
    { name: "dueDate", label: "Due", labelAr: "الموعد", type: "date" },
    { name: "closureNotes", label: "Closure Notes", labelAr: "ملاحظات الإغلاق", type: "textarea" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<Nonconformity>[] = [
    { header: "Code", headerAr: "الرقم", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Title", headerAr: "العنوان", render: (r) => r.title },
    { header: "Source", headerAr: "المصدر", render: (r) => enumLabel(r.source, language) },
    { header: "Severity", headerAr: "الخطورة", render: (r) => <Badge variant={r.severity === "critical" ? "destructive" : "secondary"}>{enumLabel(r.severity, language)}</Badge> },
    { header: "Due", headerAr: "الموعد", render: (r) => r.dueDate ?? "—" },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Nonconformities"
      titleAr="عدم المطابقة"
      columns={columns}
      fields={fields}
      useList={useListNonconformitys}
      useCreate={useCreateNonconformity}
      useUpdate={useUpdateNonconformity}
      useDelete={useDeleteNonconformity}
      getListQueryKey={getListNonconformitysQueryKey}
      companyId={companyId}
    />
  );
}
