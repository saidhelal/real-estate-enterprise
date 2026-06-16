import {
  useListLegalCaseLinks,
  useCreateLegalCaseLink,
  useUpdateLegalCaseLink,
  useDeleteLegalCaseLink,
  getListLegalCaseLinksQueryKey,
  useListLegalCases,
  useListCompanies,
  type LegalCaseLink,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

const LINKED_MODULE = enumOptions([
  "customer", "contractor", "supplier", "employee", "project", "contract", "reservation", "other",
]);

export default function LegalCaseLinksPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: cases } = useListLegalCases({ pageSize: 200 });

  const caseOptions = (cases?.data ?? []).map((x) => ({
    value: x.id,
    label: `${x.code} - ${x.title}`,
    labelAr: `${x.code} - ${x.titleAr ?? x.title}`,
  }));
  const caseName = (id: string | null | undefined) => {
    const c = (cases?.data ?? []).find((x) => x.id === id);
    return c ? `${c.code} - ${c.title}` : "-";
  };

  const fields: ResourceField[] = [
    { name: "legalCaseId", label: t("legal.case"), type: "select", options: caseOptions, required: true },
    { name: "linkedModule", label: t("legal.linked_module"), type: "select", options: LINKED_MODULE, required: true },
    { name: "linkedName", label: t("legal.linked_name") },
    { name: "notes", label: t("legal.notes"), type: "textarea" },
  ];

  const columns: ResourceColumn<LegalCaseLink>[] = [
    { header: t("legal.case"), render: (r) => caseName(r.legalCaseId) },
    { header: t("legal.linked_module"), render: (r) => enumLabel(r.linkedModule, language) },
    { header: t("legal.linked_name"), render: (r) => r.linkedName ?? "-" },
  ];

  return (
    <ResourceManager
      title={t("nav.legal_case_links")}
      columns={columns}
      fields={fields}
      useList={useListLegalCaseLinks}
      useCreate={useCreateLegalCaseLink}
      useUpdate={useUpdateLegalCaseLink}
      useDelete={useDeleteLegalCaseLink}
      getListQueryKey={getListLegalCaseLinksQueryKey}
      companyId={companyId}
      searchable={false}
    />
  );
}
