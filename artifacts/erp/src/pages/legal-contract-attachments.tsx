import {
  useListLegalContractAttachments,
  useCreateLegalContractAttachment,
  useUpdateLegalContractAttachment,
  useDeleteLegalContractAttachment,
  getListLegalContractAttachmentsQueryKey,
  useListLegalContracts,
  useListCompanies,
  type LegalContractAttachment,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

export default function LegalContractAttachmentsPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: contracts } = useListLegalContracts({ pageSize: 200 });

  const contractOptions = (contracts?.data ?? []).map((x) => ({
    value: x.id,
    label: `${x.code} - ${x.title}`,
    labelAr: `${x.code} - ${x.titleAr ?? x.title}`,
  }));
  const contractName = (id: string | null | undefined) => {
    const c = (contracts?.data ?? []).find((x) => x.id === id);
    return c ? `${c.code} - ${c.title}` : "-";
  };

  const fields: ResourceField[] = [
    { name: "legalContractId", label: t("nav.legal_contracts"), type: "select", options: contractOptions, required: true },
    { name: "title", label: t("legal.title"), required: true },
    { name: "documentType", label: t("legal.document_type") },
    { name: "fileUrl", label: t("legal.file_url") },
    { name: "notes", label: t("legal.notes"), type: "textarea" },
  ];

  const columns: ResourceColumn<LegalContractAttachment>[] = [
    { header: t("legal.title"), render: (r) => r.title },
    { header: t("nav.legal_contracts"), render: (r) => contractName(r.legalContractId) },
    { header: t("legal.document_type"), render: (r) => enumLabel(r.documentType, language) },
    { header: t("common.status"), render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title={t("nav.legal_contract_attachments")}
      columns={columns}
      fields={fields}
      useList={useListLegalContractAttachments}
      useCreate={useCreateLegalContractAttachment}
      useUpdate={useUpdateLegalContractAttachment}
      useDelete={useDeleteLegalContractAttachment}
      getListQueryKey={getListLegalContractAttachmentsQueryKey}
      companyId={companyId}
      searchable={false}
    />
  );
}
