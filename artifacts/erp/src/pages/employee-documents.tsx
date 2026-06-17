import {
  useListEmployeeDocuments,
  useCreateEmployeeDocument,
  useUpdateEmployeeDocument,
  useDeleteEmployeeDocument,
  getListEmployeeDocumentsQueryKey,
  useListEmployees,
  useListCompanies,
  type EmployeeDocument,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

const STATUS = enumOptions(["active", "inactive"]);

export default function EmployeeDocumentsPage() {
  const { language, t } = useLanguage();
  const DOC_TYPE = enumOptions(["id_card", "passport", "visa", "certificate", "work_permit", "contract", "other"]);
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: employees } = useListEmployees({ pageSize: 200 });

  const employeeOptions = (employees?.data ?? []).map((e) => ({
    value: e.id,
    label: `${e.code} - ${e.firstName} ${e.lastName}`,
    labelAr: `${e.code} - ${e.firstNameAr ?? e.firstName} ${e.lastNameAr ?? e.lastName}`,
  }));
  const employeeName = (id: string | null | undefined) => {
    const e = (employees?.data ?? []).find((x) => x.id === id);
    return e ? `${e.firstName} ${e.lastName}` : "-";
  };

  const fields: ResourceField[] = [
    { name: "employeeId", label: t("nav.employees"), type: "select", options: employeeOptions, required: true },
    { name: "documentType", label: t("hr.document_type"), type: "select", options: DOC_TYPE },
    { name: "title", label: t("common.title"), required: true },
    { name: "documentNumber", label: t("hr.document_number") },
    { name: "issueDate", label: t("hr.issue_date"), type: "date" },
    { name: "expiryDate", label: t("hr.expiry_date"), type: "date" },
    { name: "fileUrl", label: t("hr.file_url") },
    { name: "notes", label: t("common.notes"), type: "textarea" },
    { name: "status", label: t("common.status"), type: "select", options: STATUS },
  ];

  const columns: ResourceColumn<EmployeeDocument>[] = [
    { header: t("nav.employees"), render: (r) => employeeName(r.employeeId) },
    { header: t("hr.document_type"), render: (r) => enumLabel(r.documentType, language) },
    { header: t("common.title"), render: (r) => r.title },
    { header: t("hr.expiry_date"), render: (r) => r.expiryDate ?? "-" },
    {
      header: t("common.status"),
      render: (r) => (
        <Badge variant={r.status === "active" ? "secondary" : "outline"}>
          {enumLabel(r.status, language)}
        </Badge>
      ),
    },
  ];

  return (
    <ResourceManager
      title={t("nav.employee_documents")}
      columns={columns}
      fields={fields}
      useList={useListEmployeeDocuments}
      useCreate={useCreateEmployeeDocument}
      useUpdate={useUpdateEmployeeDocument}
      useDelete={useDeleteEmployeeDocument}
      getListQueryKey={getListEmployeeDocumentsQueryKey}
      companyId={companyId}
    />
  );
}
