import {
  useListSecurityShifts,
  useCreateSecurityShift,
  useUpdateSecurityShift,
  useDeleteSecurityShift,
  getListSecurityShiftsQueryKey,
  useListCompanies,
  type SecurityShift,
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
 * Security Shifts.
 *
 * Who is on which post, when. Check-in and check-out are stamped by the
 * server when the status moves, and a handover is a distinct act with its own
 * endpoint — so the rota records what happened, not just what was planned.
 *
 * Built on the shared ResourceManager, like every other register in the
 * system — the list, the form, the filters and the delete confirmation are
 * the same component, so this file describes the fields and nothing else.
 */
export default function SecurityShiftsPage() {
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
      generatorKey: "securityShift",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "pointId", label: "Security Point", labelAr: "نقطة الحراسة", required: true },
    { name: "guardEmployeeId", label: "Guard (Employee ID)", labelAr: "الحارس (معرّف الموظف)" },
    { name: "shiftDate", label: "Shift Date", labelAr: "تاريخ الوردية", type: "date", required: true },
    { name: "shiftType", label: "Shift", labelAr: "الوردية", type: "select", options: enumOptions(["morning", "evening", "night"]) },
    { name: "startAt", label: "Starts", labelAr: "بداية الوردية" },
    { name: "endAt", label: "Ends", labelAr: "نهاية الوردية" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["scheduled", "in_progress", "handed_over", "completed", "missed"]) },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<SecurityShift>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Date", headerAr: "التاريخ", render: (r) => r.shiftDate },
    { header: "Shift", headerAr: "الوردية", render: (r) => <Badge variant="secondary">{enumLabel(r.shiftType, language)}</Badge> },
    { header: "On post", headerAr: "استلام", render: (r) => (r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString() : "—") },
    { header: "Handover", headerAr: "التسليم", render: (r) => (r.handoverNotes ? "✓" : "—") },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Security Shifts"
      titleAr="الورديات"
      columns={columns}
      fields={fields}
      useList={useListSecurityShifts}
      useCreate={useCreateSecurityShift}
      useUpdate={useUpdateSecurityShift}
      useDelete={useDeleteSecurityShift}
      getListQueryKey={getListSecurityShiftsQueryKey}
      companyId={companyId}
    />
  );
}
