import {
  useListInsuranceDataAmendments,
  useCreateInsuranceDataAmendment,
  useUpdateInsuranceDataAmendment,
  useDeleteInsuranceDataAmendment,
  getListInsuranceDataAmendmentsQueryKey,
  useListCompanies,
  type InsuranceDataAmendment,
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

export default function InsuranceDataAmendmentsPage() {
  // Domain owned by the lookup engine. The literal is the fallback used
  // until the registry is seeded, so behaviour is unchanged either way.
  const { options: lk_approval_flow_status } = useLookupOptions("approval_flow_status", ["draft", "pending", "submitted", "approved", "rejected"]);
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
      generatorKey: "insuranceDataAmendment",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "employeeId", label: "Employee ID", labelAr: "معرّف الموظف", required: true },
    { name: "employeeInsuranceId", label: "Employee Insurance ID", labelAr: "معرّف تأمين الموظف" },
    { name: "amendmentType", label: "Amendment Type", labelAr: "نوع التعديل", type: "select", options: enumOptions(["salary","data","status"]) },
    { name: "fieldName", label: "Field", labelAr: "الحقل" },
    { name: "oldValue", label: "Old Value", labelAr: "القيمة القديمة" },
    { name: "newValue", label: "New Value", labelAr: "القيمة الجديدة" },
    { name: "amendmentDate", label: "Amendment Date", labelAr: "تاريخ التعديل", type: "date" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: lk_approval_flow_status },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<InsuranceDataAmendment>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Employee ID", headerAr: "معرّف الموظف", render: (r) => r.employeeId ?? "-" },
    { header: "Type", headerAr: "النوع", render: (r) => <Badge variant="secondary">{enumLabel(r.amendmentType, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Insurance Data Amendments"
      titleAr="تعديلات البيانات"
      columns={columns}
      fields={fields}
      useList={useListInsuranceDataAmendments}
      useCreate={useCreateInsuranceDataAmendment}
      useUpdate={useUpdateInsuranceDataAmendment}
      useDelete={useDeleteInsuranceDataAmendment}
      getListQueryKey={getListInsuranceDataAmendmentsQueryKey}
      companyId={companyId}
    />
  );
}
