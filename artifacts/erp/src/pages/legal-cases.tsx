import { useQueryClient } from "@tanstack/react-query";
import {
  useListLegalCases,
  useCreateLegalCase,
  useUpdateLegalCase,
  useDeleteLegalCase,
  getListLegalCasesQueryKey,
  useCloseLegalCase,
  useReopenLegalCase,
  useListLegalAdvisors,
  useListLawFirms,
  useListCompanies,
  type LegalCase,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";

const CASE_TYPE = enumOptions(["civil", "commercial", "labor", "criminal", "administrative", "arbitration", "other"]);
const ROLE = enumOptions(["plaintiff", "defendant", "third_party"]);
const COUNTERPARTY_TYPE = enumOptions(["customer", "contractor", "supplier", "employee", "other"]);

export default function LegalCasesPage() {
  const { language, t } = useLanguage();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: advisors } = useListLegalAdvisors({ pageSize: 200 });
  const { data: lawFirms } = useListLawFirms({ pageSize: 200 });

  const closeMutation = useCloseLegalCase();
  const reopenMutation = useReopenLegalCase();

  const advisorOptions = (advisors?.data ?? []).map((x) => ({ value: x.id, label: x.name, labelAr: x.nameAr ?? x.name }));
  const lawFirmOptions = (lawFirms?.data ?? []).map((x) => ({ value: x.id, label: x.name, labelAr: x.nameAr ?? x.name }));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListLegalCasesQueryKey() });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runAction = (mutation: any, id: string) => {
    mutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: t("common.saved") });
          invalidate();
        },
        onError: () => toast({ title: t("common.error"), variant: "destructive" }),
      },
    );
  };

  const fields: ResourceField[] = [
    { name: "code", label: t("common.code"), required: true, createOnly: true },
    { name: "title", label: t("legal.title"), required: true },
    { name: "titleAr", label: t("legal.title_ar"), rtl: true },
    { name: "caseType", label: t("legal.case_type"), type: "select", options: CASE_TYPE, required: true },
    { name: "role", label: t("legal.role"), type: "select", options: ROLE, required: true },
    { name: "courtName", label: t("legal.court_name") },
    { name: "courtCaseNumber", label: t("legal.court_case_number") },
    { name: "filingDate", label: t("legal.filing_date"), type: "date" },
    { name: "opponentName", label: t("legal.opponent_name") },
    { name: "claimAmount", label: t("legal.claim_amount"), type: "money" },
    { name: "advisorId", label: t("legal.advisor"), type: "select", options: advisorOptions },
    { name: "lawFirmId", label: t("legal.law_firm"), type: "select", options: lawFirmOptions },
    { name: "counterpartyType", label: t("legal.counterparty_type"), type: "select", options: COUNTERPARTY_TYPE },
    { name: "description", label: t("legal.description"), type: "textarea" },
    { name: "notes", label: t("legal.notes"), type: "textarea" },
  ];

  const columns: ResourceColumn<LegalCase>[] = [
    { header: t("common.code"), render: (r) => r.code },
    { header: t("legal.title"), render: (r) => (language === "ar" ? (r.titleAr ?? r.title) : r.title) },
    { header: t("legal.case_type"), render: (r) => enumLabel(r.caseType, language) },
    { header: t("legal.role"), render: (r) => enumLabel(r.role, language) },
    { header: t("legal.claim_amount"), render: (r) => r.claimAmount },
    { header: t("common.status"), render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  const terminalStatuses = ["closed", "won", "lost", "settled"];

  return (
    <ResourceManager
      title={t("nav.legal_cases")}
      columns={columns}
      fields={fields}
      useList={useListLegalCases}
      useCreate={useCreateLegalCase}
      useUpdate={useUpdateLegalCase}
      useDelete={useDeleteLegalCase}
      getListQueryKey={getListLegalCasesQueryKey}
      companyId={companyId}
      rowActions={(r) => (
        <>
          {!terminalStatuses.includes(r.status) && (
            <Button variant="outline" size="sm" disabled={closeMutation.isPending} onClick={() => runAction(closeMutation, r.id)}>
              {t("legal.close")}
            </Button>
          )}
          {r.status === "closed" && (
            <Button variant="outline" size="sm" disabled={reopenMutation.isPending} onClick={() => runAction(reopenMutation, r.id)}>
              {t("legal.reopen")}
            </Button>
          )}
        </>
      )}
    />
  );
}
