import {
  useListContractTemplates,
  useCreateContractTemplate,
  useUpdateContractTemplate,
  useDeleteContractTemplate,
  getListContractTemplatesQueryKey,
  useListCompanies,
  type ContractTemplate,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

const CONTRACT_TYPE = enumOptions(["sales", "construction", "procurement", "legal", "other"]);

export default function ContractTemplatesPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: t("common.code"), required: true, createOnly: true },
    { name: "name", label: t("legal.name"), required: true },
    { name: "nameAr", label: t("legal.name_ar"), rtl: true },
    { name: "contractType", label: t("legal.contract_type"), type: "select", options: CONTRACT_TYPE, required: true },
    { name: "content", label: t("legal.content"), type: "textarea" },
    { name: "contentAr", label: `${t("legal.content")} (${t("legal.title_ar")})`, type: "textarea", rtl: true },
    { name: "description", label: t("legal.description"), type: "textarea" },
  ];

  const columns: ResourceColumn<ContractTemplate>[] = [
    { header: t("common.code"), render: (r) => r.code },
    { header: t("legal.name"), render: (r) => (language === "ar" ? (r.nameAr ?? r.name) : r.name) },
    { header: t("legal.contract_type"), render: (r) => enumLabel(r.contractType, language) },
    { header: t("common.status"), render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title={t("nav.contract_templates")}
      columns={columns}
      fields={fields}
      useList={useListContractTemplates}
      useCreate={useCreateContractTemplate}
      useUpdate={useUpdateContractTemplate}
      useDelete={useDeleteContractTemplate}
      getListQueryKey={getListContractTemplatesQueryKey}
      companyId={companyId}
    />
  );
}
