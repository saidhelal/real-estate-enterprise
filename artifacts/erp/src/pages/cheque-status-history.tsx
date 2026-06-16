import {
  useListChequeStatusHistorys,
  useCreateChequeStatusHistory,
  useUpdateChequeStatusHistory,
  useDeleteChequeStatusHistory,
  getListChequeStatusHistorysQueryKey,
  useListCompanies,
  type ChequeStatusHistory,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

export default function ChequeStatusHistorysPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: t("common.code"), required: true, createOnly: true },
    { name: "action", label: t("acc.action") },
    { name: "fromStatus", label: t("acc.from_status") },
    { name: "toStatus", label: t("acc.to_status") },
    { name: "actorName", label: t("acc.actor") },
    { name: "actionDate", label: t("acc.action_date"), type: "date" },
    { name: "notes", label: t("acc.description"), type: "textarea" },
  ];

  const columns: ResourceColumn<ChequeStatusHistory>[] = [
    { header: t("common.code"), render: (r) => <span className="font-medium">{r.code}</span> },
    { header: t("acc.action"), render: (r) => r.action ?? "-" },
    { header: t("acc.from_status"), render: (r) => (r.fromStatus ? <Badge variant="outline">{enumLabel(r.fromStatus, language)}</Badge> : "-") },
    { header: t("acc.to_status"), render: (r) => (r.toStatus ? <Badge variant="secondary">{enumLabel(r.toStatus, language)}</Badge> : "-") },
    { header: t("acc.actor"), render: (r) => r.actorName ?? "-" },
    { header: t("acc.action_date"), render: (r) => r.actionDate ?? "-" },
  ];

  return (
    <ResourceManager
      title={t("nav.cheque_status_history")}
      columns={columns}
      fields={fields}
      useList={useListChequeStatusHistorys}
      useCreate={useCreateChequeStatusHistory}
      useUpdate={useUpdateChequeStatusHistory}
      useDelete={useDeleteChequeStatusHistory}
      getListQueryKey={getListChequeStatusHistorysQueryKey}
      companyId={companyId}
      canCreate={false}
      canEdit={false}
      canDelete={false}
    />
  );
}
