import {
  useListMarketingDistributionRules,
  useCreateMarketingDistributionRule,
  useUpdateMarketingDistributionRule,
  useDeleteMarketingDistributionRule,
  getListMarketingDistributionRulesQueryKey,
  useListCompanies,
  type MarketingDistributionRule,
} from "@workspace/api-client-react";
import {
  ResourceManager,
  type ResourceField,
  type ResourceColumn,
} from "@/components/resource/resource-manager";
import { Badge } from "@/components/ui/badge";
import { type EnumOption } from "@/lib/enums";
import { useLanguage } from "@/lib/language-provider";

export const DISTRIBUTION_STRATEGIES: EnumOption[] = [
  { value: "round_robin", label: "Round Robin", labelAr: "بالتناوب" },
  { value: "load_balanced", label: "Load Balanced", labelAr: "موازنة الحمل" },
  { value: "performance", label: "Performance Based", labelAr: "حسب الأداء" },
  { value: "direct", label: "Direct (Specific Agent)", labelAr: "مباشر (وكيل محدد)" },
];

function optLabel(opts: EnumOption[], value: string | null | undefined, lang: "en" | "ar"): string {
  if (!value) return "-";
  const o = opts.find((x) => x.value === value);
  return o ? (lang === "ar" ? o.labelAr : o.label) : value;
}

export default function DistributionRulesPage() {
  const { language } = useLanguage();
  const { data: companies } = useListCompanies();
  const companyId = companies?.[0]?.id;

  const fields: ResourceField[] = [
    { name: "code", label: "Code", labelAr: "الرمز", required: true, createOnly: true },
    { name: "name", label: "Name", labelAr: "الاسم", required: true },
    { name: "nameAr", label: "Name (Arabic)", labelAr: "الاسم بالعربية", rtl: true },
    { name: "strategy", label: "Strategy", labelAr: "آلية التوزيع", type: "select", options: DISTRIBUTION_STRATEGIES, required: true },
    { name: "priority", label: "Priority", labelAr: "الأولوية", type: "number" },
    { name: "maxLeadsPerAgent", label: "Max Leads / Agent", labelAr: "حد العملاء لكل وكيل", type: "number" },
    { name: "targetUserId", label: "Target Agent (User ID, for Direct)", labelAr: "الوكيل المستهدف (معرّف المستخدم، للتوزيع المباشر)" },
    { name: "campaignId", label: "Campaign ID (criteria)", labelAr: "معرّف الحملة (شرط)" },
    { name: "channelId", label: "Channel ID (criteria)", labelAr: "معرّف القناة (شرط)" },
    { name: "sourceId", label: "Source ID (criteria)", labelAr: "معرّف المصدر (شرط)" },
    { name: "branchId", label: "Branch ID (criteria)", labelAr: "معرّف الفرع (شرط)" },
    { name: "description", label: "Description", labelAr: "الوصف", type: "textarea" },
    { name: "notes", label: "Notes", labelAr: "ملاحظات", type: "textarea" },
  ];

  const columns: ResourceColumn<MarketingDistributionRule>[] = [
    { header: "Code", headerAr: "الرمز", render: (r) => <span className="font-medium">{r.code}</span> },
    { header: "Name", headerAr: "الاسم", render: (r) => (language === "ar" ? r.nameAr ?? r.name : r.name) },
    { header: "Strategy", headerAr: "آلية التوزيع", render: (r) => <Badge variant="secondary">{optLabel(DISTRIBUTION_STRATEGIES, r.strategy, language)}</Badge> },
    { header: "Priority", headerAr: "الأولوية", render: (r) => r.priority },
    { header: "Max / Agent", headerAr: "حد لكل وكيل", render: (r) => r.maxLeadsPerAgent ?? "-" },
  ];

  return (
    <ResourceManager
      title="Lead Distribution Rules"
      titleAr="قواعد توزيع العملاء"
      columns={columns}
      fields={fields}
      useList={useListMarketingDistributionRules}
      useCreate={useCreateMarketingDistributionRule}
      useUpdate={useUpdateMarketingDistributionRule}
      useDelete={useDeleteMarketingDistributionRule}
      getListQueryKey={getListMarketingDistributionRulesQueryKey}
      companyId={companyId}
    />
  );
}
