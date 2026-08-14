import {
  useListLegalClaims,
  useCreateLegalClaim,
  useUpdateLegalClaim,
  useDeleteLegalClaim,
  getListLegalClaimsQueryKey,
  useListLegalCases,
  useListCompanies,
  type LegalClaim,
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

const CLAIM_STATUS = enumOptions(["draft", "submitted", "under_review", "accepted", "rejected", "settled"]);

export default function LegalClaimsPage() {
  const { language, t } = useLanguage();
  const CLAIM_TYPE = enumOptions(["financial", "contractual", "damages", "other"]);
  const { options: DIRECTION } = useLookupOptions("legal_claim_direction", ["by_company", "against_company"]);
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: cases } = useListLegalCases({ pageSize: 200 });

  const caseOptions = (cases?.data ?? []).map((x) => ({
    value: x.id,
    label: `${x.code} - ${x.title}`,
    labelAr: `${x.code} - ${x.titleAr ?? x.title}`,
  }));
  const caseName = (id: string | null | undefined) => {
    const c = (cases?.data ?? []).find((x) => x.id === id);
    return c ? `${c.code} - ${c.title}` : "-";
  };

  const fields: ResourceField[] = [
    { name: "legalCaseId", label: t("legal.case"), type: "select", options: caseOptions, required: true },
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence on save; shown here beforehand.
      generated: true,
      generatorKey: "legalClaim",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "claimType", label: t("legal.claim_type"), type: "select", options: CLAIM_TYPE, required: true },
    { name: "direction", label: t("legal.direction"), type: "select", options: DIRECTION, required: true },
    { name: "amount", label: t("legal.amount"), type: "money" },
    { name: "status", label: t("common.status"), type: "select", options: CLAIM_STATUS },
    { name: "claimDate", label: t("legal.claim_date"), type: "date" },
    { name: "description", label: t("legal.description"), type: "textarea" },
  ];

  const columns: ResourceColumn<LegalClaim>[] = [
    { header: t("common.code"), render: (r) => r.code },
    { header: t("legal.case"), render: (r) => caseName(r.legalCaseId) },
    { header: t("legal.claim_type"), render: (r) => enumLabel(r.claimType, language) },
    { header: t("legal.direction"), render: (r) => enumLabel(r.direction, language) },
    { header: t("legal.amount"), render: (r) => r.amount },
    { header: t("common.status"), render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title={t("nav.legal_claims")}
      columns={columns}
      fields={fields}
      useList={useListLegalClaims}
      useCreate={useCreateLegalClaim}
      useUpdate={useUpdateLegalClaim}
      useDelete={useDeleteLegalClaim}
      getListQueryKey={getListLegalClaimsQueryKey}
      companyId={companyId}
      searchable={false}
    />
  );
}
