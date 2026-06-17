import {
  useListAccounts,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
  getListAccountsQueryKey,
  useListCompanies,
  type AccountDetail,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

const SIDES = enumOptions(["debit", "credit"]);
const STATUS = enumOptions(["active", "inactive"]);

export default function AccountsPage() {
  const { language, t } = useLanguage();
  const { options: TYPES } = useLookupOptions("account_type", ["asset", "liability", "equity", "revenue", "expense"]);
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: accounts } = useListAccounts({ pageSize: 500 });

  const parentOptions = (accounts?.data ?? []).map((a) => ({
    value: a.id,
    label: `${a.code} - ${a.name}`,
    labelAr: `${a.code} - ${a.nameAr}`,
  }));

  const fields: ResourceField[] = [
    { name: "code", label: t("common.code"), required: true, createOnly: true },
    { name: "name", label: t("common.name"), required: true },
    { name: "nameAr", label: t("common.name_ar"), required: true, rtl: true },
    { name: "type", label: t("acc.type"), type: "select", required: true, options: TYPES },
    { name: "normalSide", label: t("acc.normal_side"), type: "select", required: true, options: SIDES },
    { name: "parentId", label: t("acc.parent"), type: "select", options: parentOptions },
    { name: "isPostable", label: t("acc.postable"), type: "boolean" },
    { name: "status", label: t("common.status"), type: "select", options: STATUS },
    { name: "description", label: t("acc.description"), type: "textarea" },
  ];

  const columns: ResourceColumn<AccountDetail>[] = [
    { header: t("common.code"), render: (r) => <span className="font-medium">{r.code}</span> },
    { header: t("common.name"), render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: t("acc.type"), render: (r) => <Badge variant="secondary">{enumLabel(r.type, language)}</Badge> },
    { header: t("acc.normal_side"), render: (r) => enumLabel(r.normalSide, language) },
    { header: t("acc.postable"), render: (r) => (r.isPostable ? "✓" : "—") },
    { header: t("common.status"), render: (r) => <Badge variant="outline">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title={t("nav.accounts")}
      columns={columns}
      fields={fields}
      useList={useListAccounts}
      useCreate={useCreateAccount}
      useUpdate={useUpdateAccount}
      useDelete={useDeleteAccount}
      getListQueryKey={getListAccountsQueryKey}
      companyId={companyId}
    />
  );
}
