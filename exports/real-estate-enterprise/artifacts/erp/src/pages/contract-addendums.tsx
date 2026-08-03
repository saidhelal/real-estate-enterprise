import {
  useListContractAddendums,
  useCreateContractAddendum,
  useUpdateContractAddendum,
  useDeleteContractAddendum,
  getListContractAddendumsQueryKey,
  useListLegalContracts,
  useListCompanies,
  type ContractAddendum,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

export default function ContractAddendumsPage() {
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
    { name: "code", label: t("common.code") },
    { name: "title", label: t("legal.title"), required: true },
    { name: "addendumDate", label: t("legal.addendum_date"), type: "date" },
    { name: "content", label: t("legal.content"), type: "textarea" },
  ];

  const columns: ResourceColumn<ContractAddendum>[] = [
    { header: t("common.code"), render: (r) => r.code ?? "-" },
    { header: t("legal.title"), render: (r) => r.title },
    { header: t("nav.legal_contracts"), render: (r) => contractName(r.legalContractId) },
    { header: t("legal.addendum_date"), render: (r) => r.addendumDate ?? "-" },
    { header: t("common.status"), render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title={t("nav.contract_addendums")}
      columns={columns}
      fields={fields}
      useList={useListContractAddendums}
      useCreate={useCreateContractAddendum}
      useUpdate={useUpdateContractAddendum}
      useDelete={useDeleteContractAddendum}
      getListQueryKey={getListContractAddendumsQueryKey}
      companyId={companyId}
      searchable={false}
    />
  );
}
