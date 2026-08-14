import {
  useListLegalHearings,
  useCreateLegalHearing,
  useUpdateLegalHearing,
  useDeleteLegalHearing,
  getListLegalHearingsQueryKey,
  useListLegalCases,
  useListCompanies,
  type LegalHearing,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";

export default function LegalHearingsPage() {
  const { language, t } = useLanguage();
  const HEARING_STATUS = enumOptions(["scheduled", "held", "adjourned", "cancelled"]);
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
      generatorKey: "legalHearing",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "hearingDate", label: t("legal.hearing_date"), type: "date" },
    { name: "hearingTime", label: t("legal.hearing_time") },
    { name: "location", label: t("legal.location") },
    { name: "courtRoom", label: t("legal.court_room") },
    { name: "status", label: t("common.status"), type: "select", options: HEARING_STATUS },
    { name: "summary", label: t("legal.summary"), type: "textarea" },
    { name: "decision", label: t("legal.decision"), type: "textarea" },
    { name: "nextHearingDate", label: t("legal.next_hearing_date"), type: "date" },
  ];

  const columns: ResourceColumn<LegalHearing>[] = [
    { header: t("legal.case"), render: (r) => caseName(r.legalCaseId) },
    { header: t("legal.hearing_date"), render: (r) => r.hearingDate ?? "-" },
    { header: t("legal.location"), render: (r) => r.location ?? "-" },
    { header: t("common.status"), render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title={t("nav.legal_hearings")}
      columns={columns}
      fields={fields}
      useList={useListLegalHearings}
      useCreate={useCreateLegalHearing}
      useUpdate={useUpdateLegalHearing}
      useDelete={useDeleteLegalHearing}
      getListQueryKey={getListLegalHearingsQueryKey}
      companyId={companyId}
      searchable={false}
    />
  );
}
