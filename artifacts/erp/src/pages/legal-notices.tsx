import { useQueryClient } from "@tanstack/react-query";
import {
  useListLegalNotices,
  useCreateLegalNotice,
  useUpdateLegalNotice,
  useDeleteLegalNotice,
  getListLegalNoticesQueryKey,
  useSendLegalNotice,
  useListLegalCases,
  useListLegalContracts,
  useListCompanies,
  type LegalNotice,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { enumOptions, enumLabel } from "@/lib/enums";
import { useLookupOptions } from "@/lib/lookups";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-provider";
import { useToast } from "@/hooks/use-toast";


export default function LegalNoticesPage() {
  // Domain owned by the lookup engine. The literal is the fallback used
  // until the registry is seeded, so behaviour is unchanged either way.
  const { options: lk_counterparty_type } = useLookupOptions("counterparty_type", ["customer", "contractor", "supplier", "employee", "other"]);
  const RECIPIENT_TYPE = lk_counterparty_type;
  const { language, t } = useLanguage();
  const NOTICE_TYPE = enumOptions(["warning", "demand", "termination", "legal", "other"]);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;
  const { data: cases } = useListLegalCases({ pageSize: 200 });
  const { data: contracts } = useListLegalContracts({ pageSize: 200 });

  const sendMutation = useSendLegalNotice();

  const caseOptions = (cases?.data ?? []).map((x) => ({
    value: x.id,
    label: `${x.code} - ${x.title}`,
    labelAr: `${x.code} - ${x.titleAr ?? x.title}`,
  }));
  const contractOptions = (contracts?.data ?? []).map((x) => ({
    value: x.id,
    label: `${x.code} - ${x.title}`,
    labelAr: `${x.code} - ${x.titleAr ?? x.title}`,
  }));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListLegalNoticesQueryKey() });

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
    {
      name: "code",
      label: "Reference",
      labelAr: "الرمز",
      // Issued by the central sequence on save; shown here beforehand.
      generated: true,
      generatorKey: "legalNotice",
      createOnly: true,
      description: "The system issues this number automatically when the record is saved.",
      descriptionAr: "يولّد النظام هذا الرقم تلقائيًا عند الحفظ، ولا يُدخل يدويًا.",
    },
    { name: "noticeType", label: t("legal.notice_type"), type: "select", options: NOTICE_TYPE, required: true },
    { name: "legalCaseId", label: t("legal.case"), type: "select", options: caseOptions },
    { name: "legalContractId", label: t("nav.legal_contracts"), type: "select", options: contractOptions },
    { name: "recipientType", label: t("legal.recipient_type"), type: "select", options: RECIPIENT_TYPE },
    { name: "recipientName", label: t("legal.recipient_name") },
    { name: "subject", label: t("legal.subject"), required: true },
    { name: "body", label: t("legal.body"), type: "textarea" },
    { name: "noticeDate", label: t("legal.notice_date"), type: "date" },
    { name: "dueDate", label: t("legal.due_date"), type: "date" },
    { name: "deliveryMethod", label: t("legal.delivery_method") },
  ];

  const columns: ResourceColumn<LegalNotice>[] = [
    { header: t("common.code"), render: (r) => r.code },
    { header: t("legal.notice_type"), render: (r) => enumLabel(r.noticeType, language) },
    { header: t("legal.subject"), render: (r) => r.subject },
    { header: t("legal.recipient_name"), render: (r) => r.recipientName ?? "-" },
    { header: t("common.status"), render: (r) => <Badge variant="secondary">{enumLabel(r.status, language)}</Badge> },
  ];

  return (
    <ResourceManager
      title={t("nav.legal_notices")}
      columns={columns}
      fields={fields}
      useList={useListLegalNotices}
      useCreate={useCreateLegalNotice}
      useUpdate={useUpdateLegalNotice}
      useDelete={useDeleteLegalNotice}
      getListQueryKey={getListLegalNoticesQueryKey}
      companyId={companyId}
      rowActions={(r) => (
        <>
          {r.status === "draft" && (
            <Button variant="outline" size="sm" disabled={sendMutation.isPending} onClick={() => runAction(sendMutation, r.id)}>
              {t("legal.send")}
            </Button>
          )}
        </>
      )}
    />
  );
}
