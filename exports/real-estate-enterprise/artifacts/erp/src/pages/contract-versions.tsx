import {
  useListContractVersions,
  useCreateContractVersion,
  useUpdateContractVersion,
  useDeleteContractVersion,
  getListContractVersionsQueryKey,
  useListLegalContracts,
  useListCompanies,
  type ContractVersion,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

export default function ContractVersionsPage() {
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
    { name: "versionNumber", label: t("legal.version_number"), type: "number", required: true },
    { name: "content", label: t("legal.content"), type: "textarea" },
    { name: "changeSummary", label: t("legal.change_summary"), type: "textarea" },
  ];

  const columns: ResourceColumn<ContractVersion>[] = [
    { header: t("nav.legal_contracts"), render: (r) => contractName(r.legalContractId) },
    { header: t("legal.version_number"), render: (r) => r.versionNumber },
    { header: t("legal.change_summary"), render: (r) => r.changeSummary ?? "-" },
    { header: t("common.status"), render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title={t("nav.contract_versions")}
      columns={columns}
      fields={fields}
      useList={useListContractVersions}
      useCreate={useCreateContractVersion}
      useUpdate={useUpdateContractVersion}
      useDelete={useDeleteContractVersion}
      getListQueryKey={getListContractVersionsQueryKey}
      companyId={companyId}
      searchable={false}
    />
  );
}
