import { useQueryClient } from "@tanstack/react-query";
import {
  useListLegalContracts,
  useCreateLegalContract,
  useUpdateLegalContract,
  useDeleteLegalContract,
  getListLegalContractsQueryKey,
  useReviewLegalContract,
  useApproveLegalContract,
  useActivateLegalContract,
  useSuspendLegalContract,
  useTerminateLegalContract,
  useRenewLegalContract,
  useArchiveLegalContract,
  useListContractTemplates,
  useListCompanies,
  type LegalContract,
} from "@workspace/api-client-react";
import DOMPurify from "dompurify";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { DocumentsRowAction } from "@/components/documents/documents-row-action";
import { enumOptions, enumLabel } from "@/lib/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";

const COUNTERPARTY_TYPE = enumOptions(["customer", "contractor", "supplier", "employee", "other"]);

export default function LegalContractsPage() {
  const { language, t } = useLanguage();
  const CONTRACT_TYPE = enumOptions(["sales", "construction", "procurement", "legal", "other"]);
  const SOURCE_MODULE = enumOptions(["sales", "construction", "procurement", "legal", "other"]);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: templates } = useListContractTemplates({ pageSize: 200 });

  const reviewMutation = useReviewLegalContract();
  const approveMutation = useApproveLegalContract();
  const activateMutation = useActivateLegalContract();
  const suspendMutation = useSuspendLegalContract();
  const terminateMutation = useTerminateLegalContract();
  const renewMutation = useRenewLegalContract();
  const archiveMutation = useArchiveLegalContract();

  // Fetch the locked, system-generated approved document and open a sanitized,
  // script-free print window. The HTML is always DOMPurify-sanitized before it
  // touches the DOM, regardless of template provenance.
  const openApprovedDocument = async (id: string) => {
    try {
      const res = await fetch(`/api/legal-contracts/${id}/document`, { credentials: "include" });
      if (!res.ok) {
        toast({ title: t("common.error"), variant: "destructive" });
        return;
      }
      const data = (await res.json()) as { html?: string };
      const clean = DOMPurify.sanitize(String(data.html ?? ""), {
        WHOLE_DOCUMENT: true,
        FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
      });
      const win = window.open("", "_blank", "width=900,height=700");
      if (!win) return;
      win.document.open();
      win.document.write(clean);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 350);
    } catch {
      toast({ title: t("common.error"), variant: "destructive" });
    }
  };

  const templateOptions = (templates?.data ?? []).map((x) => ({
    value: x.id,
    label: x.name,
    labelAr: x.nameAr ?? x.name,
  }));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListLegalContractsQueryKey() });

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
    { name: "contractType", label: t("legal.contract_type"), type: "select", options: CONTRACT_TYPE, required: true },
    { name: "sourceModule", label: t("legal.source_module"), type: "select", options: SOURCE_MODULE },
    { name: "templateId", label: t("legal.template"), type: "select", options: templateOptions },
    { name: "counterpartyType", label: t("legal.counterparty_type"), type: "select", options: COUNTERPARTY_TYPE },
    { name: "counterpartyName", label: t("legal.counterparty_name") },
    { name: "contractDate", label: t("legal.contract_date"), type: "date" },
    { name: "effectiveDate", label: t("legal.effective_date"), type: "date" },
    { name: "expiryDate", label: t("legal.expiry_date"), type: "date" },
    { name: "autoRenew", label: t("legal.auto_renew"), type: "boolean" },
    { name: "value", label: t("legal.value"), type: "money" },
    { name: "governingLaw", label: t("legal.governing_law") },
    { name: "description", label: t("legal.description"), type: "textarea" },
    { name: "notes", label: t("legal.notes"), type: "textarea" },
  ];

  const columns: ResourceColumn<LegalContract>[] = [
    { header: t("common.code"), render: (r) => r.code },
    { header: t("legal.title"), render: (r) => (language === "ar" ? (r.titleAr ?? r.title) : r.title) },
    { header: t("legal.contract_type"), render: (r) => enumLabel(r.contractType, language) },
    { header: t("legal.source_module"), render: (r) => enumLabel(r.sourceModule, language) },
    { header: t("legal.value"), render: (r) => r.value },
    {
      header: t("common.status"),
      render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge>,
    },
  ];

  return (
    <ResourceManager
      title={t("nav.legal_contracts")}
      columns={columns}
      fields={fields}
      useList={useListLegalContracts}
      useCreate={useCreateLegalContract}
      useUpdate={useUpdateLegalContract}
      useDelete={useDeleteLegalContract}
      getListQueryKey={getListLegalContractsQueryKey}
      companyId={companyId}
      rowActions={(r) => (
        <>
          {r.status === "draft" && (
            <Button variant="outline" size="sm" disabled={reviewMutation.isPending} onClick={() => runAction(reviewMutation, r.id)}>
              {t("legal.review")}
            </Button>
          )}
          {r.status === "under_review" && (
            <Button variant="outline" size="sm" disabled={approveMutation.isPending} onClick={() => runAction(approveMutation, r.id)}>
              {t("legal.approve")}
            </Button>
          )}
          {r.status === "approved" && (
            <Button variant="outline" size="sm" disabled={activateMutation.isPending} onClick={() => runAction(activateMutation, r.id)}>
              {t("legal.activate")}
            </Button>
          )}
          {r.status === "active" && (
            <>
              <Button variant="outline" size="sm" disabled={suspendMutation.isPending} onClick={() => runAction(suspendMutation, r.id)}>
                {t("legal.suspend")}
              </Button>
              <Button variant="outline" size="sm" disabled={renewMutation.isPending} onClick={() => runAction(renewMutation, r.id)}>
                {t("legal.renew")}
              </Button>
              <Button variant="outline" size="sm" disabled={terminateMutation.isPending} onClick={() => runAction(terminateMutation, r.id)}>
                {t("legal.terminate")}
              </Button>
            </>
          )}
          {r.status === "suspended" && (
            <Button variant="outline" size="sm" disabled={activateMutation.isPending} onClick={() => runAction(activateMutation, r.id)}>
              {t("legal.activate")}
            </Button>
          )}
          {r.approvedDocumentAt && (
            <Button variant="outline" size="sm" onClick={() => openApprovedDocument(r.id)}>
              {t("legal.print_document")}
            </Button>
          )}
          {r.status !== "draft" && r.status !== "under_review" && r.status !== "archived" && (
            <Button variant="outline" size="sm" disabled={archiveMutation.isPending} onClick={() => runAction(archiveMutation, r.id)}>
              {t("legal.archive")}
            </Button>
          )}
          <DocumentsRowAction moduleKey="legal_contracts" sourceId={r.id} />
        </>
      )}
    />
  );
}
