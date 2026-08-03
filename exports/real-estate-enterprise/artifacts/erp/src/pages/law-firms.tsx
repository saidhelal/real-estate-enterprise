import {
  useListLawFirms,
  useCreateLawFirm,
  useUpdateLawFirm,
  useDeleteLawFirm,
  getListLawFirmsQueryKey,
  useListCompanies,
  type LawFirm,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

export default function LawFirmsPage() {
  const { language, t } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: t("common.code"), required: true, createOnly: true },
    { name: "name", label: t("legal.name"), required: true },
    { name: "nameAr", label: t("legal.name_ar"), rtl: true },
    { name: "contactPerson", label: t("legal.contact_person") },
    { name: "phone", label: t("legal.phone") },
    { name: "email", label: t("legal.email") },
    { name: "address", label: t("legal.address"), type: "textarea" },
    { name: "specialization", label: t("legal.specialization") },
    { name: "notes", label: t("legal.notes"), type: "textarea" },
  ];

  const columns: ResourceColumn<LawFirm>[] = [
    { header: t("common.code"), render: (r) => r.code },
    { header: t("legal.name"), render: (r) => (language === "ar" ? (r.nameAr ?? r.name) : r.name) },
    { header: t("legal.contact_person"), render: (r) => r.contactPerson ?? "-" },
    { header: t("legal.phone"), render: (r) => r.phone ?? "-" },
    { header: t("common.status"), render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title={t("nav.law_firms")}
      columns={columns}
      fields={fields}
      useList={useListLawFirms}
      useCreate={useCreateLawFirm}
      useUpdate={useUpdateLawFirm}
      useDelete={useDeleteLawFirm}
      getListQueryKey={getListLawFirmsQueryKey}
      companyId={companyId}
    />
  );
}
