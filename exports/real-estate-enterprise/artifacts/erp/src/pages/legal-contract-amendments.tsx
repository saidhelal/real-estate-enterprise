import {
  useListLegalContractAmendments,
  useCreateLegalContractAmendment,
  useUpdateLegalContractAmendment,
  useDeleteLegalContractAmendment,
  getListLegalContractAmendmentsQueryKey,
  useListLegalContracts,
  useListCompanies,
  type LegalContractAmendment,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

export default function LegalContractAmendmentsPage() {
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
    { name: "amendmentDate", label: t("legal.amendment_date"), type: "date" },
    { name: "description", label: t("legal.description"), type: "textarea", required: true },
    { name: "descriptionAr", label: `${t("legal.description")} (${t("legal.title_ar")})`, type: "textarea", rtl: true },
    { name: "oldValue", label: t("legal.old_value") },
    { name: "newValue", label: t("legal.new_value") },
    { name: "valueChange", label: t("legal.value_change"), type: "money" },
  ];

  const columns: ResourceColumn<LegalContractAmendment>[] = [
    { header: t("common.code"), render: (r) => r.code ?? "-" },
    { header: t("nav.legal_contracts"), render: (r) => contractName(r.legalContractId) },
    { header: t("legal.amendment_date"), render: (r) => r.amendmentDate ?? "-" },
    { header: t("legal.value_change"), render: (r) => r.valueChange },
    { header: t("common.status"), render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title={t("nav.legal_contract_amendments")}
      columns={columns}
      fields={fields}
      useList={useListLegalContractAmendments}
      useCreate={useCreateLegalContractAmendment}
      useUpdate={useUpdateLegalContractAmendment}
      useDelete={useDeleteLegalContractAmendment}
      getListQueryKey={getListLegalContractAmendmentsQueryKey}
      companyId={companyId}
      searchable={false}
    />
  );
}
