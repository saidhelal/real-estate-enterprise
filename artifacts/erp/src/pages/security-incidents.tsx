import {
  useListSecurityIncidents,
  useCreateSecurityIncident,
  useUpdateSecurityIncident,
  useDeleteSecurityIncident,
  getListSecurityIncidentsQueryKey,
  useListCompanies,
  type SecurityIncident,
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

/**
 * Security Incidents.
 *
 * What went wrong and what was done about it. The server refuses to
 * resolve or close an incident with no action recorded — a closed incident
 * nobody acted on is an unanswered one that has merely stopped being visible.
 *
 * Built on the shared ResourceManager, like every other register in the
 * system — the list, the form, the filters and the delete confirmation are
 * the same component, so this file describes the fields and nothing else.
 */
export default function SecurityIncidentsPage() {
  // Domain owned by the lookup engine. The literal is the fallback used
  // until the registry is seeded, so behaviour is unchanged either way.
  const { options: lk_priority_level } = useLookupOptions("priority_level", ["low", "medium", "high", "critical"]);
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    {
      name: "code",
      label: "Report No.",
      labelAr: "رقم البلاغ",
      // Issued by the central sequence engine on save; the input is locked
      // and labelled so nobody types a number the system owns.
      generated: true,
      // Names the server-side sequence, so the form can show the number
      // before it is issued.
      generatorKey: "securityIncident",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "occurredAt", label: "Occurred At", labelAr: "وقت الحدوث" },
    { name: "incidentType", label: "Type", labelAr: "نوع البلاغ", type: "select", options: enumOptions(["intrusion", "theft", "fire", "injury", "vandalism", "dispute", "breach", "other"]) },
    { name: "severity", label: "Severity", labelAr: "درجة الخطورة", type: "select", options: lk_priority_level },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea", required: true },
    { name: "location", label: "Location", labelAr: "الموقع" },
    { name: "pointId", label: "Security Point", labelAr: "نقطة الحراسة" },
    { name: "shiftId", label: "Shift", labelAr: "الوردية" },
    { name: "reportedByEmployeeId", label: "Reported By (Employee ID)", labelAr: "المبلّغ (معرّف الموظف)" },
    { name: "reportedByName", label: "Reported By (Name)", labelAr: "اسم المبلّغ" },
    { name: "visitorLogId", label: "Related Visitor", labelAr: "الزائر المرتبط" },
    { name: "assignedToEmployeeId", label: "Assigned To (Employee ID)", labelAr: "المسؤول (معرّف الموظف)" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["open", "investigating", "resolved", "closed"]) },
    { name: "actionTaken", label: "Action Taken", labelAr: "الإجراء المتخذ", type: "textarea" },
    { name: "taskId", label: "Follow-up Task", labelAr: "التكليف المرتبط" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<SecurityIncident>[] = [
    { header: "Report No.", headerAr: "رقم البلاغ", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Type", headerAr: "النوع", render: (r) => enumLabel(r.incidentType, language) },
    { header: "Severity", headerAr: "الخطورة", render: (r) => <Badge variant={r.severity === "critical" || r.severity === "high" ? "destructive" : "secondary"}>{enumLabel(r.severity, language)}</Badge> },
    { header: "Occurred", headerAr: "وقت الحدوث", render: (r) => new Date(r.occurredAt).toLocaleString() },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Security Incidents"
      titleAr="البلاغات الأمنية"
      columns={columns}
      fields={fields}
      useList={useListSecurityIncidents}
      useCreate={useCreateSecurityIncident}
      useUpdate={useUpdateSecurityIncident}
      useDelete={useDeleteSecurityIncident}
      getListQueryKey={getListSecurityIncidentsQueryKey}
      companyId={companyId}
    />
  );
}
