import {
  useListTaxCodes,
  useCreateTaxCode,
  useUpdateTaxCode,
  useDeleteTaxCode,
  getListTaxCodesQueryKey,
  useListCompanies,
  useListAccounts,
  type TaxCode,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { useLanguage } from "@/lib/language-provider";

const STATUS = enumOptions(["active", "inactive"]);

export default function TaxCodesPage() {
  const { language, t } = useLanguage();
  const { options: TAX_TYPES } = useLookupOptions("tax_type", ["output", "input", "exempt"]);
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
    { name: "code", label: t("common.code"), required: true, createOnly: true },
    { name: "name", label: t("tax.name"), required: true },
    { name: "nameAr", label: t("tax.name_ar"), required: true, rtl: true },
    { name: "taxType", label: t("tax.type"), type: "select", required: true, options: TAX_TYPES },
    { name: "rate", label: t("tax.rate"), type: "money", required: true },
    { name: "taxAccountId", label: t("tax.account"), type: "select", options: accountOptions },
    { name: "status", label: t("common.status"), type: "select", options: STATUS },
    { name: "description", label: t("acc.description"), type: "textarea" },
  ];

  const columns: ResourceColumn<TaxCode>[] = [
    { header: t("common.code"), render: (r) => <span className="font-medium">{r.code}</span> },
    { header: t("tax.name"), render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: t("tax.type"), render: (r) => <Badge variant="outline">{enumLabel(r.taxType, language)}</Badge> },
    { header: t("tax.rate"), render: (r) => `${r.rate}%` },
    { header: t("tax.account"), render: (r) => accountLabel(r.taxAccountId) },
    { header: t("common.status"), render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title={t("nav.tax_codes")}
      columns={columns}
      fields={fields}
      useList={useListTaxCodes}
      useCreate={useCreateTaxCode}
      useUpdate={useUpdateTaxCode}
      useDelete={useDeleteTaxCode}
      getListQueryKey={getListTaxCodesQueryKey}
      companyId={companyId}
    />
  );
}
