import {
  useListLegalAdvisors,
  useCreateLegalAdvisor,
  useUpdateLegalAdvisor,
  useDeleteLegalAdvisor,
  getListLegalAdvisorsQueryKey,
  useListLawFirms,
  useListCompanies,
  type LegalAdvisor,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumLabel } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

export default function LegalAdvisorsPage() {
  const { language, t } = useLanguage();
  const { options: ADVISOR_TYPE } = useLookupOptions("advisor_type", ["internal", "external"]);
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: lawFirms } = useListLawFirms({ pageSize: 200 });

  const lawFirmOptions = (lawFirms?.data ?? []).map((x) => ({
    value: x.id,
    label: x.name,
    labelAr: x.nameAr ?? x.name,
  }));
  const lawFirmName = (id: string | null | undefined) => {
    const f = (lawFirms?.data ?? []).find((x) => x.id === id);
    return f ? (language === "ar" ? (f.nameAr ?? f.name) : f.name) : "-";
  };

  const fields: ResourceField[] = [
    { name: "code", label: t("common.code"), required: true, createOnly: true },
    { name: "name", label: t("legal.name"), required: true },
    { name: "nameAr", label: t("legal.name_ar"), rtl: true },
    { name: "advisorType", label: t("legal.advisor_type"), type: "select", options: ADVISOR_TYPE, required: true },
    { name: "lawFirmId", label: t("legal.law_firm"), type: "select", options: lawFirmOptions },
    { name: "phone", label: t("legal.phone") },
    { name: "email", label: t("legal.email") },
    { name: "specialization", label: t("legal.specialization") },
    { name: "barNumber", label: t("legal.bar_number") },
    { name: "notes", label: t("legal.notes"), type: "textarea" },
  ];

  const columns: ResourceColumn<LegalAdvisor>[] = [
    { header: t("common.code"), render: (r) => r.code },
    { header: t("legal.name"), render: (r) => (language === "ar" ? (r.nameAr ?? r.name) : r.name) },
    { header: t("legal.advisor_type"), render: (r) => enumLabel(r.advisorType, language) },
    { header: t("legal.law_firm"), render: (r) => lawFirmName(r.lawFirmId) },
    { header: t("common.status"), render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title={t("nav.legal_advisors")}
      columns={columns}
      fields={fields}
      useList={useListLegalAdvisors}
      useCreate={useCreateLegalAdvisor}
      useUpdate={useUpdateLegalAdvisor}
      useDelete={useDeleteLegalAdvisor}
      getListQueryKey={getListLegalAdvisorsQueryKey}
      companyId={companyId}
    />
  );
}
