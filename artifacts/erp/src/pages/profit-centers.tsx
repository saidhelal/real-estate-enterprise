import {
  useListProfitCenters,
  useCreateProfitCenter,
  useUpdateProfitCenter,
  useDeleteProfitCenter,
  getListProfitCentersQueryKey,
  useListCompanies,
  type ProfitCenter,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

const KINDS = enumOptions(["segment", "department", "project", "branch"]);
const STATUS = enumOptions(["active", "inactive"]);

export default function ProfitCentersPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: centers } = useListProfitCenters({ pageSize: 500 });

  const parentOptions = (centers?.data ?? []).map((c) => ({
    value: c.id,
    label: `${c.code} - ${c.name}`,
    labelAr: `${c.code} - ${c.nameAr}`,
  }));

  const fields: ResourceField[] = [
    { name: "code", label: t("common.code"), required: true, createOnly: true },
    { name: "name", label: t("common.name"), required: true },
    { name: "nameAr", label: t("common.name_ar"), required: true, rtl: true },
    { name: "kind", label: t("acc.kind"), type: "select", required: true, options: KINDS },
    { name: "parentId", label: t("acc.parent_cost_center"), type: "select", options: parentOptions },
    { name: "status", label: t("common.status"), type: "select", options: STATUS },
    { name: "description", label: t("acc.description"), type: "textarea" },
  ];

  const columns: ResourceColumn<ProfitCenter>[] = [
    { header: t("common.code"), render: (r) => <span className="font-medium">{r.code}</span> },
    { header: t("common.name"), render: (r) => (language === "ar" ? r.nameAr : r.name) },
    { header: t("acc.kind"), render: (r) => <Badge variant="secondary">{enumLabel(r.kind, language)}</Badge> },
    { header: t("common.status"), render: (r) => <Badge variant="outline">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title={t("nav.profit_centers")}
      columns={columns}
      fields={fields}
      useList={useListProfitCenters}
      useCreate={useCreateProfitCenter}
      useUpdate={useUpdateProfitCenter}
      useDelete={useDeleteProfitCenter}
      getListQueryKey={getListProfitCentersQueryKey}
      companyId={companyId}
    />
  );
}
