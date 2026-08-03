import {
  useListMarketingDistributionLogs,
  type MarketingDistributionLog,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/language-provider";
import { DISTRIBUTION_STRATEGIES } from "./distribution-rules";
import { type EnumOption } from "@/lib/enums";

function optLabel(opts: EnumOption[], value: string | null | undefined, lang: "en" | "ar"): string {
  if (!value) return "-";
  const o = opts.find((x) => x.value === value);
  return o ? (lang === "ar" ? o.labelAr : o.label) : value;
}

// Distribution logs are written only by the engine, so the UI is read-only and
// passes no-op mutations (create/edit/delete are disabled below).
const noopMutation = () => ({ mutate: () => {}, isPending: false });

export default function DistributionLogsPage() {
  const { language } = useLanguage();

  const fields: ResourceField[] = [];

  const columns: ResourceColumn<MarketingDistributionLog>[] = [
    { header: "Date", headerAr: "التاريخ", render: (r) => new Date(r.createdAt).toLocaleString(language === "ar" ? "ar" : "en") },
    { header: "Lead ID", headerAr: "معرّف العميل", render: (r) => <span className="font-mono text-xs">{r.leadId}</span> },
    { header: "Assigned To", headerAr: "أُسند إلى", render: (r) => <span className="font-mono text-xs">{r.assignedToUserId}</span> },
    { header: "Strategy", headerAr: "آلية التوزيع", render: (r) => <Badge variant="secondary">{optLabel(DISTRIBUTION_STRATEGIES, r.strategy, language)}</Badge> },
    { header: "Score", headerAr: "النقاط", render: (r) => r.score ?? "-" },
    { header: "Reason", headerAr: "السبب", render: (r) => r.reason ?? "-" },
  ];

  return (
    <ResourceManager
      title="Lead Distribution Logs"
      titleAr="سجل توزيع العملاء"
      columns={columns}
      fields={fields}
      useList={useListMarketingDistributionLogs}
      useCreate={noopMutation}
      useUpdate={noopMutation}
      useDelete={noopMutation}
      getListQueryKey={() => ["marketing-distribution-logs"]}
      canCreate={false}
      canEdit={false}
      canDelete={false}
    />
  );
}
