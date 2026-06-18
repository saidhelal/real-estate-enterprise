import {
  useListPolicies,
  useCreatePolicy,
  useUpdatePolicy,
  useDeletePolicy,
  getListPoliciesQueryKey,
  useListCompanies,
  type Policy,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function PoliciesPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "title", label: "Title", labelAr: "العنوان", required: true },
    { name: "policyType", label: "Type", labelAr: "النوع", type: "select", options: enumOptions(["policy", "regulation", "procedure", "guideline"]) },
    { name: "version", label: "Version", labelAr: "الإصدار" },
    { name: "effectiveDate", label: "Effective Date", labelAr: "تاريخ السريان", type: "date" },
    { name: "reviewDate", label: "Review Date", labelAr: "تاريخ المراجعة", type: "date" },
    { name: "ownerEmployeeId", label: "Owner (Employee ID)", labelAr: "المالك (معرّف الموظف)" },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
    { name: "status", label: "Status", labelAr: "الحالة", type: "select", options: enumOptions(["draft", "active", "under_review", "archived", "expired"]) },
    { name: "documentUrl", label: "Document URL", labelAr: "رابط المستند" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<Policy>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Title", headerAr: "العنوان", render: (r) => r.title },
    { header: "Type", headerAr: "النوع", render: (r) => <Badge variant="secondary">{enumLabel(r.policyType, language)}</Badge> },
    { header: "Status", headerAr: "الحالة", render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title="Policies"
      titleAr="اللوائح والسياسات"
      columns={columns}
      fields={fields}
      useList={useListPolicies}
      useCreate={useCreatePolicy}
      useUpdate={useUpdatePolicy}
      useDelete={useDeletePolicy}
      getListQueryKey={getListPoliciesQueryKey}
      companyId={companyId}
    />
  );
}
