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
import { useLanguage } from "@/lib/language-provider";

export default function InsuranceDataAmendmentsPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "employeeId", label: "Employee ID", labelAr: "معرّف الموظف", required: true },
    { name: "employeeInsuranceId", label: "Employee Insurance ID", labelAr: "معرّف تأمين الموظف" },
    { name: "amendmentType", label: "Amendment Type", labelAr: "نوع التعديل", type: "select", options: enumOptions(["salary","data","status"]) },
    { name: "fieldName", label: "Field", labelAr: "الحقل" },
    { name: "oldValue", label: "Old Value", labelAr: "القيمة القديمة" },
    { name: "newValue", label: "New Value", labelAr: "القيمة الجديدة" },
    { name: "amendmentDate", label: "Amendment Date", labelAr: "تاريخ التعديل", type: "date" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft","pending","submitted","approved","rejected"]) },
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
