import {
  useListContractEvents,
  useCreateContractEvent,
  useUpdateContractEvent,
  useDeleteContractEvent,
  getListContractEventsQueryKey,
  useListLegalContracts,
  useListCompanies,
  type ContractEvent,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumLabel } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export default function ContractEventsPage() {
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
    { name: "eventType", label: t("legal.event_type") },
    { name: "description", label: t("legal.description"), type: "textarea" },
  ];

  const columns: ResourceColumn<ContractEvent>[] = [
    { header: t("nav.legal_contracts"), render: (r) => contractName(r.legalContractId) },
    { header: t("legal.event_type"), render: (r) => enumLabel(r.eventType, language) },
    { header: t("legal.description"), render: (r) => r.description ?? "-" },
    { header: t("legal.event_date"), render: (r) => (r.eventDate ? new Date(r.eventDate).toLocaleString() : "-") },
  ];

  return (
    <ResourceManager
      title={t("nav.contract_events")}
      columns={columns}
      fields={fields}
      useList={useListContractEvents}
      useCreate={useCreateContractEvent}
      useUpdate={useUpdateContractEvent}
      useDelete={useDeleteContractEvent}
      getListQueryKey={getListContractEventsQueryKey}
      companyId={companyId}
      searchable={false}
    />
  );
}
