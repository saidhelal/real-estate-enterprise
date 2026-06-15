import {
  useListAccountMappings,
  useCreateAccountMapping,
  useUpdateAccountMapping,
  useDeleteAccountMapping,
  getListAccountMappingsQueryKey,
  useListCompanies,
  useListAccounts,
  type AccountMappingDetail,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { useLanguage } from "@/lib/language-provider";

export default function AccountMappingsPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: accounts } = useListAccounts({ pageSize: 500 });

  const accountList = accounts?.data ?? [];
  const accountOptions = accountList.map((a) => ({
    value: a.id,
    label: `${a.code} - ${a.name}`,
    labelAr: `${a.code} - ${a.nameAr}`,
  }));
  const accountLabel = (id: string | null | undefined) => {
    if (!id) return "—";
    const a = accountList.find((x) => x.id === id);
    if (!a) return id;
    return `${a.code} - ${language === "ar" ? a.nameAr : a.name}`;
  };

  const fields: ResourceField[] = [
    { name: "eventKey", label: t("acc.event_key"), required: true, createOnly: true },
    { name: "debitAccountId", label: t("acc.debit_account"), type: "select", options: accountOptions },
    { name: "creditAccountId", label: t("acc.credit_account"), type: "select", options: accountOptions },
    { name: "description", label: t("acc.description"), type: "textarea" },
  ];

  const columns: ResourceColumn<AccountMappingDetail>[] = [
    { header: t("acc.event_key"), render: (r) => <span className="font-medium">{r.eventKey}</span> },
    { header: t("acc.debit_account"), render: (r) => accountLabel(r.debitAccountId) },
    { header: t("acc.credit_account"), render: (r) => accountLabel(r.creditAccountId) },
  ];

  return (
    <ResourceManager
      title={t("nav.account_mappings")}
      columns={columns}
      fields={fields}
      useList={useListAccountMappings}
      useCreate={useCreateAccountMapping}
      useUpdate={useUpdateAccountMapping}
      useDelete={useDeleteAccountMapping}
      getListQueryKey={getListAccountMappingsQueryKey}
      companyId={companyId}
    />
  );
}
