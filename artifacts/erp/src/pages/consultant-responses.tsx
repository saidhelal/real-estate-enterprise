import {
  useListConsultantResponses,
  useCreateConsultantResponse,
  useUpdateConsultantResponse,
  useDeleteConsultantResponse,
  getListConsultantResponsesQueryKey,
  useListConsultants,
  useListCompanies,
  type ConsultantResponse,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";
import { enumLabel, enumOptions } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { Badge } from "@/components/ui/badge";

export default function ConsultantResponsesPage() {
  const { language } = useLanguage();
  const { options: DECISION } = useLookupOptions("submittal_status", ["approved", "approved_with_comments", "rejected"]);
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: consultantData } = useListConsultants({ pageSize: 200 });
  const consultantOptions = (consultantData?.data ?? []).map((o) => ({ value: o.id, label: o.name }));

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "referenceType", label: "Reference Type", labelAr: "نوع المرجع", type: "select", options: enumOptions(["rfi", "technical_submittal", "material_submittal"]) },
    { name: "referenceId", label: "Reference ID", labelAr: "معرّف المرجع" },
    { name: "consultantId", label: "Consultant", labelAr: "الاستشاري", type: "select", options: consultantOptions },
    { name: "response", label: "Response", labelAr: "الرد", type: "textarea" },
    { name: "decision", label: "Decision", labelAr: "القرار", type: "select", options: DECISION },
    { name: "responseDate", label: "Response Date", labelAr: "تاريخ الرد", type: "date" },
  ];

  const columns: ResourceColumn<ConsultantResponse>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code ?? "-"}</span> },
    { header: "Reference Type", headerAr: "نوع المرجع", render: (r) => <Badge variant="secondary">{enumLabel(r.referenceType, language)}</Badge> },
    { header: "Decision", headerAr: "القرار", render: (r) => <Badge variant="secondary">{enumLabel(r.decision, language)}</Badge> },
    { header: "Response Date", headerAr: "تاريخ الرد", render: (r) => r.responseDate ?? "-" },
  ];

  return (
    <ResourceManager
      title="Consultant Responses"
      titleAr="ردود الاستشاري"
      columns={columns}
      fields={fields}
      useList={useListConsultantResponses}
      useCreate={useCreateConsultantResponse}
      useUpdate={useUpdateConsultantResponse}
      useDelete={useDeleteConsultantResponse}
      getListQueryKey={getListConsultantResponsesQueryKey}
      companyId={companyId}
    />
  );
}
